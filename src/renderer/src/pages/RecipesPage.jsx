import * as React from 'react';
import { Box, Typography } from '@mui/material';

function RecipesPage() {
  return (
    <Box sx={{ bgcolor: 'darkgreen', p: 2 }}>
      <Typography variant="h4" color="white">
        Welcome to the Recipes
      </Typography>
    </Box>
  );
}

export default RecipesPage;
