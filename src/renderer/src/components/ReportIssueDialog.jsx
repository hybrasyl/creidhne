import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  Snackbar,
  Alert
} from '@mui/material'
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'

// Compose the issue body: the user's description, then the (edited) diagnostics in
// a fenced block so GitHub renders it as preformatted text.
function composeBody(description, diagnostics) {
  return `${description.trim()}\n\n\`\`\`\n${diagnostics}\n\`\`\``
}

const ReportIssueDialog = ({ open, onClose }) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [diagnostics, setDiagnostics] = useState('')
  const [feedback, setFeedback] = useState(null) // { message, severity }

  // Fetch the scrubbed diagnostics block each time the dialog opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    window.electronAPI
      ?.buildDiagnostics?.()
      .then((block) => {
        if (!cancelled) setDiagnostics(block ?? '')
      })
      .catch(() => {
        if (!cancelled) setDiagnostics('(diagnostics unavailable)')
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const handleOpenIssue = async () => {
    try {
      const result = await window.electronAPI.openIssue({
        title: title.trim() || 'Issue report',
        body: composeBody(description, diagnostics)
      })
      setFeedback({
        message: result?.truncated
          ? 'Issue opened in your browser — the full report was copied to your clipboard (paste it in if truncated).'
          : 'Issue opened in your browser — the full report was also copied to your clipboard.',
        severity: 'success'
      })
    } catch {
      setFeedback({ message: 'Could not open the issue page.', severity: 'error' })
    }
  }

  const handleCopy = async () => {
    try {
      await window.electronAPI.copyReport({ body: composeBody(description, diagnostics) })
      setFeedback({ message: 'Report copied to clipboard.', severity: 'success' })
    } catch {
      setFeedback({ message: 'Could not copy the report.', severity: 'error' })
    }
  }

  const handleRevealLogs = () => {
    window.electronAPI?.revealLogs?.()
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>
          Report an Issue
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Describe what happened. A small diagnostics block is attached below — it is already
            scrubbed of usernames, file paths, and other identifying details. Review or edit it
            before sending.
          </Typography>

          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
          />
          <TextField
            label="What happened?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={4}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Diagnostics (editable)"
            value={diagnostics}
            onChange={(e) => setDiagnostics(e.target.value)}
            fullWidth
            multiline
            minRows={4}
            slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: '0.8rem' } } }}
          />

          <Box sx={{ mt: 2 }}>
            <Button
              variant="text"
              size="small"
              startIcon={<FolderOpenIcon />}
              onClick={handleRevealLogs}
            >
              Reveal logs folder
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} size="small">
            Close
          </Button>
          <Button size="small" startIcon={<ContentCopyIcon />} onClick={handleCopy}>
            Copy to clipboard
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<BugReportOutlinedIcon />}
            onClick={handleOpenIssue}
          >
            Open GitHub issue
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!feedback}
        autoHideDuration={6000}
        onClose={() => setFeedback(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={feedback?.severity ?? 'info'}
          onClose={() => setFeedback(null)}
          sx={{ width: '100%' }}
        >
          {feedback?.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default ReportIssueDialog
