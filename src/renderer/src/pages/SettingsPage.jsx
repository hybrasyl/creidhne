import React from 'react';
import { Box, Typography, Switch, FormControlLabel, Tooltip } from '@mui/material';
import { useRecoilState } from 'recoil';
import { themeState } from '../recoil/atoms';
import ManageLibraries from '../components/ManageLibraries'; 

const SettingsPage = ({ libraries, onAddLibrary, onRemoveLibrary }) => {
  // Use Recoil state for managing theme
  const [isDarkMode, setIsDarkMode] = useRecoilState(themeState);

  const handleToggleTheme = () => {
    setIsDarkMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: "text.button", fontWeight: 'bold' }}>
        Settings
      </Typography>
      <Tooltip title="Toggle between Light and Dark Mode">
        <FormControlLabel
          control={<Switch checked={isDarkMode === 'dark'} onChange={handleToggleTheme} color="secondary" />}
          label={isDarkMode === 'dark' ? 'Dark Mode' : 'Light Mode'}
          sx={{ color: "text.button" }}
        />
      </Tooltip>
      <ManageLibraries 
        libraries={libraries}
        onAddLibrary={onAddLibrary}
        onRemoveLibrary={onRemoveLibrary}
      />
    </Box>
  );
};

export default SettingsPage;
