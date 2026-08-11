import { describe, it, expect } from 'vitest'
import hybrasylTheme from '../themes/hybrasyl'
import chadulTheme from '../themes/chadul'
import danaanTheme from '../themes/danaan'
import grinnealTheme from '../themes/grinneal'
import mundanesTheme from '../themes/mundanes'
import dubhaimidTheme from '../themes/dubhaimid'

// Imported individually rather than through themes/index.js on purpose: that
// module carries side-effect @fontsource CSS imports, which a node-environment
// test cannot resolve.
const THEMES = {
  hybrasyl: hybrasylTheme,
  chadul: chadulTheme,
  danaan: danaanTheme,
  grinneal: grinnealTheme,
  mundanes: mundanesTheme,
  dubhaimid: dubhaimidTheme
}

// WCAG 2.x relative luminance and contrast ratio.
const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

function luminance(hex) {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('contrast helpers', () => {
  // The assertions below are only worth anything if the maths is right, so pin
  // it against the two ends of the scale before using it.
  it('reports 21:1 for black on white and 1:1 for a colour on itself', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrast('#4d84d1', '#4d84d1')).toBeCloseTo(1, 5)
  })
})

describe('primary.main never collides with background.default (HTOO-341)', () => {
  // The rule, not a threshold. `hybrasyl` had the two byte-for-byte equal, so
  // every control signalling state through `color="primary"` painted itself the
  // page colour — 1.00:1, invisible. It inverted the affordance rather than
  // merely dimming it: a filled Chip takes primary.main as its background while
  // an unselected chip keeps MUI's grey, so the SELECTED one disappeared.
  //
  // Nine picker dialogs also draw their selection as
  // `borderColor: selected ? 'primary.main' : 'transparent'`, so the fault was
  // wider than chips — the selected sprite, icon, sound and portrait had a
  // border the colour of the page behind it.
  for (const [name, theme] of Object.entries(THEMES)) {
    it(`${name}: primary.main !== background.default`, () => {
      expect(theme.palette.primary.main.toLowerCase()).not.toBe(
        theme.palette.background.default.toLowerCase()
      )
    })

    it(`${name}: primary.main is distinguishable from the page`, () => {
      // 1.5:1 is deliberately a floor against the COLLISION, not a WCAG bar.
      // Raising it to the 3:1 non-text threshold is HTOO-355's job, and pinning
      // 3:1 here would fail this suite on themes this card never claimed to fix.
      //
      // Measured against background.default with the fix in place:
      //   dubhaimid 4.72  hybrasyl 4.66  chadul 3.81  grinneal 3.39
      //   mundanes  2.89  danaan   2.39
      // So TWO themes fall below 3:1, not the five HTOO-355's title claims —
      // worth reconciling there, since the threshold or the reference colour it
      // measured against must differ from this.
      expect(
        contrast(theme.palette.primary.main, theme.palette.background.default)
      ).toBeGreaterThan(1.5)
    })
  }
})

describe('hybrasyl primary is legible (HTOO-341)', () => {
  const { primary, background } = hybrasylTheme.palette

  it('primary.main reads against the page', () => {
    expect(contrast(primary.main, background.default)).toBeGreaterThan(4.5)
  })

  it('contrastText on primary.main passes WCAG AA for normal text', () => {
    // Chip and button labels are normal text, so 4.5:1 is the bar. This is why
    // contrastText is deep navy rather than the theme's cream: cream on this
    // blue measures 3.05:1 and fails.
    expect(contrast(primary.contrastText, primary.main)).toBeGreaterThan(4.5)
  })

  it('records why cream was rejected, so it is not reinstated as a "fix"', () => {
    expect(contrast('#f0e6cc', primary.main)).toBeLessThan(4.5)
  })

  it('primary.main is no longer the value that was only used as light', () => {
    expect(primary.light.toLowerCase()).not.toBe(primary.main.toLowerCase())
  })
})
