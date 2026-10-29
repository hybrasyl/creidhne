import { test, expect } from '@playwright/test'
import { launchApp, getMainWindow, openPage } from './helpers.js'

// The nav bar fits the window at its minimum size. It had 27 buttons, and at
// 1024px the last of them ran off the right side of the window. The tools and
// Settings are now one More button with a menu (navPages.js). This measures
// the rendered bar, because the fault is a computed layout.

test.describe('nav bar', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('every button is inside the bar at the minimum window size', async () => {
    ;({ electronApp } = await launchApp())
    const page = await getMainWindow(electronApp)
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      const [w, h] = win.getMinimumSize()
      win.setSize(w, h)
    })
    const bar = page.getByTestId('nav-bar')
    await expect
      .poll(() => page.evaluate(() => window.innerWidth), { timeout: 5000 })
      .toBeLessThanOrEqual(1024)

    const overflow = await bar.evaluate((el) => {
      const right = el.getBoundingClientRect().right
      return [...el.querySelectorAll('button')]
        .filter((b) => b.getBoundingClientRect().right > right + 0.5)
        .map((b) => b.getAttribute('aria-label'))
    })
    expect(overflow).toEqual([])
    // Guards the guard: the measure found the buttons.
    expect(await bar.getByRole('button').count()).toBeGreaterThanOrEqual(20)

    // The More menu opens a page and closes.
    await openPage(page, 'Formulas')
    await expect(page.getByTestId('page-formulas')).toBeAttached()
    await expect(page.getByRole('menu')).toHaveCount(0)
  })
})
