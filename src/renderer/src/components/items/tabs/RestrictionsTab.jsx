import {
  Box, TextField, Select, MenuItem, FormControl, InputLabel,
  Typography, IconButton, Button, Autocomplete, Divider, Switch,
  Chip, Paper,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useRecoilValue } from 'recoil';
import { CLASS_TYPES, GENDERS, SLOT_RESTRICTION_TYPES, EQUIPMENT_SLOTS } from '../../../data/itemConstants';
import { libraryIndexState } from '../../../recoil/atoms';

const ALL_CLASS_OPTIONS = CLASS_TYPES.filter((c) => c !== 'All');
const DEFAULT_AB = { min: '0', max: '255' };

function RestrictionsTab({ data, onChange }) {
  const libraryIndex = useRecoilValue(libraryIndexState);
  const castableNames = libraryIndex.castables || [];

  const r = data.restrictions ?? {
    level: { min: '1', max: '99' },
    ab: null,
    class: 'All',
    gender: 'Neutral',
    castables: [],
    slotRestrictions: [],
  };

  const setRestriction = (field) => (e) =>
    onChange({ ...data, restrictions: { ...r, [field]: e.target.value } });

  const setSubField = (parent, field) => (e) =>
    onChange({ ...data, restrictions: { ...r, [parent]: { ...r[parent], [field]: e.target.value } } });

  // Class multi-select
  const selectedClasses =
    r.class === 'All'
      ? [...ALL_CLASS_OPTIONS]
      : (r.class || '').split(' ').filter(Boolean);

  const handleClassChange = (_, newVal) => {
    if (newVal.includes('All')) {
      onChange({ ...data, restrictions: { ...r, class: ALL_CLASS_OPTIONS.join(' ') } });
      return;
    }
    const joined = newVal.join(' ');
    onChange({ ...data, restrictions: { ...r, class: joined || ALL_CLASS_OPTIONS.join(' ') } });
  };

  // AB
  const toggleAb = (e) =>
    onChange({ ...data, restrictions: { ...r, ab: e.target.checked ? { ...DEFAULT_AB } : null } });

  const setAbField = (field) => (e) =>
    onChange({ ...data, restrictions: { ...r, ab: { ...r.ab, [field]: e.target.value } } });

  // Castables
  const addCastable = () =>
    onChange({ ...data, restrictions: { ...r, castables: [...r.castables, ''] } });

  const setCastable = (index, val) => {
    const updated = r.castables.map((c, i) => (i === index ? val : c));
    onChange({ ...data, restrictions: { ...r, castables: updated } });
  };

  const removeCastable = (index) => {
    onChange({ ...data, restrictions: { ...r, castables: r.castables.filter((_, i) => i !== index) } });
  };

  // Slot restrictions
  const addSlotRestriction = () =>
    onChange({
      ...data,
      restrictions: {
        ...r,
        slotRestrictions: [...r.slotRestrictions, { type: 'ItemRequired', slot: 'None', message: '' }],
      },
    });

  const setSlotRestriction = (index, field, val) => {
    const updated = r.slotRestrictions.map((sr, i) => (i === index ? { ...sr, [field]: val } : sr));
    onChange({ ...data, restrictions: { ...r, slotRestrictions: updated } });
  };

  const removeSlotRestriction = (index) => {
    onChange({ ...data, restrictions: { ...r, slotRestrictions: r.slotRestrictions.filter((_, i) => i !== index) } });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField label="Level Min" type="number" value={r.level.min} size="small" sx={{ width: 120 }}
          onChange={setSubField('level', 'min')} inputProps={{ min: 0, max: 255 }} />
        <TextField label="Level Max" type="number" value={r.level.max} size="small" sx={{ width: 120 }}
          onChange={setSubField('level', 'max')} inputProps={{ min: 0, max: 255 }} />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Gender</InputLabel>
          <Select value={r.gender} label="Gender" onChange={setRestriction('gender')}>
            {GENDERS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      <Autocomplete
        multiple
        options={['All', ...ALL_CLASS_OPTIONS]}
        value={selectedClasses}
        onChange={handleClassChange}
        disableCloseOnSelect
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip key={option} label={option} size="small" {...getTagProps({ index })} />
          ))
        }
        renderInput={(params) => <TextField {...params} size="small" label="Classes" />}
      />

      {/* AB sub-paper */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: r.ab ? 1.5 : 0 }}>
          <Typography variant="body2" sx={{ flex: 1 }}>AB Restriction</Typography>
          <Switch size="small" checked={r.ab !== null} onChange={toggleAb} />
        </Box>
        {r.ab !== null && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField label="AB Min" type="number" value={r.ab.min} size="small" sx={{ width: 120 }}
              onChange={setAbField('min')} inputProps={{ min: 0, max: 255 }} />
            <TextField label="AB Max" type="number" value={r.ab.max} size="small" sx={{ width: 120 }}
              onChange={setAbField('max')} inputProps={{ min: 0, max: 255 }} />
          </Box>
        )}
      </Paper>

      <Divider />

      <Typography variant="subtitle2">Required Castables</Typography>
      {r.castables.map((castable, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
          <Autocomplete
            freeSolo options={castableNames} value={castable}
            onInputChange={(_, val) => setCastable(index, val)}
            size="small" sx={{ flex: 1 }}
            renderInput={(params) => (
              <TextField {...params} label={`Castable ${index + 1}`} inputProps={{ ...params.inputProps, maxLength: 255 }} />
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
      {r.slotRestrictions.map((sr, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Type</InputLabel>
            <Select value={sr.type} label="Type" onChange={(e) => setSlotRestriction(index, 'type', e.target.value)}>
              {SLOT_RESTRICTION_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Slot</InputLabel>
            <Select value={sr.slot} label="Slot" onChange={(e) => setSlotRestriction(index, 'slot', e.target.value)}>
              {EQUIPMENT_SLOTS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Message" value={sr.message} size="small" sx={{ flex: 1, minWidth: 160 }}
            onChange={(e) => setSlotRestriction(index, 'message', e.target.value)} inputProps={{ maxLength: 255 }} />
          <IconButton size="small" color="error" onClick={() => removeSlotRestriction(index)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button startIcon={<AddIcon />} size="small" onClick={addSlotRestriction}>
        Add Slot Restriction
      </Button>
    </Box>
  );
}

export default RestrictionsTab;
