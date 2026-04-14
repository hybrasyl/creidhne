import React, { useState } from 'react';
import { Box, Typography, Select, MenuItem, FormControl, InputLabel, Button, Alert, Link, CircularProgress } from '@mui/material';
import { useRecoilState } from 'recoil';
import { themeState } from '../recoil/atoms';
import ManageLibraries from '../components/ManageLibraries';
import DAClientPathSection from '../components/DAClientPathSection';
import AboutDialog from '../components/AboutDialog';

const THEMES = [
  { value: 'hybrasyl', label: 'Hybrasyl' },
  { value: 'chadul',   label: 'Chadul' },
  { value: 'danaan',   label: 'Danaan' },
  { value: 'grinneal', label: 'Grinneal' },
];

const SettingsPage = ({ libraries, onAddLibrary, onRemoveLibrary }) => {
  const [theme, setTheme] = useRecoilState(themeState);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState(null);

  const handleCheckForUpdates = async () => {
    setUpdateChecking(true);
    setUpdateResult(null);
    try {
      const result = await window.electronAPI.checkForUpdates();
      setUpdateResult(result);
    } catch (err) {
      setUpdateResult({ ok: false, error: err?.message || String(err) });
    } finally {
      setUpdateChecking(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: 'text.button', fontWeight: 'bold' }}>
        Settings
      </Typography>
      <FormControl size="small" sx={{ minWidth: 280, mb: 3 }}>
        <InputLabel>Theme</InputLabel>
        <Select
          value={theme}
          label="Theme"
          onChange={(e) => setTheme(e.target.value)}
        >
          {THEMES.map((t) => (
            <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <ManageLibraries
        libraries={libraries}
        onAddLibrary={onAddLibrary}
        onRemoveLibrary={onRemoveLibrary}
      />
      <DAClientPathSection />
      <Box sx={{ mt: 4, display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button variant="outlined" size="small" onClick={() => setAboutOpen(true)}>
          About Creidhne
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={handleCheckForUpdates}
          disabled={updateChecking}
          startIcon={updateChecking ? <CircularProgress size={14} /> : null}
        >
          {updateChecking ? 'Checking…' : 'Check for updates'}
        </Button>
      </Box>
      {updateResult && (
        <Box sx={{ mt: 2, maxWidth: 560 }}>
          {!updateResult.ok && (
            <Alert severity="warning" onClose={() => setUpdateResult(null)}>
              Update check failed: {updateResult.error}
            </Alert>
          )}
          {updateResult.ok && updateResult.updateAvailable && (
            <Alert severity="info" onClose={() => setUpdateResult(null)}>
              Creidhne {updateResult.latestVersion} is available (you have {updateResult.currentVersion}).{' '}
              <Link href={updateResult.releaseUrl} target="_blank" rel="noopener noreferrer">
                View release
              </Link>
            </Alert>
          )}
          {updateResult.ok && !updateResult.updateAvailable && (
            <Alert severity="success" onClose={() => setUpdateResult(null)}>
              {updateResult.reason === 'no-releases'
                ? 'No published releases yet.'
                : `You're on the latest version (${updateResult.currentVersion}).`}
            </Alert>
          )}
        </Box>
      )}
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </Box>
  );
};

export default SettingsPage;
