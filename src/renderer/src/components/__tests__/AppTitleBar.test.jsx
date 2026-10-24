/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { hybrasylTheme } from '@renderer/themes'
import { appIdentity } from '@shared/appIdentity.js'
import { useAppStore } from '../../store/appStore'
import AppTitleBar from '../AppTitleBar'

// jsdom has no preload bridge, so each test gets a fresh one. jsdom does not
// apply media queries, so the bar's padding is checked in e2e/title-bar.spec.js.
function bridge(platform) {
  window.electronAPI = {
    platform,
    minimizeWindow: vi.fn(),
    maximizeWindow: vi.fn(),
    closeWindow: vi.fn()
  }
}

function renderAppTitleBar() {
  render(
    <ThemeProvider theme={hybrasylTheme}>
      <AppTitleBar />
    </ThemeProvider>
  )
}

const initialApp = useAppStore.getState()

/** Creidhne's wiring of the house TitleBar: its name, its icon, and the preload bridge. */
describe('AppTitleBar', () => {
  beforeEach(() => {
    useAppStore.setState(initialApp, true)
    bridge('win32')
  })
  afterEach(() => {
    cleanup()
    delete window.electronAPI
  })

  it("shows the app's product name and its icon", () => {
    renderAppTitleBar()
    const bar = screen.getByTestId('title-bar')
    expect(bar.textContent).toContain(appIdentity.productName)
    expect(bar.querySelector('img')).not.toBeNull()
  })

  it('wires the three window buttons to the preload bridge', async () => {
    const user = userEvent.setup()
    renderAppTitleBar()

    await user.click(screen.getByRole('button', { name: 'Minimize' }))
    expect(window.electronAPI.minimizeWindow).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Maximize' }))
    expect(window.electronAPI.maximizeWindow).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(window.electronAPI.closeWindow).toHaveBeenCalledOnce()
  })

  it('takes the plain chrome for a corporate theme in the store', () => {
    // The kind follows the store's theme, so a decorated theme shows the game
    // glyphs and a corporate one the flat MUI icons.
    useAppStore.setState({ theme: 'mundanes' })
    renderAppTitleBar()
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close.querySelector('[data-testid="CloseIcon"]')).not.toBeNull()
  })

  it('on macOS: an empty drag region for the stoplights, with no logo, name or buttons', () => {
    bridge('darwin')
    renderAppTitleBar()
    const bar = screen.getByTestId('title-bar')
    expect(bar.querySelector('img')).toBeNull()
    expect(bar.textContent).not.toContain(appIdentity.productName)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
