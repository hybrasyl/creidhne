/**
 * @vitest-environment jsdom
 */
// house module: title-bar v1 — change it in the template, then port
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import StarIcon from '@mui/icons-material/Star'
import { themesByName } from '@renderer/themes'
import TitleBar, { ChromeButton } from '../TitleBar'

function renderBar(props = {}) {
  const controls = props.controls ?? {
    minimize: vi.fn(),
    maximize: vi.fn(),
    close: vi.fn()
  }
  const theme = props.theme ?? 'hybrasyl'
  render(
    <ThemeProvider theme={themesByName[theme]}>
      <TitleBar
        name="Sample"
        icon="sample.webp"
        theme={theme}
        platform="win32"
        {...props}
        controls={controls}
      />
    </ThemeProvider>
  )
  return controls
}

// Creidhne has no jest-dom, so the assertions read the DOM directly, and
// vitest has no globals, so each test cleans up its own render.
describe('TitleBar', () => {
  afterEach(cleanup)

  it('draws the name and the icon it is given', () => {
    renderBar()
    const bar = screen.getByTestId('title-bar')
    expect(bar.textContent).toContain('Sample')
    expect(bar.querySelector('img')?.getAttribute('src')).toBe('sample.webp')
  })

  it('calls the window controls it is given', async () => {
    const user = userEvent.setup()
    const controls = renderBar()
    await user.click(screen.getByRole('button', { name: 'Minimize' }))
    await user.click(screen.getByRole('button', { name: 'Maximize' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(controls.minimize).toHaveBeenCalledOnce()
    expect(controls.maximize).toHaveBeenCalledOnce()
    expect(controls.close).toHaveBeenCalledOnce()
  })

  it('draws no Maximize button for a window of a fixed size', () => {
    renderBar({ controls: { minimize: vi.fn(), close: vi.fn() } })
    expect(screen.queryByRole('button', { name: 'Maximize' })).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it("puts the app's controls between the wordmark and the window buttons", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <ThemeProvider theme={themesByName.hybrasyl}>
        <TitleBar
          name="Sample"
          icon="sample.webp"
          theme="hybrasyl"
          platform="win32"
          controls={{ minimize: vi.fn(), close: vi.fn() }}
        >
          <ChromeButton label="Favourites" onClick={onClick}>
            <StarIcon />
          </ChromeButton>
        </TitleBar>
      </ThemeProvider>
    )
    const buttons = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(buttons).toEqual(['Favourites', 'Minimize', 'Close'])
    await user.click(screen.getByRole('button', { name: 'Favourites' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it.each(Object.keys(themesByName))('%s: a ChromeButton draws like a window button', (theme) => {
    render(
      <ThemeProvider theme={themesByName[theme]}>
        <TitleBar
          name="Sample"
          icon="sample.webp"
          theme={theme}
          platform="win32"
          controls={{ minimize: vi.fn(), close: vi.fn() }}
        >
          <ChromeButton label="Favourites">
            <StarIcon />
          </ChromeButton>
        </TitleBar>
      </ThemeProvider>
    )
    const drawn = (name) => getComputedStyle(screen.getByRole('button', { name })).color
    expect(drawn('Favourites')).toBe(drawn('Minimize'))
  })

  it("draws no window buttons, name or logo on macOS, and keeps the app's controls", () => {
    render(
      <ThemeProvider theme={themesByName.hybrasyl}>
        <TitleBar
          name="Sample"
          icon="sample.webp"
          theme="hybrasyl"
          platform="darwin"
          controls={{ minimize: vi.fn(), maximize: vi.fn(), close: vi.fn() }}
        >
          <ChromeButton label="Favourites">
            <StarIcon />
          </ChromeButton>
        </TitleBar>
      </ThemeProvider>
    )
    const bar = screen.getByTestId('title-bar')
    expect(bar.textContent).not.toContain('Sample')
    expect(bar.querySelector('img')).toBeNull()
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Favourites'
    ])
  })
})
