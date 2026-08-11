import { useEffect, useState } from 'react'
import { Snackbar, Alert, Button, Link, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

const DISMISS_KEY = 'creidhne:updateDismissedVersion'
const CHECK_DELAY_MS = 3000

/**
 * HTOO-65. Two defects, found by epona porting this implementation, and they hid
 * each other:
 *
 * 1. **The banner had no close button.** `Alert` renders its own X only when
 *    `onClose` is set AND `action` is absent — `action` replaces it. This passed
 *    both, so the X was never rendered even though the handler existed.
 * 2. **Clickaway wrote the permanent dismissal.** `Snackbar` with `onClose` and no
 *    `autoHideDuration` fires the handler for a click anywhere in the window, and
 *    the handler stores the per-version key. So a stray click killed the banner for
 *    that release forever. Because of defect 1 it was the *only* way to dismiss it.
 *
 * The fix is epona's: ignore `clickaway`, and render both controls inside `action`
 * so the close button is ours rather than something MUI decides to add.
 */
const UpdateSnackbar = () => {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const result = await window.electronAPI.checkForUpdates()
        if (!result?.ok || !result.updateAvailable) return
        const dismissed = localStorage.getItem(DISMISS_KEY)
        if (dismissed === result.latestVersion) return
        setInfo(result)
      } catch {
        /* silent — startup check should not disturb user */
      }
    }, CHECK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  // Dismissal is PERMANENT for this version, so only a deliberate act may reach it.
  const handleDismiss = () => {
    if (info?.latestVersion) {
      localStorage.setItem(DISMISS_KEY, info.latestVersion)
    }
    setInfo(null)
  }

  // `reason` is `clickaway`, `timeout` or `escapeKeyDown`. Only the close button
  // calls handleDismiss directly; everything routed through here is incidental, and
  // must not write a key that suppresses the banner for good.
  const handleSnackbarClose = (_event, reason) => {
    if (reason === 'clickaway') return
    setInfo(null)
  }

  if (!info) return null

  return (
    <Snackbar
      open
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      onClose={handleSnackbarClose}
    >
      <Alert
        severity="info"
        variant="filled"
        action={
          <>
            <Button
              color="inherit"
              size="small"
              component={Link}
              href={info.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View release
            </Button>
            <IconButton
              size="small"
              color="inherit"
              aria-label="Close"
              onClick={handleDismiss}
              sx={{ ml: 0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
      >
        Creidhne {info.latestVersion} is available (you have {info.currentVersion}).
      </Alert>
    </Snackbar>
  )
}

export default UpdateSnackbar
