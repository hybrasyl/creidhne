/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { Alert, Box, Button, Chip, IconButton } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import { themesByName } from '../index'
import { contrast } from '@renderer/lib/contrast'
import UpdateNotice, { START_DELAY_MS } from '@renderer/components/UpdateNotice'

const THEME_NAMES = Object.keys(themesByName)
const SEVERITIES = ['error', 'warning', 'info', 'success']

/** The colour an element draws its text and icons in. */
const drawn = (el) => getComputedStyle(el).color

/**
 * A filled control draws its contents in its label colour, and the label reads
 * on the fill (HTOO-572).
 *
 * The themes' MuiButton, MuiLink and MuiSvgIcon overrides gave each of those
 * parts an accent of its own, and that beat `color="inherit"`. The house update
 * notice puts "View release" and a close X in a filled info alert, both with
 * `color="inherit"`: in hybrasyl both drew teal on the teal fill (1.59:1), and
 * in grinneal the X was 1.11:1. A contained button's icon took the same accent:
 * danaan's dark gold on its gold fill was 1.34:1. Corvath found all three.
 *
 * The status colours had no rule either. MUI picks a filled label with
 * `getContrastText`, which takes white at 3:1: mundanes' filled info alert was
 * white on `#0288d1` (3.86:1), and a filled `#ff0000` error chip white at 4.00:1
 * (mabon). Labels are normal-sized text, so every check here is 4.5:1.
 */
