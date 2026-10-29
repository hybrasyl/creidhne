import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { launchApp, getMainWindow } from './helpers.js'

// The theme gallery's audit, in the real renderer (HTOO-572).
//
// The gallery shows a measured contrast under each sample. jsdom cannot
// measure a button, because MUI v9 draws buttons through CSS custom
// properties, which jsdom does not resolve. Chromium does. So this opens the
// gallery, selects each theme in turn, and reads every ratio.
//
// It does not fail on a ratio below its threshold. The gallery is for review
// by eye, and the review decides which values change. It fails when a sample
// cannot be measured, and it writes every low ratio to `theme-gallery.json`
// in the test's output folder, with its section, row, sample and surface.
//
// Creidhne opens the gallery from Settings → Appearance → Theme gallery. Its
// theme picker names two themes with a suffix, so each entry has the radio's
// name and the theme's `data-theme` value (MainLayout sets it on app-root).

const THEMES = [
  ['Hybrasyl', 'hybrasyl'],
  ['Chadul', 'chadul'],
  ['Danaan', 'danaan'],
  ['Grinneal', 'grinneal'],
  ['Mundanes (light)', 'mundanes'],
  ['Dubhaimid (dark)', 'dubhaimid']
]

test('the theme gallery measures every sample in every theme', async () => {
  const testInfo = test.info()
  const { electronApp } = await launchApp()
  try {
    const page = await getMainWindow(electronApp)
    await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
    await page.getByRole('button', { name: 'Theme gallery', exact: true }).click()
    await expect(page.getByTestId('theme-gallery-page')).toBeVisible()

    const report = {}
    for (const [label, name] of THEMES) {
      await page.getByRole('radio', { name: label, exact: true }).click()
      await expect(page.getByTestId('app-root')).toHaveAttribute('data-theme', name)
      // The badges measure again 400 ms after the theme changes (SETTLE_MS).
      await page.waitForTimeout(800)

      const result = await page.evaluate(() => {
        const badges = [...document.querySelectorAll('[data-testid="gallery-ratio"]')]
        const describe = (badge) => {
          const sample = badge.parentElement.firstElementChild
          const name =
            sample.textContent.trim() ||
            sample.getAttribute('aria-label') ||
            sample.querySelector('[aria-label]')?.getAttribute('aria-label') ||
            [...sample.classList].find((c) => /^Mui\w+-color/.test(c)) ||
            sample.tagName.toLowerCase()
          const section = badge.closest('section')?.querySelector('h6')?.textContent
          const row = badge.closest('div')?.parentElement?.querySelector('.MuiTypography-caption')
          const surface = badge.closest('[data-surface]')?.dataset.surface ?? 'bar'
          return {
            section,
            row: row?.textContent,
            sample: name,
            surface,
            ratio: badge.textContent
          }
        }
        return {
          total: badges.length,
          unmeasured: badges.filter((b) => b.textContent === '?').map(describe),
          low: badges.filter((b) => b.dataset.pass === 'false').map(describe)
        }
      })
      report[name] = result
      expect(result.total, `${label}: samples`).toBeGreaterThan(100)
      expect(result.unmeasured, `${label}: unmeasured samples`).toEqual([])
    }

    const out = testInfo.outputPath('theme-gallery.json')
    writeFileSync(out, JSON.stringify(report, null, 2))
    await testInfo.attach('theme-gallery', { path: out, contentType: 'application/json' })
  } finally {
    await electronApp.close()
  }
})
