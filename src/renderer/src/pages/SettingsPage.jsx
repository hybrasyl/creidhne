import React from 'react';
import { Box, Typography, Switch, FormControlLabel, Tooltip } from '@mui/material';
import ManageLibraries from '../components/ManageLibraries'; 

const SettingsPage = ({ onToggleTheme, isDarkMode, libraries, onAddLibrary, onRemoveLibrary }) => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{color: "text.button", fontWeight: 'bold'}}>
        Settings
      </Typography>
      <Tooltip title="Toggle between Light and Dark Mode">
        <FormControlLabel
          control={<Switch checked={isDarkMode} onChange={onToggleTheme} color="secondary" />}
          label={isDarkMode ? 'Dark Mode' : 'Light Mode'}
          sx={{color: "text.button"}}
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

