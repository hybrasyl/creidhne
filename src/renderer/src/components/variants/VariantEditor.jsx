import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box, Button, Typography, Divider, TextField, IconButton, Tooltip,
  Paper, Collapse, Checkbox, FormControlLabel, Chip, Autocomplete,
  FormControl, InputLabel, Select, MenuItem, Snackbar, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditorHeader from '../shared/EditorHeader';
import StatsTab from '../shared/StatsTab';
import RestrictionsTab from '../shared/RestrictionsTab';
import ItemSpritePicker from '../shared/ItemSpritePicker';
import ColorSwatch from '../shared/ColorSwatch';
import { useItemColorSwatches } from '../../data/itemColorData';
import HelpIcon from '@mui/icons-material/Help';
import { ITEM_TAGS, ITEM_FLAGS, ITEM_BODY_STYLES, ITEM_COLORS } from '../../data/itemConstants';
import { useRecoilValue } from 'recoil';
import { libraryIndexState } from '../../recoil/atoms';

function deriveVariantPrefix(fileName, name) {
  if (!fileName) return 'vg';
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '');
  const base = fileName.replace(/\.xml$/i, '');
  if (safe && base.endsWith(`_${safe}`)) {
    const p = base.slice(0, base.length - safe.length - 1);
    return p || 'vg';
  }
  return 'vg';
}

