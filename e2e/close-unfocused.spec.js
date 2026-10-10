import { test, expect } from '@playwright/test'
import { launchApp, getMainWindow } from './helpers.js'

// The close guard answers the window that asked (HTOO-553). The renderer's
// `app:confirm-close` used to close BrowserWindow.getFocusedWindow(), which is
// null or another window whenever Creidhne is not in front: a close from the
// taskbar while another app has focus. The guard had already cancelled the close,
// so the window stayed open and a quit never ended. Under Electron 44 it hung one
// e2e run in three in `electronApp.close()`.
//
// Deterministic version: focus a second window, then quit. Fails against the
// focused-window code with the timeout below.

test.describe('Closing while another window has focus', () => {
  test('still quits', async () => {
    const { electronApp } = await launchApp()
    await getMainWindow(electronApp)

    await electronApp.evaluate(({ BrowserWindow }) => {
      const other = new BrowserWindow({ width: 240, height: 160, show: true })
      other.focus()
    })
    await expect
      .poll(() =>
        electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.getSize()[0])
      )
      .not.toBe(undefined)

    const closed = electronApp.waitForEvent('close', { timeout: 15_000 })
    await electronApp.evaluate(({ app }) => {
      setTimeout(() => app.quit(), 0)
    })
    await closed
  })
})
