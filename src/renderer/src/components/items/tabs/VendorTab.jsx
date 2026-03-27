import React from 'react';
import { Box, TextField, Typography, Paper } from '@mui/material';

function VendorTab({ data, onChange }) {
  const v = data.vendor ?? { shopTab: '', description: '' };

  const setVendor = (field) => (e) =>
    onChange({ ...data, vendor: { ...v, [field]: e.target.value } });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Vendor Info</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Shop Tab"
            value={v.shopTab}
            onChange={setVendor('shopTab')}
            size="small"
            inputProps={{ maxLength: 255 }}
          />
          <TextField
            label="Description"
            value={v.description}
            onChange={setVendor('description')}
            size="small"
            multiline
            minRows={2}
            inputProps={{ maxLength: 255 }}
          />
        </Box>
      </Paper>
    </Box>
  );
}

export default VendorTab;
