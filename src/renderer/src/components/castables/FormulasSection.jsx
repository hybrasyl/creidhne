import React from 'react';
import {
  Box, Button, IconButton, TextField, FormControl, InputLabel, Select, MenuItem,
  Autocomplete, Chip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { DAMAGE_FLAGS, DAMAGE_TYPES } from '../../data/castableConstants';

const FORMULA_KINDS = ['Static', 'Variable', 'Formula'];

const DEFAULT_HEAL   = { kind: 'Static', value: '', min: '', max: '', formula: '' };
const DEFAULT_DAMAGE = { kind: 'Static', type: 'Physical', flags: [], value: '', min: '', max: '', formula: '' };

function HealRow({ heal, onChange, onRemove }) {
  const set        = (field, val) => onChange({ ...heal, [field]: val });
  const setNumeric = (field)      => (e) => set(field, e.target.value.replace(/\D/g, ''));

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }}>
      <Typography variant="caption" sx={{ width: 52, color: 'text.secondary', flexShrink: 0 }}>Heal</Typography>
      <FormControl size="small" sx={{ width: 120 }}>
        <InputLabel>Type</InputLabel>
        <Select
          value={heal.kind} label="Type"
          onChange={(e) => onChange({ ...DEFAULT_HEAL, kind: e.target.value })}
        >
          {FORMULA_KINDS.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
        </Select>
      </FormControl>
      {heal.kind === 'Static'   && <TextField label="Amount"  size="small" sx={{ width: 120 }} value={heal.value}   onChange={setNumeric('value')} inputProps={{ inputMode: 'numeric' }} />}
      {heal.kind === 'Variable' && <TextField label="Min"     size="small" sx={{ width: 100 }} value={heal.min}     onChange={setNumeric('min')}   inputProps={{ inputMode: 'numeric' }} />}
      {heal.kind === 'Variable' && <TextField label="Max"     size="small" sx={{ width: 100 }} value={heal.max}     onChange={setNumeric('max')}   inputProps={{ inputMode: 'numeric' }} />}
      {heal.kind === 'Formula'  && <TextField label="Formula" size="small" sx={{ flex: 1, minWidth: 200 }} value={heal.formula} onChange={(e) => set('formula', e.target.value)} />}
      <IconButton size="small" color="error" onClick={onRemove} sx={{ flexShrink: 0 }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

function DamageRow({ damage, onChange, onRemove }) {
  const set        = (field, val) => onChange({ ...damage, [field]: val });
  const setNumeric = (field)      => (e) => set(field, e.target.value.replace(/\D/g, ''));

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1.5, flexWrap: 'wrap' }}>
      <Typography variant="caption" sx={{ width: 52, color: 'text.secondary', flexShrink: 0, pt: 1.25 }}>Damage</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ width: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={damage.kind} label="Type"
              onChange={(e) => onChange({ ...DEFAULT_DAMAGE, kind: e.target.value })}
            >
              {FORMULA_KINDS.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ width: 135 }}>
            <InputLabel>Damage Type</InputLabel>
            <Select
              value={damage.type || 'Physical'} label="Damage Type"
              onChange={(e) => set('type', e.target.value)}
            >
              {DAMAGE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          {damage.kind === 'Static'   && <TextField label="Amount"  size="small" sx={{ width: 120 }} value={damage.value}   onChange={setNumeric('value')} inputProps={{ inputMode: 'numeric' }} />}
          {damage.kind === 'Variable' && <TextField label="Min"     size="small" sx={{ width: 100 }} value={damage.min}     onChange={setNumeric('min')}   inputProps={{ inputMode: 'numeric' }} />}
          {damage.kind === 'Variable' && <TextField label="Max"     size="small" sx={{ width: 100 }} value={damage.max}     onChange={setNumeric('max')}   inputProps={{ inputMode: 'numeric' }} />}
          {damage.kind === 'Formula'  && <TextField label="Formula" size="small" sx={{ flex: 1, minWidth: 200 }} value={damage.formula} onChange={(e) => set('formula', e.target.value)} />}
          <IconButton size="small" color="error" onClick={onRemove} sx={{ flexShrink: 0 }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
        <Autocomplete
          multiple
          options={DAMAGE_FLAGS}
          value={damage.flags || []}
          onChange={(_, val) => set('flags', val)}
          disableCloseOnSelect
          size="small"
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip key={option} label={option} size="small" {...getTagProps({ index })} />
            ))
          }
          renderInput={(params) => <TextField {...params} label="Flags" />}
        />
      </Box>
    </Box>
  );
}

function FormulasSection({ heal, damage, onChange }) {
  return (
    <Box>
      {heal && (
        <HealRow
          heal={heal}
          onChange={(val) => onChange({ heal: val, damage })}
          onRemove={() => onChange({ heal: null, damage })}
        />
      )}
      {damage && (
        <DamageRow
          damage={damage}
          onChange={(val) => onChange({ heal, damage: val })}
          onRemove={() => onChange({ heal, damage: null })}
        />
      )}
      <Box sx={{ display: 'flex', gap: 1, mt: (heal || damage) ? 1 : 0 }}>
        {!heal && (
          <Button size="small" startIcon={<AddIcon />} onClick={() => onChange({ heal: { ...DEFAULT_HEAL }, damage })}>
            Add Heal
          </Button>
        )}
        {!damage && (
          <Button size="small" startIcon={<AddIcon />} onClick={() => onChange({ heal, damage: { ...DEFAULT_DAMAGE } })}>
            Add Damage
          </Button>
        )}
      </Box>
    </Box>
  );
}

export default FormulasSection;
