import { test, expect } from '@playwright/test'
import { join } from 'path'
import { launchApp, getMainWindow, repoRoot } from './helpers.js'

// Proves the IPC sender guard is WIRED, not just correct in isolation — a guard
// that is right but never installed passes every unit test. Both directions
// against the running app: the real main window reaches a privileged channel; a
// rogue window with the same preload at the same URL, differing only in never
// having been registered, is refused.

const ROGUE_PATHS = {
  preload: join(repoRoot, 'out', 'preload', 'index.js'),
  indexHtml: join(repoRoot, 'out', 'renderer', 'index.html')
}

test.describe('IPC sender guard', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('the main window can reach privileged channels', async () => {
    ;({ electronApp } = await launchApp())
    const page = await getMainWindow(electronApp)
    // Allow path (also the lockout regression guard — a mis-set trusted location
    // would reject our own window here).
    const version = await page.evaluate(() => window.electronAPI.getAppVersion())
    expect(version).toMatch(/^\d+\.\d+\.\d+/)
  })

  test('an unregistered window is refused, even with our preload at our own URL', async () => {
    ;({ electronApp } = await launchApp())
    await getMainWindow(electronApp)

    const outcome = await electronApp.evaluate(async ({ BrowserWindow }, paths) => {
      const rogue = new BrowserWindow({
        show: false,
        webPreferences: { preload: paths.preload, sandbox: true }
      })
      await rogue.loadFile(paths.indexHtml)
      const result = await rogue.webContents.executeJavaScript(
        `window.electronAPI.getAppVersion().then(() => 'ALLOWED').catch((e) => 'REFUSED: ' + e.message)`
      )
      rogue.destroy()
      return result
    }, ROGUE_PATHS)

    expect(outcome).toMatch(/^REFUSED/)
    expect(outcome).toContain('untrusted sender')
  })
})
