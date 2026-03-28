import React from 'react';
import { Box, Typography, Divider } from '@mui/material';

function ServerConfigPage() {
  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Server Config
      </Typography>
      <Divider sx={{ mb: 3 }} />
      <Typography variant="body2" color="text.secondary">
        Server config editor coming soon.
      </Typography>
    </Box>
  );
}

export default ServerConfigPage;
