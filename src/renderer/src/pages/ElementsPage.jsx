import * as React from 'react';
import { Box, Typography } from '@mui/material';

function ElementsPage() {
  return (
    <Box sx={{ bgcolor: 'darkgreen', p: 2 }}>
      <Typography variant="h4" color="white">
        Welcome to the Elements
      </Typography>
    </Box>
  );
}

export default ElementsPage;
