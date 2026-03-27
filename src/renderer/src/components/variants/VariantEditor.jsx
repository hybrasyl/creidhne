import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Typography, Divider, TextField, Tooltip, IconButton,
  Paper, Collapse, Switch, Checkbox, FormControlLabel, Chip, Autocomplete,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import StatsTab from '../items/tabs/StatsTab';
import RestrictionsTab from '../items/tabs/RestrictionsTab';
import { ITEM_TAGS, ITEM_FLAGS, ITEM_BODY_STYLES, ITEM_COLORS } from '../../data/itemConstants';

function computeVariantFilename(name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '');
  if (!safe) return '';
  return `${safe}.xml`;
}

const makeDefaultVariant = () => ({
  name: '',
  modifier: '',
  comment: '',
  properties: {
    tags: [],
    script: '',
    stackable: { max: '' },
    appearance: {
      sprite: '', equipSprite: '', displaySprite: '',
      styleEnabled: false, bodyStyle: 'Transparent', color: 'None', hideBoots: false,
    },
    flags: [],
    physical: { value: '', weight: '', durability: '' },
    restrictions: {
      level: { min: '1', max: '99' }, ab: null,
      class: 'All', gender: 'Neutral', castables: [], slotRestrictions: [],
    },
    statModifiers: { rows: [], elementalModifiers: [] },
  },
});

// ── Collapsible section wrapper ───────────────────────────────────────────────
function Section({ title, open, onToggle, children }) {
  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Box
        sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, cursor: 'pointer', userSelect: 'none' }}
        onClick={onToggle}
      >
        <Typography variant="subtitle2" sx={{ flex: 1 }}>{title}</Typography>
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>
      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2 }}>{children}</Box>
      </Collapse>
    </Paper>
  );
}

