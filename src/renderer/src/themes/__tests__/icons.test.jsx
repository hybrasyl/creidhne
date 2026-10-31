/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { Box, IconButton } from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import { themesByName } from '../index'

const THEME_NAMES = Object.keys(themesByName)
const COLOURS = ['primary', 'secondary', 'error', 'warning', 'info', 'success', 'action']

/** The colour an element draws its text and icons in. */
const drawn = (el) => getComputedStyle(el).color

/**
 * An icon takes the colour it is given, or the colour around it. The
 * decorated themes set one accent colour on every MUI icon (`MuiSvgIcon`), and
 * it beat both: an icon with `color="error"` drew the accent, and an icon in
 * coloured text drew the accent. Each control then needed a patch of its own
 * to undo it (filledControls, navButtonSx, HTOO-639). Mundanes and Dubhaimid
 * set no icon colour, and their icons were correct.
 */
describe('an icon', () => {
  afterEach(cleanup)

  describe.each(THEME_NAMES)('%s', (name) => {
    const theme = themesByName[name]

    it('with no colour of its own draws the colour around it', () => {
      render(
        <ThemeProvider theme={theme}>
          <Box data-testid="around" sx={{ color: '#123456' }}>
            <StarIcon data-testid="icon" />
          </Box>
        </ThemeProvider>
      )
      expect(drawn(screen.getByTestId('icon'))).toBe(drawn(screen.getByTestId('around')))
    })

    it.each(COLOURS)('with color="%s" draws that palette colour', (colour) => {
      const key = colour === 'action' ? 'action.active' : `${colour}.main`
      render(
        <ThemeProvider theme={theme}>
          <Box data-testid="palette" sx={{ color: key }} />
          <StarIcon data-testid="icon" color={colour} />
        </ThemeProvider>
      )
      expect(drawn(screen.getByTestId('icon'))).toBe(drawn(screen.getByTestId('palette')))
    })

    it('in a coloured icon button draws the button colour', () => {
      render(
        <ThemeProvider theme={theme}>
          <IconButton color="error" aria-label="Delete">
            <StarIcon />
          </IconButton>
        </ThemeProvider>
      )
      const button = screen.getByRole('button', { name: 'Delete' })
      expect(drawn(button.querySelector('svg'))).toBe(drawn(button))
    })
  })
})
