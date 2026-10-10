// house module: update-check v1 — change it in the template, then port
import { useEffect, useState } from 'react'
import { Snackbar, Alert, Button, IconButton, Link } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { appIdentity } from '@shared/appIdentity.js'

/**
 * "A newer version exists" notice (HTOO-65, update-check module). JavaScript port
 * of the template's UpdateNotice.tsx. It replaces UpdateSnackbar, which read
 * GitHub's releases API.
 *
 * The check runs once, `START_DELAY_MS` after the app mounts, so it does not
 * compete with start. There is no timer after that; the Check for updates
 * button covers the rest (Sabrael, 2026-09-28). A failure is not news at start,
 * so it shows nothing; the button is where a failure is explained.
 *
 * **The link is an ordinary `target="_blank"` anchor, deliberately.**
 * `hardenWindow`'s window-open handler denies the child window and passes the
 * URL through `isSafeExternalUrl` before `shell.openExternal` sees it. A new IPC
 * for this would route around a guard that exists. The URL was also checked
 * against `appIdentity.releaseUrlPrefix` in main.
 *
 * **Two MUI traps, found by epona porting creidhne's copy.** Both are pinned by
 * the test:
 *
 * 1. `Alert` renders its own close X only when `onClose` is set AND `action` is
 *    absent; `action` REPLACES it. So both controls live inside `action`.
 * 2. `Snackbar` with `onClose` and no `autoHideDuration` fires the handler for a
 *    click anywhere in the window (`reason === 'clickaway'`). That reason is
 *    ignored; the close button and Escape still close it.
 *
 * **Closing it hides that version for good** (Sabrael, 2026-09-28). The version
 * is stored in localStorage; the notice returns only for a newer one. If the
 * store is empty or blocked, the notice shows again, which is the safe error.
 */

export const START_DELAY_MS = 10_000

const dismissedKey = `${appIdentity.updateKey}:dismissedVersion`

function readDismissed() {
  try {
    return window.localStorage.getItem(dismissedKey)
  } catch {
    return null
  }
}

function writeDismissed(version) {
  try {
    window.localStorage.setItem(dismissedKey, version)
  } catch {
    // Blocked storage: the notice returns next start, which is acceptable.
  }
}

const UpdateNotice = () => {
  const [update, setUpdate] = useState(null)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      window.electronAPI
        .checkForUpdate()
        .then((result) => {
          if (cancelled || !result?.ok || !result.update) return
          if (readDismissed() === result.update.version) return
          setUpdate(result.update)
        })
        // Main never rejects on a network failure; this covers the IPC itself.
        .catch(() => undefined)
    }, START_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  if (!update) return null

  const dismiss = () => {
    writeDismissed(update.version)
    setUpdate(null)
  }

  // `reason` is `clickaway`, `timeout` or `escapeKeyDown`. A click elsewhere in
  // the window is incidental, so it does not close the notice.
  const handleSnackbarClose = (_event, reason) => {
    if (reason === 'clickaway') return
    dismiss()
  }

  return (
    <Snackbar
      open
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      onClose={handleSnackbarClose}
    >
      <Alert
        severity="info"
        variant="filled"
        role="status"
        action={
          <>
            <Button
              color="inherit"
              size="small"
              component={Link}
              href={update.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              View release
            </Button>
            <IconButton
              size="small"
              color="inherit"
              aria-label="Close"
              onClick={dismiss}
              sx={{ ml: 0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
      >
        {appIdentity.productName} {update.version} is available.
      </Alert>
    </Snackbar>
  )
}

export default UpdateNotice
