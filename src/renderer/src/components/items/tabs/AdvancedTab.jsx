import React from 'react';
import {
  Box, TextField, Autocomplete, Typography, Paper, IconButton, Button,
  Select, MenuItem, FormControl, InputLabel, FormControlLabel, Checkbox,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useRecoilValue } from 'recoil';
import { ITEM_FLAGS, PROC_EVENT_TYPES } from '../../../data/itemConstants';
import { libraryIndexState } from '../../../recoil/atoms';

const DEFAULT_PROC = { type: 'OnUse', castable: '', script: '', chance: '0' };
const DEFAULT_CAST_MODIFIER = { group: '', castable: '', all: false, add: [], subtract: [], replace: [] };
const DEFAULT_OP = { match: '-1', amount: '0', min: '-1', max: '255' };

function AdvancedTab({ data, onChange }) {
  const libraryIndex = useRecoilValue(libraryIndexState);
  const castableNames = libraryIndex.castables || [];

  // Flags
  const toggleFlag = (flag) => {
    const next = data.flags.includes(flag)
      ? data.flags.filter((f) => f !== flag)
      : [...data.flags, flag];
    onChange({ ...data, flags: next });
  };

  // Categories
  const addCategory = () =>
    onChange({ ...data, categories: [...data.categories, { name: '', unique: false }] });
  const setCategory = (index, field, val) => {
    const updated = data.categories.map((c, i) => (i === index ? { ...c, [field]: val } : c));
    onChange({ ...data, categories: updated });
  };
  const removeCategory = (index) =>
    onChange({ ...data, categories: data.categories.filter((_, i) => i !== index) });

  // Variant groups
  const addVariantGroup = () =>
    onChange({ ...data, variants: { ...data.variants, groups: [...data.variants.groups, ''] } });
  const setVariantGroup = (index, val) => {
    const updated = data.variants.groups.map((g, i) => (i === index ? val : g));
    onChange({ ...data, variants: { ...data.variants, groups: updated } });
  };
  const removeVariantGroup = (index) =>
    onChange({
      ...data,
      variants: { ...data.variants, groups: data.variants.groups.filter((_, i) => i !== index) },
    });

  // Motions
  const addMotion = () =>
    onChange({ ...data, motions: [...data.motions, { id: '', speed: '' }] });
  const setMotion = (index, field, val) => {
    const updated = data.motions.map((m, i) => (i === index ? { ...m, [field]: val } : m));
    onChange({ ...data, motions: updated });
  };
  const removeMotion = (index) =>
    onChange({ ...data, motions: data.motions.filter((_, i) => i !== index) });

  // CastModifiers
  const addCastModifier = () =>
    onChange({ ...data, castModifiers: [...data.castModifiers, { ...DEFAULT_CAST_MODIFIER }] });
  const setCastModifier = (index, field, val) => {
    const updated = data.castModifiers.map((m, i) => (i === index ? { ...m, [field]: val } : m));
    onChange({ ...data, castModifiers: updated });
  };
  const removeCastModifier = (index) =>
    onChange({ ...data, castModifiers: data.castModifiers.filter((_, i) => i !== index) });

  // Procs
  const addProc = () =>
    onChange({ ...data, procs: [...data.procs, { ...DEFAULT_PROC }] });
  const setProc = (index, field, val) => {
    const updated = data.procs.map((p, i) => (i === index ? { ...p, [field]: val } : p));
    onChange({ ...data, procs: updated });
  };
  const removeProc = (index) =>
    onChange({ ...data, procs: data.procs.filter((_, i) => i !== index) });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Flags</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
          {ITEM_FLAGS.map((flag) => (
            <FormControlLabel
              key={flag}
              control={
                <Checkbox
                  checked={data.flags.includes(flag)}
                  onChange={() => toggleFlag(flag)}
                  size="small"
                />
              }
              label={<Typography variant="body2">{flag}</Typography>}
              sx={{ width: '33%', m: 0 }}
            />
          ))}
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Categories</Typography>
        {data.categories.map((cat, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
            <TextField
              label="Category"
              value={cat.name}
              onChange={(e) => setCategory(index, 'name', e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              inputProps={{ maxLength: 255 }}
            />
            <IconButton size="small" color="error" onClick={() => removeCategory(index)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button startIcon={<AddIcon />} size="small" onClick={addCategory}>
          Add Category
        </Button>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Variant Groups</Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Reference variant groups that apply to this item.
        </Typography>
        {data.variants.groups.map((group, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
            <TextField
              label="Group Name"
              value={group}
              onChange={(e) => setVariantGroup(index, e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              inputProps={{ maxLength: 255 }}
            />
            <IconButton size="small" color="error" onClick={() => removeVariantGroup(index)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button startIcon={<AddIcon />} size="small" onClick={addVariantGroup}>
          Add Variant Group
        </Button>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Motions</Typography>
        {data.motions.map((motion, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
            <TextField
              label="ID"
              value={motion.id}
              onChange={(e) => setMotion(index, 'id', e.target.value)}
              size="small"
              sx={{ width: 100 }}
            />
            <TextField
              label="Speed"
              value={motion.speed}
              onChange={(e) => setMotion(index, 'speed', e.target.value)}
              size="small"
              sx={{ width: 100 }}
            />
            <IconButton size="small" color="error" onClick={() => removeMotion(index)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button startIcon={<AddIcon />} size="small" onClick={addMotion}>
          Add Motion
        </Button>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Cast Modifiers</Typography>
        {data.castModifiers.map((cm, cmIdx) => {
          const updateOps = (field, ops) => setCastModifier(cmIdx, field, ops);
          const addOp = (field) => updateOps(field, [...cm[field], { ...DEFAULT_OP }]);
          const setOp = (field, opIdx, key, val) =>
            updateOps(field, cm[field].map((op, i) => i === opIdx ? { ...op, [key]: val } : op));
          const removeOp = (field, opIdx) =>
            updateOps(field, cm[field].filter((_, i) => i !== opIdx));

          return (
            <Box key={cmIdx} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, mb: 1 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
                <TextField label="Group" value={cm.group} size="small" sx={{ flex: 1, minWidth: 120 }}
                  onChange={(e) => setCastModifier(cmIdx, 'group', e.target.value)} inputProps={{ maxLength: 255 }} />
                <Autocomplete
                  freeSolo
                  options={castableNames}
                  value={cm.castable}
                  onInputChange={(_, val) => setCastModifier(cmIdx, 'castable', val)}
                  size="small"
                  sx={{ flex: 1, minWidth: 160 }}
                  renderInput={(params) => <TextField {...params} label="Castable" />}
                />
                <FormControlLabel control={<Checkbox checked={cm.all} size="small"
                  onChange={(e) => setCastModifier(cmIdx, 'all', e.target.checked)} />} label="All" />
                <IconButton size="small" color="error" onClick={() => removeCastModifier(cmIdx)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>

              {['add', 'subtract', 'replace'].map((field) => (
                <Box key={field} sx={{ pl: 1, mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                    {field}
                  </Typography>
                  {cm[field].map((op, opIdx) => (
                    <Box key={opIdx} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 0.5 }}>
                      <TextField label="Match" value={op.match} size="small" sx={{ width: 100 }}
                        onChange={(e) => setOp(field, opIdx, 'match', e.target.value)} />
                      <TextField label="Amount" value={op.amount} size="small" sx={{ width: 100 }}
                        onChange={(e) => setOp(field, opIdx, 'amount', e.target.value)} />
                      <TextField label="Min" value={op.min} size="small" sx={{ width: 90 }}
                        onChange={(e) => setOp(field, opIdx, 'min', e.target.value)} />
                      <TextField label="Max" value={op.max} size="small" sx={{ width: 90 }}
                        onChange={(e) => setOp(field, opIdx, 'max', e.target.value)} />
                      <IconButton size="small" color="error" onClick={() => removeOp(field, opIdx)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                  <Button size="small" startIcon={<AddIcon />} onClick={() => addOp(field)} sx={{ mt: 0.5 }}>
                    Add {field}
                  </Button>
                </Box>
              ))}
            </Box>
          );
        })}
        <Button startIcon={<AddIcon />} size="small" onClick={addCastModifier}>
          Add Match
        </Button>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Procs</Typography>
        {data.procs.map((proc, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Event Type</InputLabel>
              <Select
                value={proc.type}
                label="Event Type"
                onChange={(e) => setProc(index, 'type', e.target.value)}
              >
                {PROC_EVENT_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Autocomplete
              freeSolo
              options={castableNames}
              value={proc.castable}
              onInputChange={(_, val) => setProc(index, 'castable', val)}
              size="small"
              sx={{ flex: 1, minWidth: 140 }}
              renderInput={(params) => <TextField {...params} label="Castable" />}
            />
            <TextField
              label="Script"
              value={proc.script}
              onChange={(e) => setProc(index, 'script', e.target.value)}
              size="small"
              sx={{ flex: 1, minWidth: 120 }}
            />
            <TextField
              label="Chance"
              type="number"
              value={proc.chance}
              onChange={(e) => setProc(index, 'chance', e.target.value)}
              inputProps={{ min: 0, max: 1, step: 0.01 }}
              size="small"
              sx={{ width: 100 }}
            />
            <IconButton size="small" color="error" onClick={() => removeProc(index)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button startIcon={<AddIcon />} size="small" onClick={addProc}>
          Add Proc
        </Button>
      </Paper>
    </Box>
  );
}

export default AdvancedTab;
