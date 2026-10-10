/**
 * @vitest-environment jsdom
 */
// house module: update-check v1 — change it in the template, then port
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { hybrasylTheme } from '../../themes'
import { appIdentity } from '@shared/appIdentity.js'
import UpdateNotice, { START_DELAY_MS } from '../UpdateNotice'

/**
 * HTOO-65. **This file is the fix as much as the component is.** Both MUI
 * defects shipped in two apps because nothing rendered the component in a test,
 * and the first is invisible from reading the source. JavaScript port of the
 * template's UpdateNotice.test.tsx; Creidhne has no jest-dom, so the assertions
 * read the DOM directly.
 */

const URL_020 = `${appIdentity.releaseUrlPrefix}tag/v0.2.0`
const NEWER = { ok: true, update: { version: '0.2.0', url: URL_020 } }
const DISMISSED_KEY = `${appIdentity.updateKey}:dismissedVersion`

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
  window.electronAPI = {}
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  delete window.electronAPI
})

// **The second advance is load-bearing.** MUI's ClickAwayListener arms itself
// in a `setTimeout(…, 0)` queued when the Snackbar mounts. Until that runs, a
// click away is ignored for the wrong reason, and the clickaway case passes
// against the very defect it exists to catch (measured in creidhne).
async function renderWith(result = NEWER) {
  const check = vi.fn(typeof result === 'function' ? result : async () => result)
  window.electronAPI.checkForUpdate = check
  render(
    <ThemeProvider theme={hybrasylTheme}>
      <UpdateNotice />
    </ThemeProvider>
  )
  await act(async () => {
    await vi.advanceTimersByTimeAsync(START_DELAY_MS)
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
  return check
}

const shown = () => screen.queryByText(/is available/)

describe('UpdateNotice', () => {
  it('waits START_DELAY_MS before it checks, so start is not slowed', async () => {
    const check = vi.fn(async () => NEWER)
    window.electronAPI.checkForUpdate = check
    render(<UpdateNotice />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(START_DELAY_MS - 1)
    })
    expect(check).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(check).toHaveBeenCalledTimes(1)
  })

  it('checks once, with no timer after that', async () => {
    const check = await renderWith()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)
    })
    expect(check).toHaveBeenCalledTimes(1)
  })

  it('names the app and the version, and links to the release', async () => {
    await renderWith()
    expect(screen.getByText(`${appIdentity.productName} 0.2.0 is available.`)).toBeTruthy()
    const link = screen.getByRole('link', { name: /view release/i })
    expect(link.getAttribute('href')).toBe(URL_020)
  })

  it('opens the release as an ordinary external link, not a new IPC', async () => {
    await renderWith()
    const link = screen.getByRole('link', { name: /view release/i })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('has a close button — defect 1', async () => {
    await renderWith()
    expect(screen.getByRole('button', { name: /close/i })).toBeTruthy()
  })

  it('does not close on a click away — defect 2', async () => {
    await renderWith()
    fireEvent.click(document.body)
    expect(shown()).not.toBeNull()
  })

  it('closing it hides that version for good', async () => {
    await renderWith()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(shown()).toBeNull()
    expect(window.localStorage.getItem(DISMISSED_KEY)).toBe('0.2.0')
  })

  it('does not show a version the user closed before', async () => {
    window.localStorage.setItem(DISMISSED_KEY, '0.2.0')
    await renderWith()
    expect(shown()).toBeNull()
  })

  it('shows a newer version than the one the user closed', async () => {
    window.localStorage.setItem(DISMISSED_KEY, '0.1.9')
    await renderWith()
    expect(screen.getByText(/0\.2\.0 is available/)).toBeTruthy()
  })

  it('shows nothing when the app is up to date', async () => {
    await renderWith({ ok: true, update: null })
    expect(shown()).toBeNull()
  })

  it('shows nothing at start when the check could not tell', async () => {
    // A failure at start is not news. The Check for updates button explains it.
    await renderWith({ ok: false, reason: 'offline' })
    expect(shown()).toBeNull()
  })

  it('stays silent when the IPC itself rejects', async () => {
    await renderWith(async () => {
      throw new Error('ipc')
    })
    expect(shown()).toBeNull()
  })
})
