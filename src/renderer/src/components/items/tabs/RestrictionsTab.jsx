import React from 'react';
import {
  Box, TextField, Select, MenuItem, FormControl, InputLabel,
  Typography, Paper, IconButton, Button, Autocomplete, FormControlLabel, Checkbox, Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useRecoilValue } from 'recoil';
import { CLASS_TYPES, GENDERS, SLOT_RESTRICTION_TYPES, EQUIPMENT_SLOTS } from '../../../data/itemConstants';
import { libraryIndexState } from '../../../recoil/atoms';

const DEFAULT_AB = { min: 0, max: 255 };

const DEFAULT_RESTRICTIONS = {
  level: { min: 1, max: 99 },
  ab: null,
  class: 'All',
  gender: 'Neutral',
  castables: [],
  slotRestrictions: [],
};

function RestrictionsTab({ data, onChange }) {
  const libraryIndex = useRecoilValue(libraryIndexState);
  const castableNames = libraryIndex.castables || [];

  const r = data.restrictions ?? { ...DEFAULT_RESTRICTIONS };

  const setRestriction = (field) => (e) =>
    onChange({ ...data, restrictions: { ...r, [field]: e.target.value } });

  const setSubField = (parent, field) => (e) =>
    onChange({
      ...data,
      restrictions: {
        ...r,
        [parent]: { ...r[parent], [field]: e.target.value },
      },
    });

  const addCastable = () =>
    onChange({ ...data, restrictions: { ...r, castables: [...r.castables, ''] } });

  const setCastable = (index, val) => {
    const updated = r.castables.map((c, i) => (i === index ? val : c));
    onChange({ ...data, restrictions: { ...r, castables: updated } });
  };

  const removeCastable = (index) => {
    const updated = r.castables.filter((_, i) => i !== index);
    onChange({ ...data, restrictions: { ...r, castables: updated } });
  };

  const addSlotRestriction = () =>
    onChange({
      ...data,
      restrictions: {
        ...r,
        slotRestrictions: [
          ...r.slotRestrictions,
          { type: 'ItemRequired', slot: 'None', message: '' },
        ],
      },
    });

  const setSlotRestriction = (index, field, val) => {
    const updated = r.slotRestrictions.map((sr, i) =>
      i === index ? { ...sr, [field]: val } : sr
    );
    onChange({ ...data, restrictions: { ...r, slotRestrictions: updated } });
  };

  const removeSlotRestriction = (index) => {
    const updated = r.slotRestrictions.filter((_, i) => i !== index);
    onChange({ ...data, restrictions: { ...r, slotRestrictions: updated } });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        {/* Level + Class + Gender — always shown */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <TextField
            label="Level Min"
            type="number"
            value={r.level.min}
            onChange={setSubField('level', 'min')}
            inputProps={{ min: 0, max: 255 }}
            size="small"
            sx={{ width: 120 }}
          />
          <TextField
            label="Level Max"
            type="number"
            value={r.level.max}
            onChange={setSubField('level', 'max')}
            inputProps={{ min: 0, max: 255 }}
            size="small"
            sx={{ width: 120 }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Class</InputLabel>
            <Select value={r.class} label="Class" onChange={setRestriction('class')}>
              {CLASS_TYPES.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Gender</InputLabel>
            <Select value={r.gender} label="Gender" onChange={setRestriction('gender')}>
              {GENDERS.map((g) => (
                <MenuItem key={g} value={g}>{g}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* AB — optional */}
        <FormControlLabel
          control={
            <Checkbox
              checked={r.ab !== null}
              size="small"
              onChange={(e) =>
                onChange({ ...data, restrictions: { ...r, ab: e.target.checked ? { ...DEFAULT_AB } : null } })
              }
            />
          }
          label={<Typography variant="subtitle2">AB Restriction</Typography>}
        />

        {r.ab !== null && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <TextField
                label="AB Min"
                type="number"
                value={r.ab.min}
                onChange={setSubField('ab', 'min')}
                inputProps={{ min: 0, max: 255 }}
                size="small"
                sx={{ width: 120 }}
              />
              <TextField
                label="AB Max"
                type="number"
                value={r.ab.max}
                onChange={setSubField('ab', 'max')}
                inputProps={{ min: 0, max: 255 }}
                size="small"
                sx={{ width: 120 }}
              />
            </Box>
          </>
        )}

        <Typography variant="subtitle2" gutterBottom>Required Castables</Typography>
        {r.castables.map((castable, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
            <Autocomplete
              freeSolo
              options={castableNames}
              value={castable}
              onInputChange={(_, val) => setCastable(index, val)}
              size="small"
              sx={{ flex: 1 }}
              renderInput={(params) => (
                <TextField {...params} label={`Castable ${index + 1}`} inputProps={{ ...params.inputProps, maxLength: 255 }} />
              )}
            />
            <IconButton size="small" color="error" onClick={() => removeCastable(index)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button startIcon={<AddIcon />} size="small" onClick={addCastable} sx={{ mb: 2 }}>
          Add Castable
        </Button>

        <Typography variant="subtitle2" gutterBottom>Slot Restrictions</Typography>
        {r.slotRestrictions.map((sr, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={sr.type}
                label="Type"
                onChange={(e) => setSlotRestriction(index, 'type', e.target.value)}
              >
                {SLOT_RESTRICTION_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Slot</InputLabel>
              <Select
                value={sr.slot}
                label="Slot"
                onChange={(e) => setSlotRestriction(index, 'slot', e.target.value)}
              >
                {EQUIPMENT_SLOTS.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Message"
              value={sr.message}
              onChange={(e) => setSlotRestriction(index, 'message', e.target.value)}
              size="small"
              sx={{ flex: 1, minWidth: 160 }}
              inputProps={{ maxLength: 255 }}
            />
            <IconButton size="small" color="error" onClick={() => removeSlotRestriction(index)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button startIcon={<AddIcon />} size="small" onClick={addSlotRestriction}>
          Add Slot Restriction
        </Button>
      </Paper>
    </Box>
  );
}

export default RestrictionsTab;