describe('a filled control', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
    // jsdom has no preload bridge; the update notice reads this one.
    window.electronAPI = {}
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    delete window.electronAPI
  })

  it.each(THEME_NAMES)('%s: the update notice draws its action like its message', async (name) => {
    window.electronAPI.checkForUpdate = vi.fn(async () => ({
      ok: true,
      update: { version: '9.0.0', url: 'https://example.invalid/releases/tag/v9.0.0' }
    }))
    render(
      <ThemeProvider theme={themesByName[name]}>
        <UpdateNotice />
      </ThemeProvider>
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(START_DELAY_MS)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    const alert = screen.getByRole('status')
    const message = drawn(alert)
    expect(drawn(screen.getByText('View release').closest('a')), 'View release').toBe(message)
    expect(drawn(alert.querySelector('.MuiAlert-icon svg')), 'the info icon').toBe(message)
    const close = screen.getByRole('button', { name: 'Close' })
    expect(drawn(close.querySelector('svg')), 'the close X').toBe(message)
  })

  describe.each(THEME_NAMES)('%s', (name) => {
    const theme = themesByName[name]

    it.each(SEVERITIES)('a filled %s alert: the message reads, the icon and X match it', (sev) => {
      render(
        <ThemeProvider theme={theme}>
          <Alert severity={sev} variant="filled" onClose={() => {}}>
            Saved.
          </Alert>
        </ThemeProvider>
      )
      const alert = screen.getByRole('alert')
      const message = drawn(alert)
      const fill = getComputedStyle(alert).backgroundColor
      // MUI's dark label is translucent, so it is drawn over the fill.
      expect(contrast(message, fill, fill), `${message} on ${fill}`).toBeGreaterThanOrEqual(4.5)
      expect(drawn(alert.querySelector('.MuiAlert-icon svg')), 'the icon').toBe(message)
      const close = screen.getByRole('button', { name: 'Close' })
      expect(drawn(close.querySelector('svg')), 'the close X').toBe(message)
    })

    it.each(SEVERITIES)('a standard %s alert draws its icon in the colour MUI gives it', (sev) => {
      render(
        <ThemeProvider theme={theme}>
          <Alert severity={sev}>Saved.</Alert>
        </ThemeProvider>
      )
      const icon = screen.getByRole('alert').querySelector('.MuiAlert-icon')
      expect(drawn(icon.querySelector('svg'))).toBe(drawn(icon))
    })

    it.each(SEVERITIES)('a filled %s chip: the label reads on the fill', (sev) => {
      render(
        <ThemeProvider theme={theme}>
          <Chip data-testid="chip" color={sev} label="stale" />
        </ThemeProvider>
      )
      const chip = getComputedStyle(screen.getByTestId('chip'))
      expect(
        contrast(chip.color, chip.backgroundColor, chip.backgroundColor),
        `${chip.color} on ${chip.backgroundColor}`
      ).toBeGreaterThanOrEqual(4.5)
    })

    it('a contained button draws its icon like its label', () => {
      render(
        <ThemeProvider theme={theme}>
          <Button variant="contained" startIcon={<AddIcon />}>
            New
          </Button>
        </ThemeProvider>
      )
      const button = screen.getByRole('button', { name: 'New' })
      expect(drawn(button.querySelector('svg'))).toBe(drawn(button))
    })

    it.each(['icon', 'text', 'outlined', 'contained'])(
      'a disabled %s button draws its label and icon in the disabled colour',
      (variant) => {
        // The decorated themes give every icon an accent colour on the icon
        // itself, and it beat the disabled colour that MUI sets on the button.
        // In Taliesin a disabled Duplicate button kept its teal icon (HTOO-639).
        render(
          <ThemeProvider theme={theme}>
            <Box data-testid="disabled" sx={{ color: 'action.disabled' }} />
            <Box data-testid="fill" sx={{ bgcolor: 'action.disabledBackground' }} />
            {variant === 'icon' ? (
              <IconButton disabled aria-label="Duplicate">
                <AddIcon />
              </IconButton>
            ) : (
              <Button disabled variant={variant} startIcon={<AddIcon />}>
                Duplicate
              </Button>
            )}
          </ThemeProvider>
        )
        const disabled = drawn(screen.getByTestId('disabled'))
        const button = screen.getByRole('button', { name: 'Duplicate' })
        expect(drawn(button), 'the button').toBe(disabled)
        expect(drawn(button.querySelector('svg')), 'the icon').toBe(disabled)
        // A disabled button loses the accent border, and a contained one the
        // accent fill.
        const grey = getComputedStyle(screen.getByTestId('fill')).backgroundColor
        if (variant === 'outlined')
          expect(getComputedStyle(button).borderTopColor, 'the border').toBe(grey)
        if (variant === 'contained')
          expect(getComputedStyle(button).backgroundColor, 'the fill').toBe(grey)
      }
    )

    it.each(['text', 'outlined', 'contained'])(
      'a %s error button does not draw like a primary one',
      (variant) => {
        // The DA themes' MuiButton root set one colour for every button, so a
        // destructive button drew like any other (HTOO-572). jsdom leaves MUI's
        // own colours as `var(...)`, which it cannot resolve; only a resolved
        // colour is compared. mundanes and dubhaimid have no button override,
        // so MUI draws their colours and Chromium resolves them.
        render(
          <ThemeProvider theme={theme}>
            <Button variant={variant} color="primary">
              Save
            </Button>
            <Button variant={variant} color="error">
              Delete
            </Button>
          </ThemeProvider>
        )
        const look = (name) => {
          const s = getComputedStyle(screen.getByRole('button', { name }))
          return variant === 'contained' ? s.backgroundColor : s.color
        }
        const [primary, error] = [look('Save'), look('Delete')]
        if (primary.startsWith('var(') || error.startsWith('var(')) return
        expect(error, `error ${error}, primary ${primary}`).not.toBe(primary)
      }
    )

    it('an inherit button and icon button take the colour around them', () => {
      render(
        <ThemeProvider theme={theme}>
          <Box data-testid="around" sx={{ color: '#123456' }}>
            <Button color="inherit" startIcon={<AddIcon />}>
              More
            </Button>
            <IconButton color="inherit" aria-label="Shut">
              <CloseIcon />
            </IconButton>
          </Box>
        </ThemeProvider>
      )
      const around = drawn(screen.getByTestId('around'))
      const button = screen.getByRole('button', { name: 'More' })
      expect(drawn(button), 'the button').toBe(around)
      expect(drawn(button.querySelector('svg')), "the button's icon").toBe(around)
      const shut = screen.getByRole('button', { name: 'Shut' })
      expect(drawn(shut.querySelector('svg')), 'the icon button').toBe(around)
    })
  })
})
