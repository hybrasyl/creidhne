import React from 'react';
import { Box, Typography, Switch, FormControlLabel, Tooltip } from '@mui/material';
import ManageLibraries from '../components/ManageLibraries'; // Updated import path

const SettingsPage = ({ onToggleTheme, isDarkMode }) => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Tooltip title="Toggle between Light and Dark Mode">
        <FormControlLabel
          control={<Switch checked={isDarkMode} onChange={onToggleTheme} />}
          label={isDarkMode ? 'Dark Mode' : 'Light Mode'}
        />
      </Tooltip>
      <ManageLibraries />
    </Box>
  );
};

export default SettingsPage;
