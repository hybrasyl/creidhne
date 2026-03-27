import React from 'react';
import {
  Box, TextField, FormControlLabel, Checkbox, Typography, Paper, Divider,
  IconButton, Button,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

const DEFAULT_USE = {
  script: '',
  teleport: null,
  effect: null,
  sound: null,
  statuses: { add: [], remove: [] },
};
const DEFAULT_TELEPORT = { map: '', x: 0, y: 0 };
const DEFAULT_EFFECT = { id: 0, speed: 100 };
const DEFAULT_SOUND = { id: 1 };
const DEFAULT_ADD_STATUS = { name: '', duration: 0, intensity: 1.0, tick: 0, removeChance: '', persistDeath: false };
const DEFAULT_REMOVE_STATUS = { name: '', isCategory: false, quantity: 1 };

function UseTab({ data, onChange }) {
  const toggle = (e) =>
    onChange({ ...data, use: e.target.checked ? { ...DEFAULT_USE } : null });

  const setUse = (field) => (e) =>
    onChange({ ...data, use: { ...data.use, [field]: e.target.value } });

  const toggleSub = (key, def) => (e) =>
    onChange({ ...data, use: { ...data.use, [key]: e.target.checked ? { ...def } : null } });

  const setSubField = (key, field) => (e) =>
    onChange({
      ...data,
      use: { ...data.use, [key]: { ...data.use[key], [field]: e.target.value } },
    });

  // Statuses helpers
  const setStatuses = (updated) =>
    onChange({ ...data, use: { ...data.use, statuses: updated } });

  const addAddStatus = () =>
    setStatuses({ ...data.use.statuses, add: [...data.use.statuses.add, { ...DEFAULT_ADD_STATUS }] });

  const setAddStatus = (index, field, val) => {
    const updated = data.use.statuses.add.map((s, i) => (i === index ? { ...s, [field]: val } : s));
    setStatuses({ ...data.use.statuses, add: updated });
  };

  const removeAddStatus = (index) =>
    setStatuses({ ...data.use.statuses, add: data.use.statuses.add.filter((_, i) => i !== index) });

  const addRemoveStatus = () =>
    setStatuses({ ...data.use.statuses, remove: [...data.use.statuses.remove, { ...DEFAULT_REMOVE_STATUS }] });

  const setRemoveStatus = (index, field, val) => {
    const updated = data.use.statuses.remove.map((s, i) => (i === index ? { ...s, [field]: val } : s));
    setStatuses({ ...data.use.statuses, remove: updated });
  };

  const removeRemoveStatus = (index) =>
    setStatuses({ ...data.use.statuses, remove: data.use.statuses.remove.filter((_, i) => i !== index) });

  const u = data.use;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <FormControlLabel
        control={<Checkbox checked={u !== null} onChange={toggle} size="small" />}
        label={<Typography variant="subtitle2">Use Effect</Typography>}
      />

      {u !== null && (
        <>
          <Divider sx={{ my: 1 }} />
          <TextField
            label="Script"
            value={u.script}
            onChange={setUse('script')}
            size="small"
            fullWidth
            sx={{ mb: 2 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={u.teleport !== null}
                onChange={toggleSub('teleport', DEFAULT_TELEPORT)}
                size="small"
              />
            }
            label="Teleport"
          />
          {u.teleport !== null && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', pl: 2, mb: 2 }}>
              <TextField
                label="Map"
                value={u.teleport.map}
                onChange={setSubField('teleport', 'map')}
                size="small"
                sx={{ flex: 1, minWidth: 160 }}
                inputProps={{ maxLength: 255 }}
              />
              <TextField
                label="X"
                type="number"
                value={u.teleport.x}
                onChange={setSubField('teleport', 'x')}
                inputProps={{ min: 0, max: 255 }}
                size="small"
                sx={{ width: 100 }}
              />
              <TextField
                label="Y"
                type="number"
                value={u.teleport.y}
                onChange={setSubField('teleport', 'y')}
                inputProps={{ min: 0, max: 255 }}
                size="small"
                sx={{ width: 100 }}
              />
            </Box>
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={u.effect !== null}
                onChange={toggleSub('effect', DEFAULT_EFFECT)}
                size="small"
              />
            }
            label="Effect"
          />
          {u.effect !== null && (
            <Box sx={{ display: 'flex', gap: 2, pl: 2, mb: 2 }}>
              <TextField
                label="Effect ID"
                type="number"
                value={u.effect.id}
                onChange={setSubField('effect', 'id')}
                inputProps={{ min: 0, max: 65535 }}
                size="small"
                sx={{ width: 130 }}
              />
              <TextField
                label="Speed"
                type="number"
                value={u.effect.speed}
                onChange={setSubField('effect', 'speed')}
                inputProps={{ min: 0, max: 255 }}
                size="small"
                sx={{ width: 110 }}
              />
            </Box>
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={u.sound !== null}
                onChange={toggleSub('sound', DEFAULT_SOUND)}
                size="small"
              />
            }
            label="Sound"
          />
          {u.sound !== null && (
            <Box sx={{ pl: 2, mb: 2 }}>
              <TextField
                label="Sound ID"
                type="number"
                value={u.sound.id}
                onChange={setSubField('sound', 'id')}
                inputProps={{ min: 0, max: 255 }}
                size="small"
                sx={{ width: 130 }}
              />
            </Box>
          )}

          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" gutterBottom>Add Statuses</Typography>
          {u.statuses.add.map((s, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
              <TextField
                label="Status Name"
                value={s.name}
                onChange={(e) => setAddStatus(index, 'name', e.target.value)}
                size="small"
                sx={{ flex: 1, minWidth: 140 }}
                inputProps={{ maxLength: 255 }}
              />
              <TextField
                label="Duration"
                type="number"
                value={s.duration}
                onChange={(e) => setAddStatus(index, 'duration', e.target.value)}
                size="small"
                sx={{ width: 100 }}
              />
              <TextField
                label="Intensity"
                type="number"
                value={s.intensity}
                onChange={(e) => setAddStatus(index, 'intensity', e.target.value)}
                inputProps={{ step: 0.1 }}
                size="small"
                sx={{ width: 100 }}
              />
              <TextField
                label="Tick"
                type="number"
                value={s.tick}
                onChange={(e) => setAddStatus(index, 'tick', e.target.value)}
                size="small"
                sx={{ width: 90 }}
              />
              <TextField
                label="Remove Chance"
                value={s.removeChance}
                onChange={(e) => setAddStatus(index, 'removeChance', e.target.value)}
                size="small"
                sx={{ width: 130 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={s.persistDeath}
                    onChange={(e) => setAddStatus(index, 'persistDeath', e.target.checked)}
                    size="small"
                  />
                }
                label="Persist Death"
              />
              <IconButton size="small" color="error" onClick={() => removeAddStatus(index)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button startIcon={<AddIcon />} size="small" onClick={addAddStatus} sx={{ mb: 1 }}>
            Add Status
          </Button>

          <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>Remove Statuses</Typography>
          {u.statuses.remove.map((s, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
              <TextField
                label="Status Name"
                value={s.name}
                onChange={(e) => setRemoveStatus(index, 'name', e.target.value)}
                size="small"
                sx={{ flex: 1, minWidth: 140 }}
                inputProps={{ maxLength: 255 }}
              />
              <TextField
                label="Quantity"
                type="number"
                value={s.quantity}
                onChange={(e) => setRemoveStatus(index, 'quantity', e.target.value)}
                inputProps={{ min: 1 }}
                size="small"
                sx={{ width: 100 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={s.isCategory}
                    onChange={(e) => setRemoveStatus(index, 'isCategory', e.target.checked)}
                    size="small"
                  />
                }
                label="Is Category"
              />
              <IconButton size="small" color="error" onClick={() => removeRemoveStatus(index)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button startIcon={<AddIcon />} size="small" onClick={addRemoveStatus}>
            Remove Status
          </Button>
        </>
      )}
    </Paper>
  );
}

export default UseTab;
