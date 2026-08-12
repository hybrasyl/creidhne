import { _electron as electron, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const repoRoot = join(__dirname, '..')
export const mainEntry = join(repoRoot, 'out', 'main', 'index.js')

// The app's userData subdir under %LOCALAPPDATA%. Must match src/main/index.js
// (`join(localAppDataDir(), 'Erisco', 'Creidhne')`).
export const USERDATA_SUBPATH = ['Erisco', 'Creidhne']

// Launch the BUILT app under Electron.
//
// %LOCALAPPDATA% is redirected to a throwaway temp dir because src/main/index.js
// derives its userData (settings.json) from %LOCALAPPDATA% at module load —
// pointing it at a temp dir keeps every run hermetic and off the real profile.
// Pass `seedSettings` to pre-write settings.json; pass an existing `localAppData`
// to reuse one dir across two launches (persistence-across-relaunch tests).
export async function launchApp({ seedSettings, localAppData: reuseDir } = {}) {
  const localAppData = reuseDir ?? mkdtempSync(join(tmpdir(), 'creidhne-e2e-'))
  if (seedSettings) {
    const dir = join(localAppData, ...USERDATA_SUBPATH)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'settings.json'), JSON.stringify(seedSettings, null, 2))
  }
  // Strip ELECTRON_RUN_AS_NODE — if it's set in the parent environment (some
  // Electron-hosted terminals set it), the launched electron binary runs as
  // plain Node (no `app`, no windows) and the main process throws at
  // app.setPath. We want a real Electron app here.
  const env = { ...process.env, LOCALAPPDATA: localAppData, NODE_ENV: 'test' }
  delete env.ELECTRON_RUN_AS_NODE
  const electronApp = await electron.launch({ args: [mainEntry], cwd: repoRoot, env })
  await placeWindowsOffPrimary(electronApp)
  return { electronApp, localAppData }
}

// Keep the test windows off the monitor someone is working on.
//
// An E2E run opens a splash and a main window, sometimes several times in a
// suite, and every one of them steals focus on whichever display it lands on.
// The app centres on the primary display, which is normally the one in use.
//
// `CREIDHNE_E2E_DISPLAY` picks a display by index (as `screen.getAllDisplays()`
// orders them); with no value set, the first NON-primary display is used and a
// single-monitor machine is left alone. Placement is test-harness behaviour and
// deliberately lives here rather than in the app.
//
// Both existing and future windows are moved: the splash is created during
// `app.whenReady()` and can already exist by the time this runs, while the main
// window usually does not.
export async function placeWindowsOffPrimary(electronApp) {
  const index = process.env.CREIDHNE_E2E_DISPLAY
  await electronApp.evaluate(({ app, BrowserWindow, screen }, wanted) => {
    const displays = screen.getAllDisplays()
    const primary = screen.getPrimaryDisplay()
    const target =
      wanted !== undefined && displays[Number(wanted)]
        ? displays[Number(wanted)]
        : displays.find((d) => d.id !== primary.id)
    if (!target) return null // single monitor: leave everything where it is

    const place = (win) => {
      if (win.isDestroyed()) return
      const { width, height } = win.getBounds()
      // Centre it on the target display rather than pinning it to a corner, so a
      // window near that display's size is still fully on screen.
      win.setBounds({
        x: Math.round(target.bounds.x + (target.bounds.width - width) / 2),
        y: Math.round(target.bounds.y + (target.bounds.height - height) / 2),
        width,
        height
      })
    }
    BrowserWindow.getAllWindows().forEach(place)
    app.on('browser-window-created', (_e, win) => {
      place(win)
      // The app calls `center()` on reveal, which would pull it back to the
      // primary display, so re-place once the window is shown as well.
      win.once('show', () => place(win))
    })
    return target.id
  }, index)
}

// Find the real main window and wait until it's actually shown. The app pops a
// splash window first, so `firstWindow()` can return the wrong one. The splash
// has NO preload, so we identify the main window by the presence of Creidhne's
// preload bridge `window.electronAPI` — the splash exposes nothing. (The old
// `window.electron` toolkit bridge was removed when the main window went
// sandboxed, so it is no longer a valid probe.)
export async function getMainWindow(electronApp) {
  let page = null
  for (let i = 0; i < 120 && !page; i++) {
    for (const w of electronApp.windows()) {
      const isMain = await w.evaluate(() => !!window.electronAPI).catch(() => false)
      if (isMain) {
        page = w
        break
      }
    }
    if (!page) await electronApp.waitForEvent('window', { timeout: 500 }).catch(() => {})
  }
  if (!page) throw new Error('main renderer window (with a preload bridge) never appeared')

  const win = await electronApp.browserWindow(page)
  await expect.poll(() => win.evaluate((bw) => bw.isVisible()), { timeout: 20_000 }).toBe(true)
  await page.waitForSelector('[data-testid="app-root"]', { state: 'visible' })
  return page
}

// Snapshot native window geometry (main process) paired with the renderer's view
// of where a given element actually sits on screen, both in CSS px so they're
// directly comparable. `letterbox` is the tool for measuring content offsets.
export async function readGeometry(electronApp, page, selector = '[data-testid="app-root"]') {
  const win = await electronApp.browserWindow(page)
  const native = await win.evaluate((bw) => ({
    bounds: bw.getBounds(),
    contentBounds: bw.getContentBounds()
  }))
  const dom = await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    const r = el?.getBoundingClientRect()
    return {
      screenX: window.screenX,
      innerWidth: window.innerWidth,
      elementScreenLeft: r ? Math.round(window.screenX + r.left) : null
    }
  }, selector)
  return { native, dom, letterbox: dom.screenX - native.bounds.x }
}

export function tempExists(p) {
  return existsSync(p)
}
