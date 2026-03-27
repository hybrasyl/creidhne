import React from 'react';
import {
  Box, TextField, FormControlLabel, Checkbox, Select, MenuItem,
  FormControl, InputLabel, Typography, Paper, Divider,
} from '@mui/material';
import { ITEM_BODY_STYLES, ITEM_COLORS } from '../../../data/itemConstants';

function AppearanceTab({ data, onChange }) {
  const set = (field) => (e) => onChange({ ...data, [field]: e.target.value });
  const setCheck = (field) => (e) => onChange({ ...data, [field]: e.target.checked });

  const toggleStyle = (e) =>
    onChange({
      ...data,
      styleEnabled: e.target.checked,
      ...(e.target.checked ? {} : { bodyStyle: 'Transparent', color: 'None', hideBoots: false }),
    });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Sprites</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="Sprite"
            required
            type="number"
            value={data.sprite}
            onChange={set('sprite')}
            inputProps={{ min: 0, max: 65535 }}
            size="small"
            sx={{ width: 140 }}
          />
          <TextField
            label="Equip Sprite"
            type="number"
            value={data.equipSprite}
            onChange={set('equipSprite')}
            inputProps={{ min: 0, max: 65535 }}
            size="small"
            sx={{ width: 140 }}
          />
          <TextField
            label="Display Sprite"
            type="number"
            value={data.displaySprite}
            onChange={set('displaySprite')}
            inputProps={{ min: 0, max: 65535 }}
            size="small"
            sx={{ width: 140 }}
          />
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <FormControlLabel
          control={<Checkbox checked={data.styleEnabled} onChange={toggleStyle} size="small" />}
          label={<Typography variant="subtitle2">Style</Typography>}
        />

        {data.styleEnabled && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Body Style</InputLabel>
                <Select value={data.bodyStyle} label="Body Style" onChange={set('bodyStyle')}>
                  {ITEM_BODY_STYLES.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Color</InputLabel>
                <Select value={data.color} label="Color" onChange={set('color')}>
                  {ITEM_COLORS.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Checkbox checked={data.hideBoots} onChange={setCheck('hideBoots')} size="small" />
                }
                label="Hide Boots"
              />
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}

export default AppearanceTab;
