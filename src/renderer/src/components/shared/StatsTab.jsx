import React from 'react'
import {
  Box,
  Select,
  MenuItem,
  TextField,
  FormControl,
  InputLabel,
  IconButton,
  Button,
  Typography,
  Paper,
  Autocomplete
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { STAT_MODIFIERS, ELEMENT_TYPES, ELEMENTAL_MODIFIER_TYPES } from '../../data/itemConstants'

const DEFAULT_ELEMENTAL = { type: 'Augment', element: '', modifier: '1' }

function ElementSelect({ value, onChange, elementOptions, sx }) {
  if (elementOptions) {
    return (
      <Autocomplete
        freeSolo
        options={elementOptions}
        value={value}
        onInputChange={(_, val, reason) => {
          if (reason === 'input') onChange(val)
        }}
        onChange={(_, val) => onChange(val ?? '')}
        size="small"
        sx={sx}
        renderInput={(params) => <TextField {...params} label="Element" />}
      />
    )
  }
  return (
    <FormControl size="small" sx={sx}>
      <InputLabel>Element</InputLabel>
      <Select value={value} label="Element" onChange={(e) => onChange(e.target.value)}>
        {ELEMENT_TYPES.map((el) => (
          <MenuItem key={el} value={el}>
            {el}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

function StatModifierRow({
  row,
  index,
  usedKeys,
  elementOptions,
  onChangeKey,
  onChangeValue,
  onRemove
}) {
  const availableStats = STAT_MODIFIERS.filter(
    (s) => s.key === row.key || !usedKeys.includes(s.key)
  )
  const statDef = STAT_MODIFIERS.find((s) => s.key === row.key)

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
      <FormControl size="small" sx={{ minWidth: 260 }}>
        <InputLabel>Stat</InputLabel>
        <Select value={row.key} label="Stat" onChange={(e) => onChangeKey(index, e.target.value)}>
          {availableStats.map((s) => (
            <MenuItem key={s.key} value={s.key}>
              {s.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {statDef?.type === 'element' ? (
        <ElementSelect
          value={row.value}
          onChange={(val) => onChangeValue(index, val)}
          elementOptions={elementOptions}
          sx={{ minWidth: 180, flex: elementOptions ? 1 : undefined }}
        />
      ) : (
        <TextField
          label="Value"
          value={row.value}
          onChange={(e) => onChangeValue(index, e.target.value)}
          size="small"
          sx={{ width: 180 }}
          placeholder="number or formula"
        />
      )}

      <IconButton size="small" onClick={() => onRemove(index)} color="error">
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

function StatsTab({ data, onChange, elementOptions }) {
  const { rows, elementalModifiers } = data
  const usedKeys = rows.map((r) => r.key)

  const addElemental = () =>
    onChange({ ...data, elementalModifiers: [...elementalModifiers, { ...DEFAULT_ELEMENTAL }] })
  const setElemental = (index, field, val) =>
    onChange({
      ...data,
      elementalModifiers: elementalModifiers.map((em, i) =>
        i === index ? { ...em, [field]: val } : em
      )
    })
  const removeElemental = (index) =>
    onChange({ ...data, elementalModifiers: elementalModifiers.filter((_, i) => i !== index) })

  const addRow = () => {
    const next = STAT_MODIFIERS.find((s) => !usedKeys.includes(s.key))
    if (!next) return
    const defaultValue = next.type === 'element' ? (elementOptions ? '' : 'None') : ''
    onChange({ ...data, rows: [...rows, { key: next.key, value: defaultValue }] })
  }

  const removeRow = (index) => {
    onChange({ ...data, rows: rows.filter((_, i) => i !== index) })
  }

  const changeKey = (index, newKey) => {
    const statDef = STAT_MODIFIERS.find((s) => s.key === newKey)
    const defaultValue = statDef?.type === 'element' ? (elementOptions ? '' : 'None') : ''
    const updated = rows.map((r, i) => (i === index ? { key: newKey, value: defaultValue } : r))
    onChange({ ...data, rows: updated })
  }

  const changeValue = (index, newVal) => {
    const updated = rows.map((r, i) => (i === index ? { ...r, value: newVal } : r))
    onChange({ ...data, rows: updated })
  }

  const allUsed = usedKeys.length >= STAT_MODIFIERS.length

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Stat Modifiers
        </Typography>

        {rows.length === 0 && (
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mb: 1
            }}>
            No stat modifiers defined.
          </Typography>
        )}

        {rows.map((row, index) => (
          <StatModifierRow
            key={index}
            row={row}
            index={index}
            usedKeys={usedKeys}
            elementOptions={elementOptions}
            onChangeKey={changeKey}
            onChangeValue={changeValue}
            onRemove={removeRow}
          />
        ))}

        <Button
          startIcon={<AddIcon />}
          size="small"
          onClick={addRow}
          disabled={allUsed}
          sx={{ mt: 1 }}
        >
          Add Stat Modifier
        </Button>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Elemental Modifiers
        </Typography>
        {elementalModifiers.map((em, index) => (
          <Box
            key={index}
            sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}
          >
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={em.type}
                label="Type"
                onChange={(e) => setElemental(index, 'type', e.target.value)}
              >
                {ELEMENTAL_MODIFIER_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <ElementSelect
              value={em.element}
              onChange={(val) => setElemental(index, 'element', val)}
              elementOptions={elementOptions}
              sx={{ minWidth: 160, flex: elementOptions ? 1 : undefined }}
            />
            <TextField
              label="Modifier"
              value={em.modifier}
              size="small"
              sx={{ width: 120 }}
              onChange={(e) => setElemental(index, 'modifier', e.target.value)}
            />
            <IconButton size="small" color="error" onClick={() => removeElemental(index)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button startIcon={<AddIcon />} size="small" onClick={addElemental}>
          Add Elemental Modifier
        </Button>
      </Paper>
    </Box>
  );
}

export default StatsTab
