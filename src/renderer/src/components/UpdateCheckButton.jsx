// house module: update-check v1 — change it in the template, then port
import { useState } from 'react'
import { Box, Button, Link, Typography } from '@mui/material'
import { describeFailure } from '@shared/updateVersion.js'
import { appIdentity } from '@shared/appIdentity.js'

/**
 * "Check for updates" (update-check module), on the Settings About card next to
 * the version. JavaScript port of the template's UpdateCheckButton.tsx.
 *
 * It runs the same check as the start-up notice and says what it found, under
 * the button. Unlike the notice, it explains a failure: the user asked. For the
 * same reason it shows a version the user closed in the notice before.
 */
const UpdateCheckButton = ({ currentVersion }) => {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const check = async () => {
    setBusy(true)
    try {
      setResult(await window.electronAPI.checkForUpdate())
    } catch {
      // The IPC itself failed, not the network. Report it as the button's own
      // words rather than a raw error.
      setResult({ ok: false, reason: 'http' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
      <Button variant="outlined" size="small" onClick={check} disabled={busy}>
        {busy ? 'Checking…' : 'Check for updates'}
      </Button>
      {result && (
        <Typography variant="body2" role="status" data-testid="update-check-result">
          {result.ok &&
            result.update === null &&
            `${appIdentity.productName} is up to date (${currentVersion}).`}
          {result.ok && result.update && (
            <>
              {appIdentity.productName} {result.update.version} is available.{' '}
              <Link href={result.update.url} target="_blank" rel="noopener noreferrer">
                View release
              </Link>
            </>
          )}
          {!result.ok && `Could not check for updates. ${describeFailure(result.reason)}`}
        </Typography>
      )}
    </Box>
  )
}

export default UpdateCheckButton
