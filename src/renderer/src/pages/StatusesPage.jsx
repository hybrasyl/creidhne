import * as React from 'react';
import { Box, Typography } from '@mui/material';

function StatusesPage() {
  return (
    <Box sx={{ bgcolor: 'darkgreen', p: 2 }}>
      <Typography variant="h4" color="white">
        Welcome to the Statuses
      </Typography>
    </Box>
  );
}

export default StatusesPage;
