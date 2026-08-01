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
  return { electronApp, localAppData }
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
