import React, { useState } from 'react'
import {
  Box,
  Button,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  Checkbox,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  Autocomplete,
  Tooltip
} from '@mui/material'
import ConstantAutocomplete from '../shared/ConstantAutocomplete'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import {
  ALL_CASTABLE_CLASSES,
  isAllClasses,
  DEFAULT_REQUIREMENT
} from '../../data/castableConstants'

const STAT_FIELDS = [
  { key: 'str', label: 'Str' },
  { key: 'int', label: 'Int' },
  { key: 'wis', label: 'Wis' },
  { key: 'con', label: 'Con' },
  { key: 'dex', label: 'Dex' }
]

function RequirementAccordion({
  requirement: req,
  castableNames,
  itemNames,
  npcStringKeys,
  onChange,
  onRemove
}) {
  const [open, setOpen] = useState(true)

  const set = (field, val) => onChange({ ...req, [field]: val })
  const setNumeric = (field) => (e) => set(field, e.target.value.replace(/\D/g, ''))
  const setPr = (field, val) =>
    onChange({ ...req, prerequisites: { ...req.prerequisites, [field]: val } })

  const displayClass = isAllClasses(req.class) ? 'All' : req.class || '(any)'

  const addItem = () => set('items', [...(req.items || []), { itemName: '', quantity: '1' }])
  const updateItem = (i, v) =>
    set(
      'items',
      (req.items || []).map((x, idx) => (idx === i ? v : x))
    )
  const removeItem = (i) =>
    set(
      'items',
      (req.items || []).filter((_, idx) => idx !== i)
    )

  const addCastable = () =>
    setPr('castables', [...(req.prerequisites?.castables || []), { name: '', level: '' }])
  const updateCastable = (i, v) =>
    setPr(
      'castables',
      (req.prerequisites?.castables || []).map((x, idx) => (idx === i ? v : x))
    )
  const removeCastable = (i) =>
    setPr(
      'castables',
      (req.prerequisites?.castables || []).filter((_, idx) => idx !== i)
    )

  return (
    <Paper variant="outlined" sx={{ mb: 1.5 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1,
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
          Requirement: {displayClass}
        </Typography>
        <IconButton
          size="small"
          color="error"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          sx={{ mr: 0.5 }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>

      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Line 1: Class, Cookies, Level, Gold, AB */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <FormControl size="small" sx={{ width: 140 }}>
              <InputLabel>Class</InputLabel>
              <Select
                value={isAllClasses(req.class) ? 'All' : req.class || ''}
                label="Class"
                onChange={(e) => {
                  const val = e.target.value
                  set('class', val === 'All' ? ALL_CASTABLE_CLASSES.join(' ') : val)
                }}
              >
                <MenuItem value="All">All</MenuItem>
                {ALL_CASTABLE_CLASSES.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <ConstantAutocomplete
              indexKey="cookieNames"
              label="Forbid Cookie"
              sx={{ width: 140 }}
              value={req.forbidCookie || ''}
              onChange={(val) => set('forbidCookie', val)}
            />
            <ConstantAutocomplete
              indexKey="cookieNames"
              label="Require Cookie"
              sx={{ width: 140 }}
              value={req.requireCookie || ''}
              onChange={(val) => set('requireCookie', val)}
            />
            <TextField
              label="Level Min"
              size="small"
              sx={{ width: 90 }}
              value={req.levelMin}
              onChange={setNumeric('levelMin')}
              inputProps={{ inputMode: 'numeric' }}
            />
            <TextField
              label="Level Max"
              size="small"
              sx={{ width: 90 }}
              value={req.levelMax}
              onChange={setNumeric('levelMax')}
              inputProps={{ inputMode: 'numeric' }}
            />
            <TextField
              label="Gold"
              size="small"
              sx={{ width: 110 }}
              value={req.gold}
              onChange={setNumeric('gold')}
              inputProps={{ inputMode: 'numeric' }}
            />
            {req.levelMin ? (
              <Tooltip title="Suggested gold = 750 + (Level Min × 135)">
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ alignSelf: 'center', whiteSpace: 'nowrap' }}
                >
                  Suggested: {750 + Number(req.levelMin) * 135}
                </Typography>
              </Tooltip>
            ) : null}
            <TextField
              label="AB Min"
              size="small"
              sx={{ width: 80 }}
              value={req.abMin}
              onChange={setNumeric('abMin')}
              inputProps={{ inputMode: 'numeric' }}
            />
            <TextField
              label="AB Max"
              size="small"
              sx={{ width: 80 }}
              value={req.abMax}
              onChange={setNumeric('abMax')}
              inputProps={{ inputMode: 'numeric' }}
            />
          </Box>

          {/* Line 2: Physical stats */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {STAT_FIELDS.map(({ key, label }) => (
              <TextField
                key={key}
                label={label}
                size="small"
                sx={{ width: 80 }}
                value={req[key] || ''}
                onChange={setNumeric(key)}
                inputProps={{ inputMode: 'numeric' }}
                placeholder="3"
              />
            ))}
            {req.levelMin
              ? (() => {
                  const level = Number(req.levelMin) || 1
                  const budget = 15 + 2 * (level - 1)
                  const required = STAT_FIELDS.reduce(
                    (sum, { key }) => sum + (Number(req[key]) || 3),
                    0
                  )
                  const diff = required - budget
                  const color =
                    diff <= 0 ? 'success.main' : diff <= 5 ? 'warning.main' : 'error.main'
                  return (
                    <Tooltip
                      title={`Players have ~${budget} total stats at level ${level} (15 base + 2/level). Required sum: ${required}.`}
                    >
                      <Typography
                        variant="caption"
                        sx={{ alignSelf: 'center', color, whiteSpace: 'nowrap' }}
                      >
                        Budget: {budget} / Required: {required} ({diff > 0 ? '+' : ''}
                        {diff})
                      </Typography>
                    </Tooltip>
                  )
                })()
              : null}
          </Box>

          {/* Prerequisites sub-section */}
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Prerequisites
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={!!req.prerequisites?.deprecated}
                  onChange={(e) => setPr('deprecated', e.target.checked)}
                />
              }
              label={<Typography variant="body2">Deprecated — saves as XML comment</Typography>}
              sx={{ m: 0, mb: 1 }}
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              <ConstantAutocomplete
                indexKey="cookieNames"
                label="Forbid Cookie"
                sx={{ width: 150 }}
                value={req.prerequisites?.forbidCookie || ''}
                onChange={(val) => setPr('forbidCookie', val)}
              />
              <Autocomplete
                freeSolo
                options={npcStringKeys}
                value={req.prerequisites?.forbidMessage || ''}
                onInputChange={(_, val, reason) => {
                  if (reason === 'input') setPr('forbidMessage', val)
                }}
                onChange={(_, val) => setPr('forbidMessage', val ?? '')}
                size="small"
                sx={{ width: 220 }}
                renderInput={(params) => <TextField {...params} label="Forbid Message" />}
              />
              <ConstantAutocomplete
                indexKey="cookieNames"
                label="Require Cookie"
                sx={{ width: 150 }}
                value={req.prerequisites?.requireCookie || ''}
                onChange={(val) => setPr('requireCookie', val)}
              />
              <Autocomplete
                freeSolo
                options={npcStringKeys}
                value={req.prerequisites?.requireMessage || ''}
                onInputChange={(_, val, reason) => {
                  if (reason === 'input') setPr('requireMessage', val)
                }}
                onChange={(_, val) => setPr('requireMessage', val ?? '')}
                size="small"
                sx={{ width: 220 }}
                renderInput={(params) => <TextField {...params} label="Require Message" />}
              />
            </Box>
            {(req.prerequisites?.castables || []).map((c, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                <Autocomplete
                  freeSolo
                  options={castableNames}
                  value={c.name || ''}
                  onInputChange={(_, val, reason) => {
                    if (reason === 'input') updateCastable(i, { ...c, name: val })
                  }}
                  onChange={(_, val) => updateCastable(i, { ...c, name: val ?? '' })}
                  size="small"
                  sx={{ flex: 1, minWidth: 160 }}
                  renderInput={(params) => <TextField {...params} label="Castable" />}
                />
                <TextField
                  label="Level"
                  size="small"
                  sx={{ width: 80 }}
                  value={c.level || ''}
                  onChange={(e) =>
                    updateCastable(i, { ...c, level: e.target.value.replace(/\D/g, '') })
                  }
                  inputProps={{ inputMode: 'numeric' }}
                />
                <IconButton size="small" color="error" onClick={() => removeCastable(i)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={addCastable}>
              Add Castable
            </Button>
          </Paper>

          {/* Required Items sub-section */}
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Required Items
            </Typography>
            {(req.items || []).map((item, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                <Autocomplete
                  freeSolo
                  options={itemNames}
                  value={item.itemName || ''}
                  onInputChange={(_, val, reason) => {
                    if (reason === 'input') updateItem(i, { ...item, itemName: val })
                  }}
                  onChange={(_, val) => updateItem(i, { ...item, itemName: val ?? '' })}
                  size="small"
                  sx={{ flex: 1, minWidth: 160 }}
                  renderInput={(params) => <TextField {...params} label="Item" />}
                />
                <TextField
                  label="Quantity"
                  size="small"
                  sx={{ width: 90 }}
                  value={item.quantity || ''}
                  onChange={(e) =>
                    updateItem(i, { ...item, quantity: e.target.value.replace(/\D/g, '') })
                  }
                  inputProps={{ inputMode: 'numeric' }}
                />
                <IconButton size="small" color="error" onClick={() => removeItem(i)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={addItem}>
              Add Item
            </Button>
          </Paper>
        </Box>
      </Collapse>
    </Paper>
  )
}

function RequirementsSection({ requirements, libraryIndex, onChange }) {
  const castableNames = libraryIndex.castables || []
  const itemNames = libraryIndex.items || []
  const npcStringKeys = (libraryIndex.npcStringKeys || [])
    .filter((s) => s.category === 'Common')
    .map((s) => s.key)

  const add = () =>
    onChange([
      ...requirements,
      {
        ...DEFAULT_REQUIREMENT,
        prerequisites: { ...DEFAULT_REQUIREMENT.prerequisites, castables: [] }
      }
    ])
  const update = (i, v) => onChange(requirements.map((r, idx) => (idx === i ? v : r)))
  const remove = (i) => onChange(requirements.filter((_, idx) => idx !== i))

  return (
    <Box>
      {requirements.map((req, i) => (
        <RequirementAccordion
          key={i}
          requirement={req}
          castableNames={castableNames}
          itemNames={itemNames}
          npcStringKeys={npcStringKeys}
          onChange={(v) => update(i, v)}
          onRemove={() => remove(i)}
        />
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={add}>
        Add Requirement
      </Button>
    </Box>
  )
}

export default RequirementsSection
