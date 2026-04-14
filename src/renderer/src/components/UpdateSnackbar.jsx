import React, { useEffect, useState } from 'react';
import { Snackbar, Alert, Button, Link } from '@mui/material';

const DISMISS_KEY = 'creidhne:updateDismissedVersion';
const CHECK_DELAY_MS = 3000;

const UpdateSnackbar = () => {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const result = await window.electronAPI.checkForUpdates();
        if (!result?.ok || !result.updateAvailable) return;
        const dismissed = localStorage.getItem(DISMISS_KEY);
        if (dismissed === result.latestVersion) return;
        setInfo(result);
      } catch {
        /* silent — startup check should not disturb user */
      }
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    if (info?.latestVersion) {
      localStorage.setItem(DISMISS_KEY, info.latestVersion);
    }
    setInfo(null);
  };

  if (!info) return null;

  return (
    <Snackbar
      open
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      onClose={handleDismiss}
    >
      <Alert
        severity="info"
        variant="filled"
        onClose={handleDismiss}
        action={
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
        }
      >
        Creidhne {info.latestVersion} is available (you have {info.currentVersion}).
      </Alert>
    </Snackbar>
  );
};

export default UpdateSnackbar;
