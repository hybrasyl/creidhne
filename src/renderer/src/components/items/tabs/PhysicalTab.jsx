import React from 'react';
import {
  Box, TextField, FormControlLabel, Checkbox, Select, MenuItem,
  FormControl, InputLabel, Typography, Paper, Divider,
} from '@mui/material';
import { EQUIPMENT_SLOTS, WEAPON_TYPES } from '../../../data/itemConstants';

const DEFAULT_EQUIPMENT = { slot: 'None', weaponType: 'None' };
const DEFAULT_DAMAGE = { largeMin: 0, largeMax: 0, smallMin: 0, smallMax: 0 };

function PhysicalTab({ data, onChange }) {
  const setPhysical = (field) => (e) =>
    onChange({ ...data, physical: { ...data.physical, [field]: e.target.value } });

  const setStackable = (e) =>
    onChange({ ...data, stackable: { max: e.target.value } });

  const setEquipment = (field) => (e) =>
    onChange({ ...data, equipment: { ...data.equipment, [field]: e.target.value } });

  const setDamage = (field) => (e) =>
    onChange({ ...data, damage: { ...data.damage, [field]: e.target.value } });

  const toggleEquipment = (e) =>
    onChange({ ...data, equipment: e.target.checked ? { ...DEFAULT_EQUIPMENT } : null });

  const toggleDamage = (e) =>
    onChange({ ...data, damage: e.target.checked ? { ...DEFAULT_DAMAGE } : null });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Physical Properties</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="Value"
            type="number"
            value={data.physical.value}
            onChange={setPhysical('value')}
            inputProps={{ min: 0, step: 0.01 }}
            size="small"
            sx={{ width: 130 }}
          />
          <TextField
            label="Weight"
            type="number"
            value={data.physical.weight}
            onChange={setPhysical('weight')}
            inputProps={{ min: 0, step: 0.01 }}
            size="small"
            sx={{ width: 130 }}
          />
          <TextField
            label="Durability"
            type="number"
            value={data.physical.durability}
            onChange={setPhysical('durability')}
            inputProps={{ min: 0, step: 0.01 }}
            size="small"
            sx={{ width: 130 }}
          />
          <TextField
            label="Stack Max"
            type="number"
            value={data.stackable.max}
            onChange={setStackable}
            inputProps={{ min: 1, max: 255 }}
            size="small"
            sx={{ width: 130 }}
          />
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={data.equipment !== null}
              onChange={toggleEquipment}
              size="small"
            />
          }
          label={<Typography variant="subtitle2">Equipment</Typography>}
        />
        {data.equipment !== null && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Slot</InputLabel>
                <Select
                  value={data.equipment.slot}
                  label="Slot"
                  onChange={setEquipment('slot')}
                >
                  {EQUIPMENT_SLOTS.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Weapon Type</InputLabel>
                <Select
                  value={data.equipment.weaponType}
                  label="Weapon Type"
                  onChange={setEquipment('weaponType')}
                >
                  {WEAPON_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={data.damage !== null}
              onChange={toggleDamage}
              size="small"
            />
          }
          label={<Typography variant="subtitle2">Damage</Typography>}
        />
        {data.damage !== null && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Small Min"
                type="number"
                value={data.damage.smallMin}
                onChange={setDamage('smallMin')}
                inputProps={{ step: 0.01 }}
                size="small"
                sx={{ width: 130 }}
              />
              <TextField
                label="Small Max"
                type="number"
                value={data.damage.smallMax}
                onChange={setDamage('smallMax')}
                inputProps={{ step: 0.01 }}
                size="small"
                sx={{ width: 130 }}
              />
              <TextField
                label="Large Min"
                type="number"
                value={data.damage.largeMin}
                onChange={setDamage('largeMin')}
                inputProps={{ step: 0.01 }}
                size="small"
                sx={{ width: 130 }}
              />
              <TextField
                label="Large Max"
                type="number"
                value={data.damage.largeMax}
                onChange={setDamage('largeMax')}
                inputProps={{ step: 0.01 }}
                size="small"
                sx={{ width: 130 }}
              />
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}

export default PhysicalTab;
