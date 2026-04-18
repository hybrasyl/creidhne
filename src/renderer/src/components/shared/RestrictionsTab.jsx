import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  IconButton,
  Button,
  Autocomplete,
  Divider,
  Chip
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { useRecoilValue } from 'recoil'
import {
  CLASS_TYPES,
  GENDERS,
  SLOT_RESTRICTION_TYPES,
  EQUIPMENT_SLOTS
} from '../../data/itemConstants'
import { libraryIndexState } from '../../recoil/atoms'

const ALL_CLASS_OPTIONS = CLASS_TYPES.filter((c) => c !== 'All')

function RestrictionsTab({ data, onChange }) {
  const libraryIndex = useRecoilValue(libraryIndexState)
  const castableNames = libraryIndex.castables || []
  const npcStringKeys = libraryIndex.npcStringKeys || []

  const r = data.restrictions ?? {
    level: { min: '', max: '' },
    ab: null,
    class: '',
    gender: 'Neutral',
    castables: [],
    slotRestrictions: []
  }

  const setRestriction = (field) => (e) =>
    onChange({ ...data, restrictions: { ...r, [field]: e.target.value } })

  const setSubField = (parent, field) => (e) =>
    onChange({
      ...data,
      restrictions: { ...r, [parent]: { ...r[parent], [field]: e.target.value } }
    })

  // ── Class multi-select ─────────────────────────────────────────────────────
  const selectedClasses =
    r.class === 'All'
      ? [...ALL_CLASS_OPTIONS] // backward-compat with existing data
      : (r.class || '').split(' ').filter(Boolean)

  const handleClassChange = (_, newVal) => {
    if (newVal.includes('All')) {
      // Toggle: if all are currently selected, deselect all; otherwise select all
      const allSelected = ALL_CLASS_OPTIONS.every((c) => selectedClasses.includes(c))
      onChange({
        ...data,
        restrictions: { ...r, class: allSelected ? '' : ALL_CLASS_OPTIONS.join(' ') }
      })
      return
    }
    onChange({ ...data, restrictions: { ...r, class: newVal.join(' ') } })
  }

  // ── AB ────────────────────────────────────────────────────────────────────
  const setAbField = (field) => (e) => {
    const val = e.target.value
    const current = r.ab || { min: '', max: '' }
    const next = { ...current, [field]: val }
    onChange({ ...data, restrictions: { ...r, ab: !next.min && !next.max ? null : next } })
  }

  // ── Castables ─────────────────────────────────────────────────────────────
  const addCastable = () =>
    onChange({ ...data, restrictions: { ...r, castables: [...r.castables, ''] } })

  const setCastable = (index, val) => {
    const updated = r.castables.map((c, i) => (i === index ? val : c))
    onChange({ ...data, restrictions: { ...r, castables: updated } })
  }

  const removeCastable = (index) => {
    onChange({
      ...data,
      restrictions: { ...r, castables: r.castables.filter((_, i) => i !== index) }
    })
  }

  // ── Slot restrictions ──────────────────────────────────────────────────────
  const addSlotRestriction = () =>
    onChange({
      ...data,
      restrictions: {
        ...r,
        slotRestrictions: [
          ...r.slotRestrictions,
          { type: 'ItemRequired', slot: 'None', message: '' }
        ]
      }
    })

  const setSlotRestriction = (index, field, val) => {
    const updated = r.slotRestrictions.map((sr, i) => (i === index ? { ...sr, [field]: val } : sr))
    onChange({ ...data, restrictions: { ...r, slotRestrictions: updated } })
  }

  const removeSlotRestriction = (index) => {
    onChange({
      ...data,
      restrictions: { ...r, slotRestrictions: r.slotRestrictions.filter((_, i) => i !== index) }
    })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Level, AB, Gender on one line */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Level Min"
          type="number"
          value={r.level.min}
          placeholder="1"
          size="small"
          sx={{ width: 110 }}
          onChange={setSubField('level', 'min')}
          slotProps={{
            htmlInput: { min: 1, max: 99 }
          }}
        />
        <TextField
          label="Level Max"
          type="number"
          value={r.level.max}
          placeholder="99"
          size="small"
          sx={{ width: 110 }}
          onChange={setSubField('level', 'max')}
          slotProps={{
            htmlInput: { min: 1, max: 99 }
          }}
        />
        <TextField
          label="AB Min"
          type="number"
          value={r.ab?.min ?? ''}
          size="small"
          sx={{ width: 100 }}
          onChange={setAbField('min')}
          slotProps={{
            htmlInput: { min: 0, max: 99 }
          }}
        />
        <TextField
          label="AB Max"
          type="number"
          value={r.ab?.max ?? ''}
          size="small"
          sx={{ width: 100 }}
          onChange={setAbField('max')}
          slotProps={{
            htmlInput: { min: 0, max: 99 }
          }}
        />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Gender</InputLabel>
          <Select value={r.gender} label="Gender" onChange={setRestriction('gender')}>
            {GENDERS.map((g) => (
              <MenuItem key={g} value={g}>
                {g}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      {/* Class picker — blank = no restriction; "All" = select/deselect all */}
      <Autocomplete
        multiple
        options={['All', ...ALL_CLASS_OPTIONS]}
        value={selectedClasses}
        onChange={handleClassChange}
        disableCloseOnSelect
        renderValue={(value, getItemProps) =>
          value.map((option, index) => (
            <Chip key={option} label={option} size="small" {...getItemProps({ index })} />
          ))
        }
        renderInput={(params) => (
          <TextField {...params} size="small" label="Classes (blank = no restriction)" />
        )}
      />
      <Divider />
      <Typography variant="subtitle2">Required Castables</Typography>
      {r.castables.map((castable, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
          <Autocomplete
            freeSolo
            options={castableNames}
            value={castable}
            onInputChange={(_, val, reason) => {
              if (reason === 'input') setCastable(index, val)
            }}
            onChange={(_, val) => setCastable(index, val ?? '')}
            size="small"
            sx={{ flex: 1 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={`Castable ${index + 1}`}
                slotProps={{
                  ...params.slotProps,
                  htmlInput: { ...params.slotProps.htmlInput, maxLength: 255 }
                }}
              />
            )}
          />
          <IconButton size="small" color="error" onClick={() => removeCastable(index)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button startIcon={<AddIcon />} size="small" onClick={addCastable} sx={{ mb: 1 }}>
        Add Castable
      </Button>
      <Divider />
      <Typography variant="subtitle2">Slot Restrictions</Typography>
      {r.slotRestrictions.map((sr, index) => {
        const matchedKey = npcStringKeys.find((s) => s.key === sr.message)
        return (
          <Box key={index} sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={sr.type}
                  label="Type"
                  onChange={(e) => setSlotRestriction(index, 'type', e.target.value)}
                >
                  {SLOT_RESTRICTION_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Slot</InputLabel>
                <Select
                  value={sr.slot}
                  label="Slot"
                  onChange={(e) => setSlotRestriction(index, 'slot', e.target.value)}
                >
                  {EQUIPMENT_SLOTS.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Autocomplete
                options={npcStringKeys}
                value={matchedKey || null}
                onChange={(_, val) => setSlotRestriction(index, 'message', val?.key ?? '')}
                getOptionLabel={(opt) => opt.key}
                isOptionEqualToValue={(opt, val) => opt.key === val.key}
                size="small"
                sx={{ minWidth: 200, flex: 1 }}
                renderInput={(params) => <TextField {...params} label="Message Key" />}
              />
              <IconButton size="small" color="error" onClick={() => removeSlotRestriction(index)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
            {matchedKey && (
              <TextField
                label="Message Preview"
                value={matchedKey.message}
                size="small"
                sx={{ pl: 0 }}
                slotProps={{
                  htmlInput: { readOnly: true },
                  inputLabel: { shrink: true }
                }} />
            )}
          </Box>
        );
      })}
      <Button startIcon={<AddIcon />} size="small" onClick={addSlotRestriction}>
        Add Slot Restriction
      </Button>
    </Box>
  );
}

export default RestrictionsTab
