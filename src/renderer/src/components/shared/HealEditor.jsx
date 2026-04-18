import React from 'react'
import { Box, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material'
import FormulaRow from './FormulaRow'

const FORMULA_KINDS = ['Static', 'Variable', 'Formula']

/**
 * Inline heal formula editor (Static / Variable / Formula).
 *
 * Props:
 *   value    — { kind, value, min, max, formula, formulaName? }
 *   onChange — (next) => void
 */
function HealEditor({ value, onChange }) {
  const setNumeric = (field) => (e) =>
    onChange({ ...value, [field]: e.target.value.replace(/\D/g, '') })
  const changeKind = (kind) =>
    onChange({ ...value, kind, value: '', min: '', max: '', formula: '', formulaName: '' })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <FormControl size="small" sx={{ width: 120, flexShrink: 0 }}>
          <InputLabel>Type</InputLabel>
          <Select value={value.kind} label="Type" onChange={(e) => changeKind(e.target.value)}>
            {FORMULA_KINDS.map((k) => (
              <MenuItem key={k} value={k}>
                {k}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {value.kind === 'Static' && (
          <TextField
            label="Amount"
            size="small"
            sx={{ width: 120 }}
            value={value.value}
            onChange={setNumeric('value')}
            slotProps={{
              htmlInput: { inputMode: 'numeric' }
            }}
          />
        )}
        {value.kind === 'Variable' && (
          <TextField
            label="Min"
            size="small"
            sx={{ width: 100 }}
            value={value.min}
            onChange={setNumeric('min')}
            slotProps={{
              htmlInput: { inputMode: 'numeric' }
            }}
          />
        )}
        {value.kind === 'Variable' && (
          <TextField
            label="Max"
            size="small"
            sx={{ width: 100 }}
            value={value.max}
            onChange={setNumeric('max')}
            slotProps={{
              htmlInput: { inputMode: 'numeric' }
            }}
          />
        )}
      </Box>
      {value.kind === 'Formula' && (
        <FormulaRow
          formulaName={value.formulaName || ''}
          formula={value.formula || ''}
          category="heal"
          onSelect={({ name, formula }) => onChange({ ...value, formula, formulaName: name })}
          onClear={() => onChange({ ...value, formula: '', formulaName: '' })}
        />
      )}
    </Box>
  );
}

export default HealEditor
