import { useCallback, useEffect, useState } from 'react'
import { useStoreValue, taliesinPathState, settingsSavedNonceState } from '../store/appStore'

/**
 * Where Taliesin is, as main resolved it.
 *
 * HTOO-292. Three places offer a Launch button — the toolbar, the Dashboard's
 * Maps cards and the Settings card — and before this they all gated on
 * `taliesinPath` being set. That was wrong in both directions: the button was dead
 * for the usual install, where Taliesin sits beside Creidhne and needs no
 * configuring at all, and it was live for a configured path that had since moved.
 *
 * So the answer comes from main, which is the only side that can look at the disk,
 * the registry or the Applications folder. `taliesinPath` stays in settings as an
 * optional override, and it is this hook's only dependency: **clearing the
 * override has to fall back to discovery visibly**, rather than leaving three
 * buttons describing the answer from before.
 *
 * @returns {{
 *   resolved: { target: string, kind: string, source: string } | null,
 *   staleOverride: boolean,
 *   found: boolean,
 *   refresh: () => void
 * }}
 */
export function useCompanionStatus() {
  const taliesinPath = useStoreValue(taliesinPathState)
  // Main reads the override from settings on disk, so the query has to follow
  // the write rather than the state change that caused it -- App's save effect
  // runs AFTER the effects of the components using this hook.
  const settingsSavedNonce = useStoreValue(settingsSavedNonceState)
  const [status, setStatus] = useState({ resolved: null, staleOverride: false })
  const [nonce, setNonce] = useState(0)

  // For after a launch attempt, which is the moment a target can be discovered to
  // have gone missing.
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    window.electronAPI
      .companionStatus()
      .then((s) => !cancelled && setStatus(s ?? { resolved: null, staleOverride: false }))
      // A failed resolution is "not found", not an error to show: every caller
      // renders the same disabled button either way.
      .catch(() => !cancelled && setStatus({ resolved: null, staleOverride: false }))
    return () => {
      cancelled = true
    }
  }, [taliesinPath, settingsSavedNonce, nonce])

  return { ...status, found: !!status.resolved, refresh }
}

/**
 * How a resolved companion is described. `manual` is the only one the user chose;
 * the other two are things the app worked out, and saying which is the difference
 * between "it works" and "it works for the reason you think".
 */
export const COMPANION_SOURCE_LABEL = {
  manual: 'Selected manually',
  sibling: 'Found next to Creidhne',
  installed: 'Found from the installed application'
}

/**
 * One sentence per failure, because collapsing them to "failed" hides that three
 * of the four are things the user can act on.
 */
export function companionLaunchMessage(result) {
  if (!result) return 'Taliesin could not be started.'
  if (result.ok) {
    return `Launched Taliesin (${(COMPANION_SOURCE_LABEL[result.source] || '').toLowerCase()}).`
  }
  switch (result.reason) {
    case 'stale-override':
      return 'The selected file no longer exists, and Taliesin was not found anywhere else. Choose it again or clear the selection.'
    case 'not-found':
      return 'Taliesin was not found. Install it beside Creidhne, or choose it manually.'
    case 'not-executable':
      return `Taliesin was found at ${result.target} but is not executable.`
    default:
      return `Taliesin could not be started: ${result.message || 'the operating system refused to launch it'}.`
  }
}
