import { test, expect } from '@playwright/test'
import { launchApp, getMainWindow } from './helpers.js'

// The title bar's real geometry. jsdom does not apply media queries, so a padding
// asserted there passes against a layout no build renders. This reads it from the
// built app instead.
//
// The two platforms differ on purpose (docs/architecture/macos-chrome.md §2):
// macOS keeps the native stoplights inset into an empty bar, padded 78px so
// nothing sits under them; Windows and Linux draw the logo, the name and three
// window buttons, padded 24px — what the bar always rendered, measured before
// the change.

const isMac = process.platform === 'darwin'

test.describe('Title bar', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('has the platform chrome, at the padding it always had', async () => {
    ;({ electronApp } = await launchApp())
    const page = await getMainWindow(electronApp)
    const bar = page.getByTestId('title-bar')
    await expect(bar).toBeVisible()

    const geometry = await bar.evaluate((el) => {
      const cs = getComputedStyle(el)
      const img = el.querySelector('img')
      return {
        pl: cs.paddingLeft,
        pr: cs.paddingRight,
        dragRegion: getComputedStyle(el.closest('header')).getPropertyValue('-webkit-app-region'),
        // From the bar's own edge: the bar starts 1px into the viewport.
        imgLeft: img
          ? Math.round(img.getBoundingClientRect().left - el.getBoundingClientRect().left)
          : null
      }
    })
    // The bar stays a drag region on every platform; on macOS a double-click on it
    // zooms the window natively.
    expect(geometry.dragRegion).toBe('drag')

    if (isMac) {
      expect(geometry).toMatchObject({ pl: '78px', pr: '24px', imgLeft: null })
      await expect(bar.getByText('Creidhne', { exact: true })).toHaveCount(0)
      await expect(bar.getByRole('button')).toHaveCount(0)
    } else {
      expect(geometry).toMatchObject({ pl: '24px', pr: '24px', imgLeft: 24 })
      await expect(bar.getByText('Creidhne', { exact: true })).toBeVisible()
      for (const name of ['Minimize', 'Maximize', 'Close']) {
        await expect(bar.getByRole('button', { name })).toBeVisible()
      }
    }
  })
})
