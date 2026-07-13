import { test, expect } from '@playwright/test'
import { launchApp, getMainWindow } from './helpers.js'

// The settings round-trip end to end: change the theme through the renderer's
// IPC bridge, wait for the debounced atomic write to reach disk, relaunch
// against the same userData dir, and assert it hydrated. This spans renderer
// → IPC (settings:save, zod-validated at the boundary) → atomic disk write →
// next launch's load() → hydrate() — the whole path no single unit test covers.
// It drives the bridge rather than the Settings UI so it stays robust to markup.

test.describe('Settings persist across a restart', () => {
  let electronApp
  let localAppData

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('a theme change survives relaunch', async () => {
    ;({ electronApp, localAppData } = await launchApp())
    let page = await getMainWindow(electronApp)

    // Spread the current (valid) settings and flip the theme, so the save
    // payload passes the boundary zod validation.
    await page.evaluate(async () => {
      const current = await window.electronAPI.loadSettings()
      await window.electronAPI.saveSettings({ ...current, theme: 'dubhaimid' })
    })

    // Wait until the write has actually landed on disk — loadSettings reads
    // settings.json back through the main process, so this confirms persistence
    // without sleeping on the debounce.
    await expect
      .poll(() => page.evaluate(() => window.electronAPI.loadSettings().then((s) => s.theme)), {
        timeout: 5000
      })
      .toBe('dubhaimid')

    await electronApp.close()

    // Relaunch, same data dir, no seeding — it must hydrate Dubhaimid.
    ;({ electronApp } = await launchApp({ localAppData }))
    page = await getMainWindow(electronApp)

    const persisted = await page.evaluate(() =>
      window.electronAPI.loadSettings().then((s) => s.theme)
    )
    expect(persisted).toBe('dubhaimid')
  })
})