function computeVariantFilename(prefix, name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '');
  if (!safe) return '';
  return `${prefix || 'vg'}_${safe}.xml`;
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
      bodyStyle: '', color: '', hideBoots: false,
    },
    flags: [],
    physical: { value: '', weight: '', durability: '' },
    restrictions: {
      level: { min: '', max: '' }, ab: null,
      class: '', gender: 'Neutral', castables: [], slotRestrictions: [],
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
  const [openFlags, setOpenFlags] = useState(false);
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
  const colorSwatches = useItemColorSwatches();

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

          {/* ── Header (no title): Name, Modifier, Script, Stackable Max, Tags ── */}
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

          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* ── Flags ── */}
          <Section title="Flags" open={openFlags} onToggle={() => setOpenFlags((v) => !v)}>
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
          </Section>

          {/* ── Appearance ── */}
          <Section title="Appearance" open={openAppearance} onToggle={() => setOpenAppearance((v) => !v)}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <ItemSpritePicker
                value={p.appearance.sprite}
                onChange={(val) => setAppearanceField('sprite')({ target: { value: val } })}
                helpTooltip="Icon shown on the ground, in inventory, and in vendor menus."
              />
              <ItemSpritePicker
                label="Equip Sprite"
                value={p.appearance.equipSprite}
                onChange={(val) => setAppearanceField('equipSprite')({ target: { value: val } })}
                helpTooltip="Override for the icon shown on the paperdoll/inventory screen when equipped. Leave 0 to reuse Sprite."
              />
              <TextField
                label="Display Sprite" type="number" value={p.appearance.displaySprite} size="small" sx={{ width: 140 }}
                onChange={setAppearanceField('displaySprite')} inputProps={{ min: 0, max: 65535 }}
              />
              <Tooltip title="Overlay applied to the character model. Only used for Weapon, Armor, Shield, Helmet, Foot, Trousers, Coat, SecondAcc, and ThirdAcc slots." placement="top">
                <IconButton size="small" sx={{ color: 'text.secondary' }}>
                  <HelpIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Body Style</InputLabel>
                <Select value={p.appearance.bodyStyle} label="Body Style" onChange={setAppearanceField('bodyStyle')}>
                  {ITEM_BODY_STYLES.map((s) => <MenuItem key={s || '__blank'} value={s}>{s || '(none)'}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Color</InputLabel>
                <Select
                  value={p.appearance.color}
                  label="Color"
                  onChange={setAppearanceField('color')}
                  renderValue={(val) => (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{val || '(none)'}</span>
                      {colorSwatches && val && <ColorSwatch colors={colorSwatches.get(val)} />}
                    </Box>
                  )}
                >
                  {ITEM_COLORS.map((c) => (
                    <MenuItem key={c || '__blank'} value={c}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                        <span>{c || '(none)'}</span>
                        {colorSwatches && c && (
                          <Box sx={{ ml: 'auto' }}>
                            <ColorSwatch colors={colorSwatches.get(c)} />
                          </Box>
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Checkbox size="small" checked={p.appearance.hideBoots}
                    onChange={(e) => updateProp('appearance', { ...p.appearance, hideBoots: e.target.checked })} />
                }
                label="Hide Boots"
              />
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
  const libraryIndex = useRecoilValue(libraryIndexState);

  const [data, setData] = useState(variantGroup);
  const [prefix, setPrefix] = useState(deriveVariantPrefix(initialFileName, variantGroup.name));
  const [fileName, setFileName] = useState(initialFileName || computeVariantFilename(deriveVariantPrefix(initialFileName, variantGroup.name), variantGroup.name));
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName);

  const isDirtyRef = useRef(false);

  useEffect(() => {
    const derivedPrefix = deriveVariantPrefix(initialFileName, variantGroup.name);
    setData(variantGroup);
    setPrefix(derivedPrefix);
    setFileName(initialFileName || computeVariantFilename(derivedPrefix, variantGroup.name));
    setFileNameEdited(!!initialFileName);
    isDirtyRef.current = false;
    setDupSnack(null);
    onDirtyChange?.(false);
  }, [variantGroup, initialFileName]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirtyLocal = useCallback(() => {
    if (!isDirtyRef.current) { isDirtyRef.current = true; onDirtyChange?.(true); }
  }, [onDirtyChange]);

  const updateData = useCallback((updater) => {
    markDirtyLocal();
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!fileNameEdited) setFileName(computeVariantFilename(prefix, next.name));
      return next;
    });
  }, [fileNameEdited, prefix, markDirtyLocal]);

  const handlePrefixChange = (e) => {
    markDirtyLocal();
    const p = e.target.value;
    setPrefix(p);
    if (!fileNameEdited) setFileName(computeVariantFilename(p, data.name));
  };

  const handleRegenerate = () => {
    markDirtyLocal();
    setFileName(computeVariantFilename(prefix, data.name));
    setFileNameEdited(false);
  };

  // ── Duplicate detection ──────────────────────────────────────────────────────

  const dupStatus = useMemo(() => {
    const name = (data.name || '').trim();
    if (!name) return null;
    const originalName = isExisting ? (variantGroup.name || '') : '';
    if (originalName && name.toLowerCase() === originalName.toLowerCase()) return null;

    const activeNames = libraryIndex?.variantgroups || [];
    if (activeNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'active';

    const archivedNames = libraryIndex?.archivedVariantgroups || [];
    if (archivedNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'archived';

    return null;
  }, [data.name, libraryIndex, isExisting, variantGroup.name]);

  const [dupSnack, setDupSnack] = useState(null);
  const handleNameBlur = () => { if (dupStatus) setDupSnack(dupStatus); };

  if (saveRef) saveRef.current = () => onSave(data, fileName);

  const addVariant = () =>
    updateData((d) => ({ ...d, variants: [...d.variants, makeDefaultVariant()] }));

  const updateVariant = (index, variant) =>
    updateData((d) => ({ ...d, variants: d.variants.map((v, i) => i === index ? variant : v) }));

  const removeVariant = (index) =>
    updateData((d) => ({ ...d, variants: d.variants.filter((_, i) => i !== index) }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <EditorHeader
        title={data.name || '(unnamed variant group)'}
        entityLabel="variant group"
        fileName={fileName}
        initialFileName={initialFileName}
        computedFileName={computeVariantFilename(prefix, data.name)}
        isExisting={isExisting}
        isArchived={isArchived}
        onFileNameChange={(val) => { markDirtyLocal(); setFileName(val); setFileNameEdited(true); }}
        onRegenerate={handleRegenerate}
        onSave={() => onSave(data, fileName)}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />

      <Divider sx={{ mb: 1, flexShrink: 0 }} />

      {/* ── Form ── */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>

        {/* ── Group fields (headerless section) ── */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Prefix" value={prefix} size="small" sx={{ width: 140 }}
                inputProps={{ maxLength: 64, spellCheck: false }}
                onChange={handlePrefixChange}
              />
              <TextField
                label="Group Name" required value={data.name} size="small"
                sx={{
                  flex: 1, minWidth: 160,
                  ...(dupStatus === 'archived' && {
                    '& .MuiOutlinedInput-root fieldset': { borderColor: 'warning.main' },
                    '& .MuiInputLabel-root:not(.Mui-focused)': { color: 'warning.main' },
                    '& .MuiFormHelperText-root': { color: 'warning.main' },
                  }),
                }}
                error={dupStatus === 'active'}
                helperText={
                  dupStatus === 'active'   ? `"${data.name}" already exists` :
                  dupStatus === 'archived' ? `"${data.name}" exists in archive` :
                  undefined
                }
                inputProps={{ maxLength: 255 }}
                onChange={(e) => updateData((d) => ({ ...d, name: e.target.value }))}
                onBlur={handleNameBlur}
              />
            </Box>
            <TextField
              label="Comment" value={data.comment} size="small" multiline minRows={2}
              inputProps={{ maxLength: 65534 }}
              onChange={(e) => updateData((d) => ({ ...d, comment: e.target.value }))}
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

      <Snackbar
        open={!!dupSnack}
        autoHideDuration={5000}
        onClose={() => setDupSnack(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={dupSnack === 'archived' ? 'warning' : 'error'} onClose={() => setDupSnack(null)} sx={{ width: '100%' }}>
          {dupSnack === 'active'
            ? `"${data.name}" already exists!`
            : `"${data.name}" exists in archive`}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default VariantEditor;