// ── Individual Variant Accordion ──────────────────────────────────────────────
function VariantAccordion({ variant, index, onChange, onRemove }) {
  const [open, setOpen] = useState(true);
  const [openAppearance, setOpenAppearance] = useState(true);
  const [openPhysical, setOpenPhysical] = useState(true);
  const [openRestrictions, setOpenRestrictions] = useState(true);

  const p = variant.properties;

  const update = (field, value) =>
    onChange({ ...variant, [field]: value });

  const updateProp = (key, value) =>
    onChange({ ...variant, properties: { ...p, [key]: value } });

  const toggleFlag = (flag) => {
    const next = p.flags.includes(flag)
      ? p.flags.filter((f) => f !== flag)
      : [...p.flags, flag];
    updateProp('flags', next);
  };

  const setAppearanceField = (field) => (e) =>
    updateProp('appearance', { ...p.appearance, [field]: e.target.value });

  const setAppearanceCheck = (field) => (e) =>
    updateProp('appearance', { ...p.appearance, [field]: e.target.checked });

  const toggleStyle = (e) =>
    updateProp('appearance', {
      ...p.appearance,
      styleEnabled: e.target.checked,
      ...(e.target.checked ? {} : { bodyStyle: 'Transparent', color: 'None', hideBoots: false }),
    });

  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      {/* Accordion header */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen((v) => !v)}
      >
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {variant.name || `Variant ${index + 1}`}
        </Typography>
        <IconButton
          size="small" color="error"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>

      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2 }}>

          {/* ── Header (no title): Name, Modifier, Script, Stackable Max, Tags, Flags ── */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Name" required value={variant.name} size="small" sx={{ flex: 1, minWidth: 120 }}
                inputProps={{ maxLength: 255 }}
                onChange={(e) => update('name', e.target.value)}
              />
              <TextField
                label="Modifier" required value={variant.modifier} size="small" sx={{ flex: 1, minWidth: 120 }}
                inputProps={{ maxLength: 255 }}
                onChange={(e) => update('modifier', e.target.value)}
              />
              <TextField
                label="Script" value={p.script} size="small" sx={{ flex: 1, minWidth: 120 }}
                inputProps={{ maxLength: 255 }}
                onChange={(e) => updateProp('script', e.target.value)}
              />
              <TextField
                label="Stackable Max" type="number" value={p.stackable.max} size="small" sx={{ width: 130 }}
                inputProps={{ min: 1, max: 255 }}
                onChange={(e) => updateProp('stackable', { max: e.target.value })}
              />
            </Box>

            <Autocomplete
              multiple options={ITEM_TAGS} value={p.tags}
              onChange={(_, val) => updateProp('tags', val)}
              renderTags={(value, getTagProps) =>
                value.map((option, idx) => (
                  <Chip key={option} label={option} size="small" {...getTagProps({ index: idx })} />
                ))
              }
              renderInput={(params) => <TextField {...params} size="small" label="Tags" />}
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>Flags</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                {ITEM_FLAGS.map((flag) => (
                  <FormControlLabel
                    key={flag}
                    control={
                      <Checkbox checked={p.flags.includes(flag)} onChange={() => toggleFlag(flag)} size="small" />
                    }
                    label={<Typography variant="body2">{flag}</Typography>}
                    sx={{ width: '33%', m: 0 }}
                  />
                ))}
              </Box>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* ── Appearance ── */}
          <Section title="Appearance" open={openAppearance} onToggle={() => setOpenAppearance((v) => !v)}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  label="Sprite" type="number" value={p.appearance.sprite} size="small" sx={{ width: 140 }}
                  onChange={setAppearanceField('sprite')} inputProps={{ min: 0, max: 65535 }}
                />
                <TextField
                  label="Equip Sprite" type="number" value={p.appearance.equipSprite} size="small" sx={{ width: 140 }}
                  onChange={setAppearanceField('equipSprite')} inputProps={{ min: 0, max: 65535 }}
                />
                <TextField
                  label="Display Sprite" type="number" value={p.appearance.displaySprite} size="small" sx={{ width: 140 }}
                  onChange={setAppearanceField('displaySprite')} inputProps={{ min: 0, max: 65535 }}
                />
              </Box>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ flex: 1 }}>Style Override</Typography>
                  <Switch size="small" checked={p.appearance.styleEnabled} onChange={toggleStyle} />
                </Box>
                {p.appearance.styleEnabled && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>Body Style</InputLabel>
                        <Select value={p.appearance.bodyStyle} label="Body Style" onChange={setAppearanceField('bodyStyle')}>
                          {ITEM_BODY_STYLES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Color</InputLabel>
                        <Select value={p.appearance.color} label="Color" onChange={setAppearanceField('color')}>
                          {ITEM_COLORS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <FormControlLabel
                        control={
                          <Checkbox size="small" checked={p.appearance.hideBoots} onChange={setAppearanceCheck('hideBoots')} />
                        }
                        label="Hide Boots"
                      />
                    </Box>
                  </>
                )}
              </Paper>
            </Box>
          </Section>

          {/* ── Physical ── */}
          <Section title="Physical" open={openPhysical} onToggle={() => setOpenPhysical((v) => !v)}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  label="Weight" type="number" value={p.physical.weight} size="small" sx={{ width: 130 }}
                  onChange={(e) => updateProp('physical', { ...p.physical, weight: e.target.value })}
                  inputProps={{ min: 0, step: 0.01 }}
                />
                <TextField
                  label="Value" type="number" value={p.physical.value} size="small" sx={{ width: 130 }}
                  onChange={(e) => updateProp('physical', { ...p.physical, value: e.target.value })}
                  inputProps={{ min: 0, step: 0.01 }}
                />
                <TextField
                  label="Durability" type="number" value={p.physical.durability} size="small" sx={{ width: 130 }}
                  onChange={(e) => updateProp('physical', { ...p.physical, durability: e.target.value })}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Box>
              <StatsTab
                data={p.statModifiers}
                onChange={(updated) => updateProp('statModifiers', updated)}
              />
            </Box>
          </Section>

          {/* ── Restrictions ── */}
          <Section title="Restrictions" open={openRestrictions} onToggle={() => setOpenRestrictions((v) => !v)}>
            <RestrictionsTab
              data={{ restrictions: p.restrictions }}
              onChange={(updated) => updateProp('restrictions', updated.restrictions)}
            />
          </Section>

        </Box>
      </Collapse>
    </Paper>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────
function VariantEditor({ variantGroup, initialFileName, isArchived, isExisting, onSave, onArchive, onUnarchive, onDirtyChange, saveRef }) {
  const [data, setData] = useState(variantGroup);
  const [fileName, setFileName] = useState(initialFileName || computeVariantFilename(variantGroup.name));
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName);

  const isDirtyRef = useRef(false);

  useEffect(() => {
    setData(variantGroup);
    setFileName(initialFileName || computeVariantFilename(variantGroup.name));
    setFileNameEdited(!!initialFileName);
    isDirtyRef.current = false;
    onDirtyChange?.(false);
  }, [variantGroup, initialFileName]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirtyLocal = useCallback(() => {
    if (!isDirtyRef.current) { isDirtyRef.current = true; onDirtyChange?.(true); }
  }, [onDirtyChange]);

  const updateData = useCallback((updater) => {
    markDirtyLocal();
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!fileNameEdited) setFileName(computeVariantFilename(next.name));
      return next;
    });
  }, [fileNameEdited, markDirtyLocal]);

  const handleRegenerate = () => {
    markDirtyLocal();
    setFileName(computeVariantFilename(data.name));
    setFileNameEdited(false);
  };

  if (saveRef) saveRef.current = () => onSave(data, fileName);

  const addVariant = () =>
    updateData((d) => ({ ...d, variants: [...d.variants, makeDefaultVariant()] }));

  const updateVariant = (index, variant) =>
    updateData((d) => ({ ...d, variants: d.variants.map((v, i) => i === index ? variant : v) }));

  const removeVariant = (index) =>
    updateData((d) => ({ ...d, variants: d.variants.filter((_, i) => i !== index) }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>
            {data.name || '(unnamed variant group)'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {isExisting && !isArchived && (
              <Tooltip title="Archive variant group">
                <IconButton size="small" onClick={onArchive}><ArchiveIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
            {isExisting && isArchived && (
              <Tooltip title="Unarchive variant group">
                <IconButton size="small" onClick={onUnarchive}><UnarchiveIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
            <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={() => onSave(data, fileName)}>
              Save
            </Button>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TextField
            size="small" label="Filename" value={fileName}
            onChange={(e) => { markDirtyLocal(); setFileName(e.target.value); setFileNameEdited(true); }}
            sx={{ flex: 1 }} inputProps={{ spellCheck: false }}
          />
          <Tooltip title="Regenerate from name">
            <IconButton size="small" onClick={handleRegenerate}><AutorenewIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Divider sx={{ mb: 1, flexShrink: 0 }} />

      {/* ── Form ── */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>

        {/* ── Group fields (headerless section) ── */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Group Name" required value={data.name} size="small"
              inputProps={{ maxLength: 255 }}
              onChange={(e) => updateData((d) => ({ ...d, name: e.target.value }))}
            />
            <TextField
              label="Comment" value={data.comment} size="small" multiline minRows={2}
              inputProps={{ maxLength: 65534 }}
              onChange={(e) => updateData((d) => ({ ...d, comment: e.target.value }))}
            />
            <TextField
              label="Prefix" value={data.prefix} size="small"
              inputProps={{ maxLength: 255 }}
              onChange={(e) => updateData((d) => ({ ...d, prefix: e.target.value }))}
            />
          </Box>
        </Paper>

        {/* ── Variants ── */}
        {data.variants.map((variant, index) => (
          <VariantAccordion
            key={index}
            variant={variant}
            index={index}
            onChange={(updated) => updateVariant(index, updated)}
            onRemove={() => removeVariant(index)}
          />
        ))}

        <Button variant="outlined" startIcon={<AddIcon />} onClick={addVariant} sx={{ mb: 2 }}>
          Add Variant
        </Button>

        <Box sx={{ height: 32 }} />
      </Box>
    </Box>
  );
}

export default VariantEditor;
