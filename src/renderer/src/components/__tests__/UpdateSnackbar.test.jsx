/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react'
import UpdateSnackbar from '../UpdateSnackbar'

/**
 * HTOO-65. **This file is the fix as much as the component is.** Both defects it
 * covers shipped because nothing rendered this component in a test, and the first of
 * them is invisible from reading the source: MUI's `Alert` renders its own X only
 * when `onClose` is set and `action` is absent, so passing both looks correct and
 * produces no close button. `getByRole('button', { name: /close/i })` is what
 * surfaced it, in epona, while porting this implementation.
 *
 * It is also Creidhne's first component test (HTOO-144). The suite's default
 * environment stays `node` — almost every test here is a pure-function test that
 * would only pay for a DOM it never touches — so the environment is opted into per
 * file with the docblock above.
 */

const DISMISS_KEY = 'creidhne:updateDismissedVersion'
const CHECK_DELAY_MS = 3000

const UPDATE = {
  ok: true,
  updateAvailable: true,
  latestVersion: '1.11.0',
  currentVersion: '1.10.0',
  releaseUrl: 'https://github.com/hybrasyl/creidhne/releases/tag/v1.11.0'
}

// The check is on a 3s timer, so every case has to run the clock. Fake timers rather
// than a real wait: a 3s pause per case is the whole suite's runtime again.
//
// **The second flush is load-bearing, and leaving it out is a silent false pass.**
// MUI's ClickAwayListener arms itself in a `setTimeout(…, 0)` — it must not be
// "activated" synchronously, per facebook/react#20074 — and that timer is queued when
// the Snackbar mounts, which is *after* the first flush resolves the check. Under fake
// timers it would otherwise never run, so `handleClickAway` returns early on
// `!activatedRef.current` and the clickaway case below passes against the defect it
// exists to catch. Measured: without this line that test passes on the ORIGINAL
// component too.
async function renderAndCheck(result = UPDATE) {
  window.electronAPI = { checkForUpdates: vi.fn().mockResolvedValue(result) }
  render(<UpdateSnackbar />)
  await act(async () => {
    vi.advanceTimersByTime(CHECK_DELAY_MS)
  })
  await act(async () => {
    vi.advanceTimersByTime(1)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('UpdateSnackbar', () => {
  it('renders the update message once the check reports one', async () => {
    await renderAndCheck()
    expect(screen.getByText(/1\.11\.0 is available/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /view release/i }).getAttribute('href')).toBe(
      UPDATE.releaseUrl
    )
  })

  it('has a close button — defect 1', async () => {
    // The assertion whose absence let this ship. `Alert` renders its own X only when
    // `onClose` is set AND `action` is absent; the old code passed both, so the X was
    // never rendered even though the handler existed. Reading the source does not show
    // that. Rendering it does.
    await renderAndCheck()
    expect(screen.getByRole('button', { name: /close/i })).toBeTruthy()
  })

  it('writes the per-version dismissal when the close button is used', async () => {
    await renderAndCheck()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(localStorage.getItem(DISMISS_KEY)).toBe('1.11.0')
    expect(screen.queryByText(/is available/)).toBeNull()
  })

  it('does not show a version the user already dismissed', async () => {
    localStorage.setItem(DISMISS_KEY, '1.11.0')
    await renderAndCheck()
    expect(screen.queryByText(/is available/)).toBeNull()
  })

  it('still shows a NEWER version than the one dismissed', async () => {
    // The key is per version on purpose: dismissing 1.11.0 must not silence 1.12.0.
    localStorage.setItem(DISMISS_KEY, '1.11.0')
    await renderAndCheck({ ...UPDATE, latestVersion: '1.12.0' })
    expect(screen.getByText(/1\.12\.0 is available/)).toBeTruthy()
  })

  it('does not write the dismissal on a clickaway — defect 2', async () => {
    // With `onClose` on the Snackbar and no `autoHideDuration`, MUI fires the handler
    // for a click anywhere in the window. The old handler wrote the per-version key,
    // so a stray click suppressed the banner for that release permanently — and
    // because of defect 1 it was the ONLY way to dismiss it. The banner may close;
    // the key may not be written.
    await renderAndCheck()
    fireEvent.click(document.body)
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull()
  })

  it('renders nothing when there is no update', async () => {
    await renderAndCheck({ ok: true, updateAvailable: false })
    expect(screen.queryByText(/is available/)).toBeNull()
  })

  it('stays silent when the check fails', async () => {
    // A startup check must not disturb the user. A failed request is not news.
    window.electronAPI = { checkForUpdates: vi.fn().mockRejectedValue(new Error('offline')) }
    render(<UpdateSnackbar />)
    await act(async () => {
      vi.advanceTimersByTime(CHECK_DELAY_MS)
    })
    expect(screen.queryByText(/is available/)).toBeNull()
  })

  it('does not check at all if it unmounts before the delay', async () => {
    // The timer is cleared on unmount. Without that, a check fires against a
    // component that is gone, and React warns about the state update.
    const checkForUpdates = vi.fn().mockResolvedValue(UPDATE)
    window.electronAPI = { checkForUpdates }
    const { unmount } = render(<UpdateSnackbar />)
    unmount()
    await act(async () => {
      vi.advanceTimersByTime(CHECK_DELAY_MS)
    })
    expect(checkForUpdates).not.toHaveBeenCalled()
  })
})
