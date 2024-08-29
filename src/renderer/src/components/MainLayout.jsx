import React from 'react';
import { AppBar, Box } from '@mui/material';
import MainToolbar from '../components/MainToolbar';

function MainLayout({ children, navigate }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
      }}
    >
      <AppBar
        position="static"
        sx={{
          WebkitAppRegion: 'drag', // Makes the component draggable
          userSelect: 'none', // Forbids text selection
        }}
      >
        <MainToolbar navigate={navigate} />
      </AppBar>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {children}
      </Box>
    </Box>
  );
}

export default MainLayout;
