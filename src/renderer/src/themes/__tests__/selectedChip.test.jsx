/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ThemeProvider, Chip } from '@mui/material'
import { themesByName } from '../index'

const THEME_NAMES = Object.keys(themesByName)

/** `#rrggbb` as the `rgb(r, g, b)` that getComputedStyle reports. */
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

/**
 * A coloured chip shows its colour (HTOO-355).
 *
 * An app marks a selected chip with `color="primary"`, and a status chip uses
 * `warning` or `success`. Every theme's
 * MuiChip override set a tinted fill and an accent text colour on `root`, and
 * that beat MUI's own fill for every colour: a selected or a warning chip
 * rendered exactly like a plain one, in all six themes. The palette test could
 * not see it, because the palette was right and the component never used it.
 * So this renders the chips and reads what they draw.
 */
describe('a coloured chip', () => {
  afterEach(cleanup)

  it.each(THEME_NAMES)(
    '%s: a selected chip takes the accent, a warning chip its colour',
    (name) => {
      const theme = themesByName[name]
      const { getByTestId } = render(
        <ThemeProvider theme={theme}>
          <Chip data-testid="selected" color="primary" label="on" onClick={() => {}} />
          <Chip data-testid="plain" label="off" onClick={() => {}} />
          <Chip data-testid="warning" color="warning" label="stale" />
        </ThemeProvider>
      )
      const selected = getComputedStyle(getByTestId('selected'))
      const plain = getComputedStyle(getByTestId('plain'))
      expect(selected.backgroundColor).toBe(rgb(theme.palette.primary.main))
      expect(selected.color).toBe(rgb(theme.palette.primary.contrastText))
      expect(selected.backgroundColor).not.toBe(plain.backgroundColor)
      // The same override hid every colour, not only primary: a warning chip
      // (an unbuilt index, a stale file) must not look plain either.
      expect(getComputedStyle(getByTestId('warning')).backgroundColor).toBe(
        rgb(theme.palette.warning.main)
      )
    }
  )
})
