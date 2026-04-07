import React from 'react';
import {
  Box, Button, IconButton, TextField, Select, MenuItem, FormControl, InputLabel,
  Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { EQUIPMENT_SLOTS, WEAPON_TYPES } from '../../data/itemConstants';

const RESTRICTION_TYPES = ['Equipped', 'NotEquipped', 'InInventory', 'NotInInventory'];
const EQUIPPED_TYPES    = new Set(['Equipped', 'NotEquipped']);

const DEFAULT_RESTRICTION = { type: 'Equipped', slot: 'None', weaponType: 'None', message: '', itemName: '' };

function RestrictionRow({ restriction, itemNames, messageOptions, onChange, onRemove }) {
  const isEquipped    = EQUIPPED_TYPES.has(restriction.type);
  const showWeaponType = isEquipped && restriction.slot === 'Weapon';

  const set = (field, val) => onChange({ ...restriction, [field]: val });

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1.5, flexWrap: 'wrap' }}>

      <FormControl size="small" sx={{ width: 170 }}>
        <InputLabel>Type</InputLabel>
        <Select
          value={restriction.type} label="Type"
          onChange={(e) => onChange({ ...DEFAULT_RESTRICTION, type: e.target.value })}
        >
          {RESTRICTION_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </Select>
      </FormControl>

      {isEquipped && (
        <FormControl size="small" sx={{ width: 150 }}>
          <InputLabel>Slot</InputLabel>
          <Select
            value={restriction.slot || 'None'} label="Slot"
            onChange={(e) => set('slot', e.target.value)}
          >
            {EQUIPMENT_SLOTS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
      )}

      {showWeaponType && (
        <Autocomplete
          options={WEAPON_TYPES}
          value={restriction.weaponType || 'None'}
          onChange={(_, val) => set('weaponType', val || 'None')}
          disableClearable
          size="small"
          sx={{ width: 140 }}
          renderInput={(params) => <TextField {...params} label="Weapon Type" />}
        />
      )}

      <Autocomplete
        freeSolo
        options={messageOptions}
        value={restriction.message || ''}
        onInputChange={(_, val, reason) => { if (reason === 'input') set('message', val); }}
        onChange={(_, val) => set('message', val ?? '')}
        size="small"
        sx={{ width: 200 }}
        renderInput={(params) => <TextField {...params} label="Message" />}
      />

      <Autocomplete
        freeSolo
        options={itemNames}
        value={restriction.itemName || ''}
        onInputChange={(_, val, reason) => { if (reason === 'input') set('itemName', val); }}
        onChange={(_, val) => set('itemName', val ?? '')}
        size="small"
        sx={{ flex: 1, minWidth: 160 }}
        renderInput={(params) => <TextField {...params} label="Item" />}
      />

      <IconButton size="small" color="error" onClick={onRemove} sx={{ mt: 0.5 }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

function RestrictionsSection({ restrictions, libraryIndex, onChange }) {
  const itemNames      = libraryIndex.items          || [];
  const messageOptions = (libraryIndex.npcStringKeys || [])
    .filter((s) => s.category === 'Common')
    .map((s) => s.key);

  const add    = ()     => onChange([...restrictions, { ...DEFAULT_RESTRICTION }]);
  const update = (i, v) => onChange(restrictions.map((r, idx) => idx === i ? v : r));
  const remove = (i)    => onChange(restrictions.filter((_, idx) => idx !== i));

  return (
    <Box>
      {restrictions.map((r, i) => (
        <RestrictionRow
          key={i}
          restriction={r}
          itemNames={itemNames}
          messageOptions={messageOptions}
          onChange={(v) => update(i, v)}
          onRemove={() => remove(i)}
        />
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={add}>
        Add Restriction
      </Button>
    </Box>
  );
}

export default RestrictionsSection;
