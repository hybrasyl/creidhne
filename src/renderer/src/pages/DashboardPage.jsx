import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useRecoilValue } from 'recoil';
import { themeState, librariesState, activeLibraryState } from '../recoil/atoms';

function DashboardPage() {
  const [settingsPath, setSettingsPath] = useState('');
  const theme = useRecoilValue(themeState); // Get the current theme
  const libraries = useRecoilValue(librariesState); // Get the libraries
  const activeLibrary = useRecoilValue(activeLibraryState); // Get the active library

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
      <Typography variant="body1" color="white" sx={{ mt: 2 }}>
        Current Theme: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
      </Typography>
      <Typography variant="body1" color="white" sx={{ mt: 2 }}>
        Libraries:
        <Box component="ul" sx={{ pl: 2 }}>
          {libraries.length > 0 ? (
            libraries.map((library, index) => (
              <Typography key={index} component="li">
                {library}
              </Typography>
            ))
          ) : (
            <Typography>No libraries added</Typography>
          )}
        </Box>
      </Typography>
      {activeLibrary && (
        <Typography variant="body1" color="white" sx={{ mt: 2 }}>
          Active Library: {activeLibrary}
        </Typography>
      )}
    </Box>
  );
}

export default DashboardPage;
