import { test, expect } from '@playwright/test'
import { launchApp, getMainWindow } from './helpers.js'

// The macOS application menu, read from main and clicked there. macOS only: on
// Windows and Linux the window is frameless and Creidhne installs no menu.
// src/main/__tests__/appMenu.test.js covers the template on every OS; this checks
// what is installed, and the round trip through the renderer.

test.skip(process.platform !== 'darwin', 'the application menu is macOS only')

const menuItem = (electronApp, id) =>
  electronApp.evaluate(({ Menu }, itemId) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById(itemId)
    return item ? { label: item.label, enabled: item.enabled, checked: item.checked } : null
  }, id)

const clickItem = (electronApp, id) =>
  electronApp.evaluate(({ Menu }, itemId) => {
    Menu.getApplicationMenu().getMenuItemById(itemId).click()
  }, id)

test.describe('Application menu (macOS)', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close().catch(() => {})
  })

  test("is Creidhne's own menu, with no Reload", async () => {
    ;({ electronApp } = await launchApp())
    await getMainWindow(electronApp)

    const roles = await electronApp.evaluate(({ Menu }) => {
      const walk = (menu) =>
        menu.items.flatMap((i) => [i.role, ...(i.submenu ? walk(i.submenu) : [])])
      return walk(Menu.getApplicationMenu()).filter(Boolean)
    })
    expect(roles).not.toContain('reload')
    expect(roles).not.toContain('forcereload')
    expect(await menuItem(electronApp, 'about')).toMatchObject({ label: 'About Creidhne' })
    // Nothing is dirty at boot, so Save is greyed out.
    expect(await menuItem(electronApp, 'save')).toMatchObject({ enabled: false })
  })

  test('Go switches the page, and the menu marks it', async () => {
    ;({ electronApp } = await launchApp())
    await getMainWindow(electronApp)
    await expect.poll(async () => (await menuItem(electronApp, 'go:dashboard'))?.checked).toBe(true)

    await clickItem(electronApp, 'go:castables')
    // The tick follows the renderer's report, so it proves the page changed.
    await expect.poll(async () => (await menuItem(electronApp, 'go:castables'))?.checked).toBe(true)
    expect((await menuItem(electronApp, 'go:dashboard')).checked).toBe(false)
  })

  test('does nothing over an open dialog', async () => {
    ;({ electronApp } = await launchApp())
    const page = await getMainWindow(electronApp)

    await clickItem(electronApp, 'reportIssue')
    await expect(page.getByRole('dialog')).toBeVisible()
    await clickItem(electronApp, 'go:items')
    await page.waitForTimeout(300)
    expect((await menuItem(electronApp, 'go:items')).checked).toBe(false)
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('About opens the About dialog from another page', async () => {
    ;({ electronApp } = await launchApp())
    const page = await getMainWindow(electronApp)
    await clickItem(electronApp, 'about')
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect
      .poll(async () => (await menuItem(electronApp, 'go:dashboard'))?.checked)
      .toBe(false)
  })

  test('Quit quits, through the unsaved-changes guard', async () => {
    // The guard cancels the first `close` to ask the renderer. A cancelled close
    // cancels app.quit(), and macOS keeps an app running when its last window
    // closes: without the fix, ⌘Q left Creidhne running with no window.
    ;({ electronApp } = await launchApp())
    await getMainWindow(electronApp)
    const closed = electronApp.waitForEvent('close', { timeout: 15_000 })
    await electronApp.evaluate(({ app }) => {
      setTimeout(() => app.quit(), 0)
    })
    await closed
    electronApp = null
  })
})
