import React from 'react';
import {
  Box, Button, IconButton, TextField, FormControlLabel, Checkbox, Autocomplete, Typography,
} from '@mui/material';
import ConstantAutocomplete from '../shared/ConstantAutocomplete';
import ScriptAutocomplete from '../shared/ScriptAutocomplete';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

const DEFAULT_REACTOR = {
  script: '', relativeX: '0', relativeY: '0', sprite: '0', expiration: '0', uses: '1',
  displayOwner: false, displayGroup: false, displayStatus: '', displayCookie: '',
};

function ReactorRow({ reactor, index, statusNames, onChange, onRemove }) {
  const set             = (field, val) => onChange({ ...reactor, [field]: val });
  const setNumeric      = (field) => (e) => set(field, e.target.value.replace(/\D/g, ''));
  const setSignedNumeric = (field) => (e) => set(field, e.target.value.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, ''));

  return (
    <Box sx={{ mb: 2 }}>
      {/* Line 1: positional / timing fields */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap', mb: 1 }}>
        <ScriptAutocomplete
          freeSolo label="Script" sx={{ flex: 1, minWidth: 200 }} subfolder="reactor"
          value={reactor.script || ''}
          onChange={(val) => set('script', val)}
        />
        <TextField label="Rel X"       size="small" sx={{ width: 80  }} value={reactor.relativeX}  onChange={setSignedNumeric('relativeX')}  inputProps={{ inputMode: 'numeric' }} />
        <TextField label="Rel Y"       size="small" sx={{ width: 80  }} value={reactor.relativeY}  onChange={setSignedNumeric('relativeY')}  inputProps={{ inputMode: 'numeric' }} />
        <TextField label="Sprite"      size="small" sx={{ width: 90  }} value={reactor.sprite}     onChange={setNumeric('sprite')}     inputProps={{ inputMode: 'numeric' }} />
        <TextField label="Expiration"  size="small" sx={{ width: 100 }} value={reactor.expiration} onChange={setNumeric('expiration')} inputProps={{ inputMode: 'numeric' }} />
        <TextField label="Uses"        size="small" sx={{ width: 80  }} value={reactor.uses}       onChange={setNumeric('uses')}       inputProps={{ inputMode: 'numeric' }} />
        <IconButton size="small" color="error" onClick={onRemove} sx={{ mt: 0.5 }}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Line 2: display / visibility fields */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', pl: 1 }}>
        <FormControlLabel
          control={<Checkbox size="small" checked={reactor.displayOwner} onChange={(e) => set('displayOwner', e.target.checked)} />}
          label={<Typography variant="body2">Show to Owner</Typography>}
          sx={{ m: 0 }}
        />
        <FormControlLabel
          control={<Checkbox size="small" checked={reactor.displayGroup} onChange={(e) => set('displayGroup', e.target.checked)} />}
          label={<Typography variant="body2">Show to Group</Typography>}
          sx={{ m: 0 }}
        />
        <Autocomplete
          freeSolo
          options={statusNames}
          value={reactor.displayStatus || ''}
          onInputChange={(_, val, reason) => { if (reason === 'input') set('displayStatus', val); }}
          onChange={(_, val) => set('displayStatus', val ?? '')}
          size="small"
          sx={{ width: 200 }}
          renderInput={(params) => <TextField {...params} label="Show if Status" />}
        />
        <ConstantAutocomplete
          indexKey="cookieNames" label="Show if Cookie" sx={{ width: 180 }}
          value={reactor.displayCookie}
          onChange={(val) => set('displayCookie', val)}
        />
      </Box>
    </Box>
  );
}

function ReactorsSection({ reactors, libraryIndex, onChange }) {
  const statusNames = libraryIndex.statuses || [];

  const add    = ()     => onChange([...reactors, { ...DEFAULT_REACTOR }]);
  const update = (i, v) => onChange(reactors.map((r, idx) => idx === i ? v : r));
  const remove = (i)    => onChange(reactors.filter((_, idx) => idx !== i));

  return (
    <Box>
      {reactors.map((r, i) => (
        <ReactorRow
          key={i}
          reactor={r}
          index={i}
          statusNames={statusNames}
          onChange={(v) => update(i, v)}
          onRemove={() => remove(i)}
        />
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={add}>
        Add Reactor
      </Button>
    </Box>
  );
}

export default ReactorsSection;
