import React from 'react';
import { Box } from '@mui/material';

/**
 * Six-square swatch showing a dye's shade range.
 * Pass null/undefined colors to render nothing (e.g., blank state, clientPath
 * not set, or color not in the table).
 */
export default function ColorSwatch({ colors, cellSize = 10 }) {
  if (!colors || colors.length === 0) return null;
  return (
    <Box sx={{ display: 'inline-flex', border: '1px solid', borderColor: 'divider', borderRadius: 0.5, overflow: 'hidden', verticalAlign: 'middle' }}>
      {colors.map((c, i) => (
        <Box
          key={i}
          sx={{
            width: cellSize,
            height: cellSize,
            bgcolor: `rgb(${c.r}, ${c.g}, ${c.b})`,
          }}
        />
      ))}
    </Box>
  );
}
