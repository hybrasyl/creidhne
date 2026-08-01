import { test, expect } from '@playwright/test'
import { launchApp, getMainWindow } from './helpers.js'

// The sandbox regression is silent and late: a preload that imports a package
// builds, links and lints clean, then throws in the PACKAGED app where the
// sandboxed loader cannot resolve it, taking the bridge and the whole UI with it.
// This reads the flag back out of main and round-trips one bridge call, and
// checks the dead window.electron bridge stays gone so a scaffold refresh cannot
// silently re-add it and re-break the sandbox.

test.describe('preload sandbox', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('the main window is sandboxed and its bridge still works', async () => {
    ;({ electronApp } = await launchApp())
    const page = await getMainWindow(electronApp)

    // Read the flag off the main window's own BrowserWindow handle, not a
    // getAllWindows() scan (which raced the splash teardown).
    const win = await electronApp.browserWindow(page)
    const sandbox = await win.evaluate((bw) => bw.webContents.getLastWebPreferences()?.sandbox)
    expect(sandbox).toBe(true)

    // The bridge is alive despite the sandbox.
    const version = await page.evaluate(() => window.electronAPI.getAppVersion())
    expect(version).toMatch(/^\d+\.\d+\.\d+/)
  })

  test('the unused window.electron bridge is gone', async () => {
    ;({ electronApp } = await launchApp())
    const page = await getMainWindow(electronApp)
    expect(await page.evaluate(() => 'electron' in window)).toBe(false)
    expect(await page.evaluate(() => 'api' in window)).toBe(false)
  })
})
