import React, { useState } from 'react'
import {
  Box,
  Button,
  Typography,
  Divider,
  TextField,
  Tooltip,
  IconButton,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  Autocomplete,
  Chip,
  Collapse
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import {
  SPELL_USE_TYPES,
  INTENT_FLAGS,
  INTENT_DIRECTIONS,
  VISUAL_EFFECT_TYPES,
  DEFAULT_INTENT
} from '../../data/castableConstants'

const DEFAULT_CROSS = { radius: '', visualEffect: 'Targets' }
const DEFAULT_CONE = { radius: '', direction: 'None', visualEffect: 'Targets' }
const DEFAULT_SQUARE = { side: '', visualEffect: 'Targets' }
const DEFAULT_LINE = { length: '', direction: 'None', visualEffect: 'Targets' }
const DEFAULT_TILE = { direction: 'None', relativeX: '0', relativeY: '0', visualEffect: 'Targets' }

// ── Shared small selects ─────────────────────────────────────────────────────

function VisualEffectSelect({ value, onChange }) {
  return (
    <FormControl size="small" sx={{ width: 110 }}>
      <InputLabel>Visual</InputLabel>
      <Select value={value || 'Targets'} label="Visual" onChange={(e) => onChange(e.target.value)}>
        {VISUAL_EFFECT_TYPES.map((v) => (
          <MenuItem key={v} value={v}>
            {v}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

function DirectionSelect({ value, onChange }) {
  return (
    <FormControl size="small" sx={{ width: 110 }}>
      <InputLabel>Direction</InputLabel>
      <Select value={value || 'None'} label="Direction" onChange={(e) => onChange(e.target.value)}>
        {INTENT_DIRECTIONS.map((d) => (
          <MenuItem key={d} value={d}>
            {d}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

// ── Shape rows ────────────────────────────────────────────────────────────────

function ShapeLabel({ label }) {
  return (
    <Typography variant="body2" sx={{ width: 52, fontWeight: 500, flexShrink: 0 }}>
      {label}
    </Typography>
  )
}

function CrossRow({ shape, onChange, onRemove }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
      <ShapeLabel label="Cross" />
      <TextField
        label="Radius"
        size="small"
        sx={{ width: 100 }}
        value={shape.radius}
        onChange={(e) => onChange({ ...shape, radius: e.target.value })}
        inputProps={{ inputMode: 'numeric' }}
      />
      <VisualEffectSelect
        value={shape.visualEffect}
        onChange={(v) => onChange({ ...shape, visualEffect: v })}
      />
      <IconButton size="small" color="error" onClick={onRemove}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

function ConeRow({ shape, onChange, onRemove }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
      <ShapeLabel label="Cone" />
      <TextField
        label="Radius"
        size="small"
        sx={{ width: 100 }}
        value={shape.radius}
        onChange={(e) => onChange({ ...shape, radius: e.target.value })}
        inputProps={{ inputMode: 'numeric' }}
      />
      <DirectionSelect
        value={shape.direction}
        onChange={(v) => onChange({ ...shape, direction: v })}
      />
      <VisualEffectSelect
        value={shape.visualEffect}
        onChange={(v) => onChange({ ...shape, visualEffect: v })}
      />
      <IconButton size="small" color="error" onClick={onRemove}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

function SquareRow({ shape, onChange, onRemove }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
      <ShapeLabel label="Square" />
      <TextField
        label="Side"
        size="small"
        sx={{ width: 100 }}
        value={shape.side}
        onChange={(e) => onChange({ ...shape, side: e.target.value })}
        inputProps={{ inputMode: 'numeric' }}
      />
      <VisualEffectSelect
        value={shape.visualEffect}
        onChange={(v) => onChange({ ...shape, visualEffect: v })}
      />
      <IconButton size="small" color="error" onClick={onRemove}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

function LineRow({ shape, onChange, onRemove }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
      <ShapeLabel label="Line" />
      <TextField
        label="Length"
        size="small"
        sx={{ width: 100 }}
        value={shape.length}
        onChange={(e) => onChange({ ...shape, length: e.target.value })}
        inputProps={{ inputMode: 'numeric' }}
      />
      <DirectionSelect
        value={shape.direction}
        onChange={(v) => onChange({ ...shape, direction: v })}
      />
      <VisualEffectSelect
        value={shape.visualEffect}
        onChange={(v) => onChange({ ...shape, visualEffect: v })}
      />
      <IconButton size="small" color="error" onClick={onRemove}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

function TileRow({ shape, onChange, onRemove }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
      <ShapeLabel label="Tile" />
      <DirectionSelect
        value={shape.direction}
        onChange={(v) => onChange({ ...shape, direction: v })}
      />
      <TextField
        label="Rel X"
        size="small"
        sx={{ width: 80 }}
        value={shape.relativeX}
        onChange={(e) => onChange({ ...shape, relativeX: e.target.value })}
        inputProps={{ inputMode: 'numeric' }}
      />
      <TextField
        label="Rel Y"
        size="small"
        sx={{ width: 80 }}
        value={shape.relativeY}
        onChange={(e) => onChange({ ...shape, relativeY: e.target.value })}
        inputProps={{ inputMode: 'numeric' }}
      />
      <VisualEffectSelect
        value={shape.visualEffect}
        onChange={(v) => onChange({ ...shape, visualEffect: v })}
      />
      <IconButton size="small" color="error" onClick={onRemove}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

// ── Single intent ─────────────────────────────────────────────────────────────

function IntentItem({ intent, index, onChange, onRemove }) {
  const [open, setOpen] = useState(true)

  const set = (field, val) => onChange({ ...intent, [field]: val })

  // Generic helper for any shape array
  const addShape = (key, def) => set(key, [...(intent[key] || []), { ...def }])
  const updateShape = (key, i, val) =>
    set(
      key,
      intent[key].map((s, idx) => (idx === i ? val : s))
    )
  const removeShape = (key, i) =>
    set(
      key,
      intent[key].filter((_, idx) => idx !== i)
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
        <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
          Intent {index + 1}
          {intent.useType ? ` — ${intent.useType}` : ''}
        </Typography>
        <Tooltip title="Remove intent">
          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {open ? (
          <ExpandLessIcon fontSize="small" sx={{ ml: 0.5 }} />
        ) : (
          <ExpandMoreIcon fontSize="small" sx={{ ml: 0.5 }} />
        )}
      </Box>

      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* UseType + MaxTargets */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Use Type</InputLabel>
              <Select
                value={intent.useType || 'NoTarget'}
                label="Use Type"
                onChange={(e) => set('useType', e.target.value)}
              >
                {SPELL_USE_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Max Targets"
              size="small"
              sx={{ width: 120 }}
              value={intent.maxTargets}
              onChange={(e) => set('maxTargets', e.target.value)}
              inputProps={{ inputMode: 'numeric' }}
            />
          </Box>

          {/* Flags */}
          <Autocomplete
            multiple
            options={INTENT_FLAGS}
            value={intent.flags || []}
            onChange={(_, val) => set('flags', val)}
            disableCloseOnSelect
            size="small"
            renderTags={(value, getTagProps) =>
              value.map((option, i) => (
                <Chip key={option} label={option} size="small" {...getTagProps({ index: i })} />
              ))
            }
            renderInput={(params) => <TextField {...params} label="Flags" />}
          />

          {/* Shapes container */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
              <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 15 }} />
              <Typography variant="caption" color="text.secondary">
                For self-target effects, use NoTarget with no shapes.
              </Typography>
            </Box>

            <Box
              component="fieldset"
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1.5,
                m: 0,
                '& legend': {
                  px: 0.75,
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  lineHeight: 1
                }
              }}
            >
              <legend>Shapes</legend>

              {/* Map checkbox */}
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={intent.map}
                    onChange={(e) => set('map', e.target.checked)}
                  />
                }
                label={<Typography variant="body2">Map (entire map)</Typography>}
                sx={{ m: 0, mb: 1 }}
              />

              {/* Add shape buttons */}
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addShape('crosses', DEFAULT_CROSS)}
                >
                  Cross
                </Button>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addShape('cones', DEFAULT_CONE)}
                >
                  Cone
                </Button>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addShape('squares', DEFAULT_SQUARE)}
                >
                  Square
                </Button>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addShape('lines', DEFAULT_LINE)}
                >
                  Line
                </Button>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addShape('tiles', DEFAULT_TILE)}
                >
                  Tile
                </Button>
              </Box>

              {/* Shape rows */}
              {intent.crosses?.map((s, i) => (
                <CrossRow
                  key={`cross-${i}`}
                  shape={s}
                  onChange={(v) => updateShape('crosses', i, v)}
                  onRemove={() => removeShape('crosses', i)}
                />
              ))}
              {intent.cones?.map((s, i) => (
                <ConeRow
                  key={`cone-${i}`}
                  shape={s}
                  onChange={(v) => updateShape('cones', i, v)}
                  onRemove={() => removeShape('cones', i)}
                />
              ))}
              {intent.squares?.map((s, i) => (
                <SquareRow
                  key={`square-${i}`}
                  shape={s}
                  onChange={(v) => updateShape('squares', i, v)}
                  onRemove={() => removeShape('squares', i)}
                />
              ))}
              {intent.lines?.map((s, i) => (
                <LineRow
                  key={`line-${i}`}
                  shape={s}
                  onChange={(v) => updateShape('lines', i, v)}
                  onRemove={() => removeShape('lines', i)}
                />
              ))}
              {intent.tiles?.map((s, i) => (
                <TileRow
                  key={`tile-${i}`}
                  shape={s}
                  onChange={(v) => updateShape('tiles', i, v)}
                  onRemove={() => removeShape('tiles', i)}
                />
              ))}

              {/* Empty state */}
              {!intent.map &&
                !intent.crosses?.length &&
                !intent.cones?.length &&
                !intent.squares?.length &&
                !intent.lines?.length &&
                !intent.tiles?.length && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    No shapes added.
                  </Typography>
                )}
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  )
}

// ── Exported section ─────────────────────────────────────────────────────────

function IntentsSection({ intents, onChange }) {
  const addIntent = () => onChange([...intents, { ...DEFAULT_INTENT }])
  const updateIntent = (i, v) => onChange(intents.map((x, idx) => (idx === i ? v : x)))
  const removeIntent = (i) => onChange(intents.filter((_, idx) => idx !== i))

  return (
    <Box>
      {intents.map((intent, i) => (
        <IntentItem
          key={i}
          intent={intent}
          index={i}
          onChange={(val) => updateIntent(i, val)}
          onRemove={() => removeIntent(i)}
        />
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={addIntent}>
        Add Intent
      </Button>
    </Box>
  )
}

export default IntentsSection
