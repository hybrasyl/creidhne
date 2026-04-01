import React from 'react';
import { Box, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';

const FORMULA_KINDS = ['Static', 'Variable', 'Formula'];

/**
 * Inline heal formula editor (Static / Variable / Formula).
 *
 * Props:
 *   value    — { kind, value, min, max, formula }
 *   onChange — (next) => void
 */
function HealEditor({ value, onChange }) {
  const setNumeric = (field) => (e) => onChange({ ...value, [field]: e.target.value.replace(/\D/g, '') });
  const changeKind = (kind) => onChange({ ...value, kind, value: '', min: '', max: '', formula: '' });

  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
      <FormControl size="small" sx={{ width: 120 }}>
        <InputLabel>Type</InputLabel>
        <Select value={value.kind} label="Type" onChange={(e) => changeKind(e.target.value)}>
          {FORMULA_KINDS.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
        </Select>
      </FormControl>
      {value.kind === 'Static'   && <TextField label="Amount"  size="small" sx={{ width: 120 }} value={value.value}   onChange={setNumeric('value')} inputProps={{ inputMode: 'numeric' }} />}
      {value.kind === 'Variable' && <TextField label="Min"     size="small" sx={{ width: 100 }} value={value.min}     onChange={setNumeric('min')}   inputProps={{ inputMode: 'numeric' }} />}
      {value.kind === 'Variable' && <TextField label="Max"     size="small" sx={{ width: 100 }} value={value.max}     onChange={setNumeric('max')}   inputProps={{ inputMode: 'numeric' }} />}
      {value.kind === 'Formula'  && <TextField label="Formula" size="small" sx={{ flex: 1, minWidth: 200 }} value={value.formula} onChange={(e) => onChange({ ...value, formula: e.target.value })} />}
    </Box>
  );
}

export default HealEditor;
