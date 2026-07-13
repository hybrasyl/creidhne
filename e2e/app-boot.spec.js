import { test, expect } from '@playwright/test'
import { launchApp, getMainWindow } from './helpers.js'

// Boot smoke: the whole harness + startup handshake in one spec. Launches the
// built app, skips the splash, waits for the main window to be revealed (which
// only happens after the renderer signals app:ready), and asserts the hydrated
// UI is on screen. If this passes, the E2E harness is wired correctly.

test.describe('App boots', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('reveals the main window with the toolbar and hydrated content', async () => {
    ;({ electronApp } = await launchApp())
    const page = await getMainWindow(electronApp)

    // The hydrated app root is shown (window only reveals after app:ready).
    await expect(page.getByTestId('app-root')).toBeVisible()

    // The chrome toolbar rendered with the app wordmark.
    await expect(page.getByText('Creidhne', { exact: true }).first()).toBeVisible()
  })
})
