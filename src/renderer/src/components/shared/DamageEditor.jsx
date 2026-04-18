import React from 'react'
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Autocomplete,
  Chip
} from '@mui/material'
import { ELEMENT_TYPES } from '../../data/itemConstants'
import FormulaRow from './FormulaRow'

const FORMULA_KINDS = ['Static', 'Variable', 'Formula']
const DAMAGE_TYPES = ['Direct', 'Physical', 'Magical', 'Elemental']
const DAMAGE_FLAGS = ['NoResistance', 'NoThreat', 'Nonlethal', 'NoDodge', 'NoCrit', 'NoElement']

/**
 * Inline damage formula editor (Static / Variable / Formula).
 *
 * Props:
 *   value       — { kind, type, flags, value, min, max, formula, formulaName?, element? }
 *   onChange    — (next) => void
 *   showElement — bool (default false). True for status effects, which have no
 *                 parent castable to inherit an element from.
 */
function DamageEditor({ value, onChange, showElement = false }) {
  const setNumeric = (field) => (e) =>
    onChange({ ...value, [field]: e.target.value.replace(/\D/g, '') })
  const changeKind = (kind) =>
    onChange({ ...value, kind, value: '', min: '', max: '', formula: '', formulaName: '' })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Type / damage-type / element / static-variable / flags — all one row */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
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
        <FormControl size="small" sx={{ minWidth: 140, flexShrink: 0 }}>
          <InputLabel>Damage Type</InputLabel>
          <Select
            value={value.type}
            label="Damage Type"
            onChange={(e) => onChange({ ...value, type: e.target.value })}
          >
            {DAMAGE_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {showElement && (
          <FormControl size="small" sx={{ minWidth: 140, flexShrink: 0 }}>
            <InputLabel>Element</InputLabel>
            <Select
              value={value.element ?? 'None'}
              label="Element"
              onChange={(e) => onChange({ ...value, element: e.target.value })}
            >
              {ELEMENT_TYPES.map((el) => (
                <MenuItem key={el} value={el}>
                  {el}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
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
        <Autocomplete
          multiple
          options={DAMAGE_FLAGS}
          value={value.flags || []}
          onChange={(_, val) => onChange({ ...value, flags: val })}
          disableCloseOnSelect
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
          renderValue={(vals, getItemProps) =>
            vals.map((option, index) => (
              <Chip key={option} label={option} size="small" {...getItemProps({ index })} />
            ))
          }
          renderInput={(params) => <TextField {...params} label="Flags" />}
        />
      </Box>
      {/* Formula row — own line */}
      {value.kind === 'Formula' && (
        <FormulaRow
          formulaName={value.formulaName || ''}
          formula={value.formula || ''}
          category="damage"
          onSelect={({ name, formula }) => onChange({ ...value, formula, formulaName: name })}
          onClear={() => onChange({ ...value, formula: '', formulaName: '' })}
        />
      )}
    </Box>
  );
}

export default DamageEditor
