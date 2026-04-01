import React from 'react';
import {
  Box, Button, IconButton, TextField, Autocomplete, Typography,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

const DEFAULT_ADD    = { name: '', duration: '', intensity: '', tick: '' };
const DEFAULT_REMOVE = { name: '', isCategory: false, quantity: '' };

function AddStatusRow({ entry, statusNames, onChange, onRemove }) {
  const set        = (field, val) => onChange({ ...entry, [field]: val });
  const setNumeric = (field)      => (e) => set(field, e.target.value.replace(/\D/g, ''));

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
      <Typography variant="caption" sx={{ width: 46, color: 'text.secondary', flexShrink: 0 }}>Add</Typography>
      <Autocomplete
        freeSolo
        options={statusNames}
        value={entry.name || ''}
        onInputChange={(_, val, reason) => { if (reason === 'input') set('name', val); }}
        onChange={(_, val) => set('name', val ?? '')}
        size="small"
        sx={{ flex: 1, minWidth: 160 }}
        renderInput={(params) => <TextField {...params} label="Status" />}
      />
      <TextField label="Duration"  size="small" sx={{ width: 90 }} value={entry.duration}  onChange={setNumeric('duration')}  inputProps={{ inputMode: 'numeric' }} />
      <TextField label="Intensity" size="small" sx={{ width: 90 }} value={entry.intensity} onChange={(e) => set('intensity', e.target.value.replace(/[^\d.]/g, ''))} />
      <TextField label="Tick"      size="small" sx={{ width: 80 }} value={entry.tick}      onChange={setNumeric('tick')}      inputProps={{ inputMode: 'numeric' }} />
      <IconButton size="small" color="error" onClick={onRemove} sx={{ flexShrink: 0 }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

function RemoveStatusRow({ entry, statusNames, categoryNames, onChange, onRemove }) {
  const set = (field, val) => onChange({ ...entry, [field]: val });

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
      <Typography variant="caption" sx={{ width: 46, color: 'text.secondary', flexShrink: 0 }}>Remove</Typography>
      <FormControl size="small" sx={{ width: 130 }}>
        <InputLabel>Type</InputLabel>
        <Select
          value={entry.isCategory ? 'Category' : 'Status'}
          label="Type"
          onChange={(e) => set('isCategory', e.target.value === 'Category')}
        >
          <MenuItem value="Status">Status</MenuItem>
          <MenuItem value="Category">Category</MenuItem>
        </Select>
      </FormControl>
      {entry.isCategory ? (
        <Autocomplete
          freeSolo
          options={categoryNames}
          value={entry.name || ''}
          onInputChange={(_, val, reason) => { if (reason === 'input') set('name', val); }}
          onChange={(_, val) => set('name', val ?? '')}
          size="small"
          sx={{ flex: 1, minWidth: 160 }}
          renderInput={(params) => <TextField {...params} label="Category" />}
        />
      ) : (
        <Autocomplete
          freeSolo
          options={statusNames}
          value={entry.name || ''}
          onInputChange={(_, val, reason) => { if (reason === 'input') set('name', val); }}
          onChange={(_, val) => set('name', val ?? '')}
          size="small"
          sx={{ flex: 1, minWidth: 160 }}
          renderInput={(params) => <TextField {...params} label="Status" />}
        />
      )}
      <TextField
        label="Quantity" size="small" sx={{ width: 90 }}
        value={entry.quantity}
        onChange={(e) => set('quantity', e.target.value.replace(/\D/g, ''))}
        inputProps={{ inputMode: 'numeric' }}
      />
      <IconButton size="small" color="error" onClick={onRemove} sx={{ flexShrink: 0 }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

function StatusesSection({ statuses, libraryIndex, onChange }) {
  const statusNames   = libraryIndex.statuses          || [];
  const categoryNames = libraryIndex.statusCategories  || [];
  const add    = statuses?.add    || [];
  const remove = statuses?.remove || [];

  const addStatus    = ()     => onChange({ ...statuses, add:    [...add,    { ...DEFAULT_ADD    }] });
  const removeStatus = ()     => onChange({ ...statuses, remove: [...remove, { ...DEFAULT_REMOVE }] });
  const updateAdd    = (i, v) => onChange({ ...statuses, add:    add.map((x, idx)    => idx === i ? v : x) });
  const deleteAdd    = (i)    => onChange({ ...statuses, add:    add.filter((_, idx)    => idx !== i) });
  const updateRemove = (i, v) => onChange({ ...statuses, remove: remove.map((x, idx) => idx === i ? v : x) });
  const deleteRemove = (i)    => onChange({ ...statuses, remove: remove.filter((_, idx) => idx !== i) });

  return (
    <Box>
      {add.map((entry, i) => (
        <AddStatusRow
          key={i}
          entry={entry}
          statusNames={statusNames}
          onChange={(v) => updateAdd(i, v)}
          onRemove={() => deleteAdd(i)}
        />
      ))}
      {remove.map((entry, i) => (
        <RemoveStatusRow
          key={i}
          entry={entry}
          statusNames={statusNames}
          categoryNames={categoryNames}
          onChange={(v) => updateRemove(i, v)}
          onRemove={() => deleteRemove(i)}
        />
      ))}
      <Box sx={{ display: 'flex', gap: 1, mt: (add.length || remove.length) ? 1 : 0 }}>
        <Button size="small" startIcon={<AddIcon />} onClick={addStatus}>
          Status Add
        </Button>
        <Button size="small" startIcon={<AddIcon />} onClick={removeStatus}>
          Status Remove
        </Button>
      </Box>
    </Box>
  );
}

export default StatusesSection;
