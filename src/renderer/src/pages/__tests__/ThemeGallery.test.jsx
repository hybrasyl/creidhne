/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { themesByName } from '@renderer/themes'
import ThemeGallery, { SURVEYED_APPS } from '../ThemeGallery'

const THEME_NAMES = Object.keys(themesByName)

/**
 * The gallery is for review by eye, so this does not hold its ratios to a
 * threshold: the palette and filled-control tests do that. It makes sure that
 * the page renders in each theme and that its measurements run.
 */
describe('ThemeGallery', () => {
  afterEach(cleanup)

  it('names the ten surveyed apps, the website and the template', () => {
    expect(SURVEYED_APPS).toHaveLength(12)
    expect(SURVEYED_APPS).toContain('website')
    expect(SURVEYED_APPS).toContain('template')
  })

  // jsdom recomputes the cascade on each getComputedStyle, and the page holds
  // more than 200 samples and a theme provider per title bar: one theme takes
  // about 5 s alone, more under the full suite. Chromium draws it in about 1 s
  // (e2e/theme-gallery.spec.js). The suite keeps its 5 s default (HTOO-573).
  //
  // Each theme gets 60 s. Under `npm run test:coverage` in the full suite, on
  // an 8-core Linux box, danaan took 34.7 s and grinneal 36.5 s (balor,
  // 2026-10-29). A release workflow runs that command before it builds, and a
  // CI runner can be slower than that box.
  it.each(THEME_NAMES)(
    '%s: renders and measures each sample',
    (name) => {
      render(
        <ThemeProvider theme={themesByName[name]}>
          <ThemeGallery onBack={vi.fn()} />
        </ThemeProvider>
      )
      expect(screen.getByTestId('theme-gallery-page')).toBeDefined()
      const ratios = screen.getAllByTestId('gallery-ratio')
      expect(ratios.length).toBeGreaterThan(100)
      // MUI v9 draws a button through CSS custom properties, which jsdom does not
      // resolve, so jsdom cannot measure one. Chromium can: e2e/theme-gallery.spec.js
      // reads every ratio in the real renderer. Every other sample is measured here.
      const unmeasured = ratios.filter((r) => r.textContent === '?')
      for (const r of unmeasured)
        expect(r.parentElement?.querySelector('.MuiButton-root')).not.toBeNull()
    },
    60_000
  )
})
