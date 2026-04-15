import React from 'react';
import { AppBar, Box } from '@mui/material';
import MainToolbar from '../components/MainToolbar';
import IndexBuildProgress from './IndexBuildProgress';

function MainLayout({ children, navigate, rightPanel }) {
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
      <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row', minHeight: 0, position: 'relative' }}>
        <IndexBuildProgress />
        <Box component="main" sx={{ flex: 1, minWidth: 0, p: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
        {rightPanel}
      </Box>
    </Box>
  );
}

export default MainLayout;
