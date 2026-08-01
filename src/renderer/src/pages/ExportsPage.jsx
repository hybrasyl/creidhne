import { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  Stack
} from '@mui/material'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import { useStoreValue, activeLibraryState } from '../store/appStore'

// The three castable exports are one canonical record rendered through three
// presets (see src/shared/castableExportPresets.js). The suggested file name
// comes back from main with the content, so the preset stays the single place
// that names its output.
const CASTABLE_EXPORTS = [
  {
    id: 'balancing',
    label: 'Balancing CSV',
    blurb:
      'Every castable, including test and GM abilities, with the full column set. For balancing and hand review in Excel.',
    run: (library) => window.electronAPI.exportCastablesBalancingCsv(library)
  },
  {
    id: 'webCsv',
    label: 'Web CSV',
    blurb:
      'The column set the Hybrasyl website ability browser reads. Test and GM abilities excluded.',
    run: (library) => window.electronAPI.exportCastablesWebCsv(library)
  },
  {
    id: 'webJson',
    label: 'Web JSON',
    blurb: 'The same web-facing data as JSON. Test and GM abilities excluded.',
    run: (library) => window.electronAPI.exportCastablesWebJson(library)
  }
]

function ExportsPage() {
  const activeLibrary = useStoreValue(activeLibraryState)
  const [status, setStatus] = useState(null) // { type: 'success'|'error'|'info', message: string }
  // The id of the export currently running, or null. A single boolean used to
  // spin every button at once, which read as though all of them were exporting.
  const [busy, setBusy] = useState(null)

  const handleExport = async (exportDef) => {
    if (!activeLibrary) {
      setStatus({
        type: 'error',
        message: 'No library selected. Open a library from Settings first.'
      })
      return
    }
    setBusy(exportDef.id)
    setStatus(null)
    try {
      const result = await exportDef.run(activeLibrary)
      if (result.error) {
        setStatus({ type: 'error', message: result.error })
        return
      }
      const save = await window.electronAPI.saveFile(result.defaultName, result.content)
      if (save.canceled) {
        setStatus({ type: 'info', message: 'Export cancelled.' })
      } else {
        setStatus({ type: 'success', message: `Exported successfully to ${save.filePath}` })
      }
    } catch (e) {
      setStatus({ type: 'error', message: `Export failed: ${e.message}` })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 600 }}>
      <Typography variant="h5" gutterBottom>
        Exports
      </Typography>
      <Divider sx={{ mb: 3 }} />
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Castables
        </Typography>
        <Stack spacing={2}>
          {CASTABLE_EXPORTS.map((exportDef) => (
            <Box key={exportDef.id}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                {exportDef.blurb}
              </Typography>
              <Button
                variant="contained"
                startIcon={
                  busy === exportDef.id ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <FileDownloadIcon />
                  )
                }
                onClick={() => handleExport(exportDef)}
                disabled={busy !== null}
              >
                {exportDef.label}
              </Button>
            </Box>
          ))}
        </Stack>
      </Paper>
      {status && (
        <Alert severity={status.type} onClose={() => setStatus(null)}>
          {status.message}
        </Alert>
      )}
    </Box>
  )
}

export default ExportsPage
