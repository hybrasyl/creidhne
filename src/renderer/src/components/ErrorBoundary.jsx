import { Component } from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import ReportIssueDialog from './ReportIssueDialog'

// Top-level React error boundary. Mounted OUTSIDE the app's ThemeProvider (in
// main.jsx) so a crash in the themed tree still renders a usable fallback. The
// fallback carries its own ReportIssueDialog instance — the dialog pulls all its
// data over IPC, so it works even when the store/app tree is dead.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, reportOpen: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    try {
      window.electronAPI?.reportRendererError?.({
        source: 'react',
        message: error?.message ? `${error.name || 'Error'}: ${error.message}` : String(error),
        stack: `${error?.stack || ''}${info?.componentStack ? `\n${info.componentStack}` : ''}`
      })
    } catch {
      /* best effort */
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          p: 4,
          textAlign: 'center'
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
          Something went wrong.
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 480 }}>
          The app hit an unexpected error. You can report what happened, or reload to try again.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
          <Button variant="contained" onClick={() => this.setState({ reportOpen: true })}>
            Report Issue
          </Button>
          <Button variant="outlined" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Stack>
        <ReportIssueDialog
          open={this.state.reportOpen}
          onClose={() => this.setState({ reportOpen: false })}
        />
      </Box>
    )
  }
}

export default ErrorBoundary
