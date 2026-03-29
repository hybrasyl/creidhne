import React, { useState } from 'react';
import { Box, Typography, Button, Alert, CircularProgress, Paper, Divider } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useRecoilValue } from 'recoil';
import { activeLibraryState } from '../recoil/atoms';

function ExportsPage() {
  const activeLibrary = useRecoilValue(activeLibraryState);
  const [status, setStatus] = useState(null); // { type: 'success'|'error'|'info', message: string }
  const [loading, setLoading] = useState(false);

  const handleExportCastables = async () => {
    if (!activeLibrary) {
      setStatus({ type: 'error', message: 'No library selected. Open a library from Settings first.' });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const result = await window.electronAPI.exportCastablesCSV(activeLibrary);
      if (result.error) {
        setStatus({ type: 'error', message: result.error });
        return;
      }
      const save = await window.electronAPI.saveFile('castables.csv', result.csv);
      if (save.canceled) {
        setStatus({ type: 'info', message: 'Export cancelled.' });
      } else {
        setStatus({ type: 'success', message: `Exported successfully to ${save.filePath}` });
      }
    } catch (e) {
      setStatus({ type: 'error', message: `Export failed: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600 }}>
      <Typography variant="h5" gutterBottom>Exports</Typography>
      <Divider sx={{ mb: 3 }} />

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Castables CSV
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Exports all castables (excluding test and GM abilities) to a CSV for the Hybrasyl website ability browser.
          Includes name, icon, description, class, subclass, trainer location, stat requirements, materials, cast cost, and cooldown.
        </Typography>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />}
          onClick={handleExportCastables}
          disabled={loading}
        >
          Export Castables CSV
        </Button>
      </Paper>

      {status && (
        <Alert severity={status.type} onClose={() => setStatus(null)}>
          {status.message}
        </Alert>
      )}
    </Box>
  );
}

export default ExportsPage;
