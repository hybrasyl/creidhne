import { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  Chip
} from '@mui/material'
import BUILTIN_PATTERNS from '../../data/formulaPatterns'
import { buildCoefficientKey } from '../../utils/formulaCoefficients'
import { generateHybridPair } from '../../utils/formulaBuild'

const EFFECTS = [
  { key: 'DMG', label: 'Damage' },
  { key: 'HEAL', label: 'Heal' },
  { key: 'CONV', label: 'Conversion' }
]
const TARGETINGS = [
  { key: 'ST', label: 'Single Target' },
  { key: 'AOE', label: 'AOE' }
]

const clampPct = (v) => Math.max(0, Math.min(100, v))

// A hybrid is one spell authored as two complementary formulas: a direct hit
// (used by a castable) and an over-time tick (used by a status), split by a
// direct/over-time percentage. This dialog generates that linked pair.
export default function HybridGeneratorDialog({
  open,
  onClose,
  settings,
  existingNames,
  defaultPatternId,
  onGenerate
}) {
  const [baseName, setBaseName] = useState('')
  const [effect, setEffect] = useState('DMG')
  const [targeting, setTargeting] = useState('ST')
  const [spellOrSkill, setSpellOrSkill] = useState('spell')
  const [patternId, setPatternId] = useState(defaultPatternId || '')
  const [directPct, setDirectPct] = useState(50)

  // Reset to defaults each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setBaseName('')
    setEffect('DMG')
    setTargeting('ST')
    setSpellOrSkill('spell')
    setPatternId(defaultPatternId || '')
    setDirectPct(50)
  }, [open, defaultPatternId])

  const trimmed = baseName.trim()
  const overtimeSuffix = effect === 'HEAL' ? '_hot' : '_dot'
  const directName = trimmed ? `${trimmed}_direct` : ''
  const overtimeName = trimmed ? `${trimmed}${overtimeSuffix}` : ''

  const directKey = buildCoefficientKey(effect, targeting, 'HDIR')
  const overtimeKey = buildCoefficientKey(effect, targeting, 'HYOT')

  const nameError = useMemo(() => {
    if (!trimmed) return null
    const taken = existingNames || new Set()
    if (taken.has(directName.toLowerCase())) return `"${directName}" already exists`
    if (taken.has(overtimeName.toLowerCase())) return `"${overtimeName}" already exists`
    return null
  }, [trimmed, directName, overtimeName, existingNames])

  const canGenerate = !!trimmed && !nameError

  const handleGenerate = () => {
    if (!canGenerate) return
    const pair = generateHybridPair(
      {
        baseName: trimmed,
        effect,
        targeting,
        spellOrSkill,
        patternId: patternId || null,
        directPct: clampPct(Number(directPct) || 0),
        pairId: crypto.randomUUID(),
        directId: crypto.randomUUID(),
        overtimeId: crypto.randomUUID()
      },
      settings
    )
    onGenerate(pair)
  }

  const overtimePct = 100 - clampPct(Number(directPct) || 0)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Hybrid Formula</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Generates two linked formulas — a direct hit (for a castable) and an over-time tick (for a
          status) — split by a direct/over-time percentage.
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Base name"
            size="small"
            required
            autoFocus
            value={baseName}
            onChange={(e) => setBaseName(e.target.value)}
            error={!!nameError}
            helperText={
              nameError || 'e.g. "fireball" → fireball_direct + ' + `fireball${overtimeSuffix}`
            }
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Effect</InputLabel>
              <Select value={effect} label="Effect" onChange={(e) => setEffect(e.target.value)}>
                {EFFECTS.map((x) => (
                  <MenuItem key={x.key} value={x.key}>
                    {x.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Targeting</InputLabel>
              <Select
                value={targeting}
                label="Targeting"
                onChange={(e) => setTargeting(e.target.value)}
              >
                {TARGETINGS.map((x) => (
                  <MenuItem key={x.key} value={x.key}>
                    {x.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Class</InputLabel>
              <Select
                value={spellOrSkill}
                label="Class"
                onChange={(e) => setSpellOrSkill(e.target.value)}
              >
                <MenuItem value="spell">Spell</MenuItem>
                <MenuItem value="skill">Skill</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel shrink>Pattern</InputLabel>
              <Select
                value={patternId}
                label="Pattern"
                displayEmpty
                notched
                onChange={(e) => setPatternId(e.target.value)}
              >
                <MenuItem value="">
                  <em>None (hand-edit later)</em>
                </MenuItem>
                {BUILTIN_PATTERNS.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="number"
              label="Direct %"
              sx={{ width: 110 }}
              value={directPct}
              onChange={(e) =>
                setDirectPct(e.target.value === '' ? '' : clampPct(Number(e.target.value)))
              }
              slotProps={{ htmlInput: { min: 0, max: 100, step: 5 } }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Direct {clampPct(Number(directPct) || 0)}% / Over-time {overtimePct}%
            </Typography>
          </Box>

          {trimmed && (
            <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip size="small" label={directName} sx={{ fontFamily: 'monospace' }} />
                  <Typography variant="caption">castable · {directKey}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip size="small" label={overtimeName} sx={{ fontFamily: 'monospace' }} />
                  <Typography variant="caption">status · {overtimeKey}</Typography>
                </Box>
              </Box>
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleGenerate} disabled={!canGenerate}>
          Generate pair
        </Button>
      </DialogActions>
    </Dialog>
  )
}
