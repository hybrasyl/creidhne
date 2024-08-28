import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';

function DashboardPage() {
  const [settingsPath, setSettingsPath] = useState('');

  useEffect(() => {
    async function fetchSettingsPath() {
      try {
        const path = await window.electronAPI.getUserDataPath();
        setSettingsPath(path);
      } catch (error) {
        console.error('Failed to get settings path:', error);
      }
    }

    fetchSettingsPath();
  }, []);

  return (
    <Box sx={{ bgcolor: 'darkgreen', p: 2 }}>
      <Typography variant="h4" color="white">
        Welcome to the Dashboard
      </Typography>
      {settingsPath && (
        <Typography variant="body1" color="white" sx={{ mt: 2 }}>
          Settings Path: {settingsPath}
        </Typography>
      )}
    </Box>
  );
}

export default DashboardPage;
