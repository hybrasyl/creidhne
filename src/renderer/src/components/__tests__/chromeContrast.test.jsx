/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { getLuminance } from '@mui/material/styles'
import { themesByName } from '@renderer/themes'
import { blend, contrast } from '@renderer/lib/contrast'
import { useAppStore } from '../../store/appStore'
import TitleBar from '../TitleBar'
import MainToolbar from '../MainToolbar'
import { BUTTON, CLOSE, PLAIN_CHROME_THEMES, chromeKind } from '../titleChrome'

const THEME_NAMES = Object.keys(themesByName)

/** A palette path (`info.main`) in a theme, or a CSS colour as it is. */
function colourOf(name, value) {
  const [group, key] = value.split('.')
  const palette = themesByName[name].palette
  return key && palette[group]?.[key] ? palette[group][key] : value
}

function renderBar(name) {
  render(
    <ThemeProvider theme={themesByName[name]}>
      <TitleBar
        name="Creidhne"
        icon="creidhne.webp"
        theme={name}
        platform="win32"
        controls={{ minimize: vi.fn(), maximize: vi.fn(), close: vi.fn() }}
      />
    </ThemeProvider>
  )
}

/**
 * The title bar reads against itself (WCAG 1.4.11 for icons, 1.4.3 for text),
 * HTOO-572. It paints `secondary.main`, and its window icons and wordmark take
 * `secondary.contrastText`. A theme's overrides can still change what draws,
 * and the palette alone does not show that, so this renders the real bar and
 * reads the colour each theme draws. Taliesin's chromeContrast test, for the
 * template's one bar. Creidhne's nav bar is the second case, below.
 */
describe('the title bar', () => {
  afterEach(cleanup)

  it.each(THEME_NAMES)('%s: icons are 3:1 and the wordmark 4.5:1 on the bar', (name) => {
    renderBar(name)
    const bar = themesByName[name].palette.secondary.main
    const drawn = (el) => getComputedStyle(el).color
    const icon = drawn(screen.getByRole('button', { name: 'Minimize' }))
    const wordmark = drawn(screen.getByText('Creidhne'))
    expect(contrast(icon, bar), `icon ${icon}`).toBeGreaterThanOrEqual(3)
    expect(contrast(wordmark, bar), `wordmark ${wordmark}`).toBeGreaterThanOrEqual(4.5)
  })

  it.each(THEME_NAMES)('%s: keylines the decorated bar, flattens the plain one', (name) => {
    renderBar(name)
    const shadow = getComputedStyle(screen.getByText('Creidhne')).textShadow
    // jsdom reports `none` as a transparent colour, so the plain case asserts
    // what is absent rather than the keyword.
    if (PLAIN_CHROME_THEMES.includes(name)) expect(shadow).not.toMatch(/#000|rgb\(0, 0, 0\)/)
    else expect(shadow).toMatch(/#000/)
  })

  // jsdom cannot apply :hover, so this reads the hover colours from
  // titleChrome.ts. The decorated close button drew yellow on cyan (1.1:1).
  it.each(THEME_NAMES)('%s: a window button and the close button read on hover', (name) => {
    const bar = themesByName[name].palette.secondary.main
    const kind = chromeKind(name)
    for (const [label, c] of [
      ['window button', BUTTON[kind]],
      ['close button', { ...BUTTON[kind], ...CLOSE }]
    ]) {
      const fill = blend(colourOf(name, c.hoverBackground), bar)
      const glyph = colourOf(name, c.hoverColor)
      expect(contrast(glyph, fill, fill), `${label}: ${glyph} on ${fill}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('gives every decorated bar light text, which the keyline outlines', () => {
    // The #000 keyline outlines LIGHT text. Around dark text it merges with the
    // glyph and doubles its edges, which is why danaan's and grinneal's old light
    // bars needed an engrave. A decorated bar must stay dark, with light text.
    const darkText = THEME_NAMES.filter(
      (n) =>
        !PLAIN_CHROME_THEMES.includes(n) &&
        getLuminance(themesByName[n].palette.secondary.contrastText) < 0.18
    )
    expect(darkText).toEqual([])
  })
})

/** `#rrggbb` as the `rgb(r, g, b)` that getComputedStyle reports. */
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

/**
 * Creidhne's nav bar, under the title bar (MainToolbar.jsx). It paints
 * secondary.main too, so its icons take secondary.contrastText. They drew
 * text.button, a page colour, which was below 2:1 on the Danaan and Mundanes
 * bars, and the current page drew secondary.dark, a dark shade on a dark bar.
 */
describe('the nav bar', () => {
  const initialApp = useAppStore.getState()
  beforeEach(() => {
    window.electronAPI = {
      platform: 'win32',
      companionStatus: vi.fn().mockResolvedValue({ resolved: null, staleOverride: false })
    }
  })
  afterEach(() => {
    cleanup()
    useAppStore.setState(initialApp, true)
    delete window.electronAPI
  })

  it.each(THEME_NAMES)('%s: the bar is secondary.main, and its icons are 3:1 on it', (name) => {
    useAppStore.setState({ theme: name, currentPage: 'items' })
    render(
      <ThemeProvider theme={themesByName[name]}>
        <MainToolbar navigate={vi.fn()} />
      </ThemeProvider>
    )
    const bar = themesByName[name].palette.secondary.main
    // Read, not assumed: a translucent bar (it had `opacity: 0.9`) or a theme
    // override would change what the icons are drawn on.
    expect(getComputedStyle(screen.getByTestId('nav-bar')).backgroundColor).toBe(rgb(bar))
    const drawn = (label) => getComputedStyle(screen.getByRole('button', { name: label })).color
    for (const label of ['Castables', 'Items', 'Settings', 'Report an issue']) {
      const icon = drawn(label)
      expect(contrast(icon, bar), `${label}: ${icon}`).toBeGreaterThanOrEqual(3)
    }
    // The current page (Items) keeps the bar's text colour, on a light wash.
    const wash = blend('rgba(255,255,255,0.12)', bar)
    expect(contrast(drawn('Items'), wash), 'the current page').toBeGreaterThanOrEqual(3)
  })
})
