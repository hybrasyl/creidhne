import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import { libraryIndexState } from '../../recoil/atoms';
import ConstantAutocomplete from '../shared/ConstantAutocomplete';
import ScriptAutocomplete from '../shared/ScriptAutocomplete';
import EditorHeader from '../shared/EditorHeader';
import {
  Box, Button, Typography, Divider, TextField, Tooltip, IconButton, Paper,
  Select, MenuItem, FormControl, InputLabel, FormControlLabel, Checkbox,
  Autocomplete, Chip, Collapse, Snackbar, Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import {
  CASTABLE_BOOKS, CASTABLE_DESCRIPTION_CLASSES, CASTABLE_COST_TYPES,
  ALL_CASTABLE_CLASSES, computeCastableFilename, derivePrefix, MASTERY_MODIFIERS, BOOK_ABBREVS,
} from '../../data/castableConstants';
import IntentsSection from './IntentsSection';
import RestrictionsSection from './RestrictionsSection';
import ReactorsSection from './ReactorsSection';
import StatusesSection from './StatusesSection';
import FormulasSection from './FormulasSection';
import AnimationsSection from './AnimationsSection';
import RequirementsSection from './RequirementsSection';
import { ELEMENT_TYPES } from '../../data/itemConstants';
import CommentField from '../shared/CommentField';

const ALL_CLASS_SET = new Set(ALL_CASTABLE_CLASSES);
function isAllClasses(classStr) {
  const parts = (classStr || '').split(' ').filter(Boolean);
  return parts.length === ALL_CLASS_SET.size && parts.every((c) => ALL_CLASS_SET.has(c));
}

function deriveMetaPrefix(meta, book) {
  let tag = null;
  if (meta?.isTest) tag = '1test';
  else if (meta?.isGM) tag = '3gm';
  else if (meta?.deprecated) tag = '2arch';
  if (!tag) return null;
  const bookPart = BOOK_ABBREVS[book] || '';
  return bookPart ? `${tag}_${bookPart}` : tag;
}

// ── Section wrapper ─────────────────────────────────────────────────────────

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

// ── Main editor ──────────────────────────────────────────────────────────────

function CastableEditor({
  castable, initialFileName, isArchived, isExisting,
  onSave, onArchive, onUnarchive, onDirtyChange, saveRef,
}) {
  const [data, setData] = useState(castable);
  const [prefix, setPrefix] = useState(
    () => deriveMetaPrefix(castable.meta, castable.book) ?? derivePrefix(castable.class, castable.book)
  );
  const [prefixEdited, setPrefixEdited] = useState(false);
  const [fileName, setFileName] = useState(() => {
    if (initialFileName) return initialFileName;
    const p = deriveMetaPrefix(castable.meta, castable.book) ?? derivePrefix(castable.class, castable.book);
    return computeCastableFilename(p, castable.name);
  });
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName);

  const [openDescriptions, setOpenDescriptions] = useState(true);
  const [openCategories,   setOpenCategories]   = useState(true);
  const [openCastCosts,    setOpenCastCosts]    = useState(true);
  const [openIntents,      setOpenIntents]      = useState(true);
  const [openMaxLevel,     setOpenMaxLevel]     = useState(true);
  const [openScript,       setOpenScript]       = useState(true);
  const [openRequirements, setOpenRequirements] = useState(true);
  const [openVisualAudio,  setOpenVisualAudio]  = useState(true);
  const [openMastery,      setOpenMastery]      = useState(true);
  const [openFormulas,     setOpenFormulas]     = useState(true);
  const [openStatuses,     setOpenStatuses]     = useState(true);
  const [openRestrictions, setOpenRestrictions] = useState(true);
  const [openReactors,     setOpenReactors]     = useState(true);

  const libraryIndex = useRecoilValue(libraryIndexState);

  const isDirtyRef = useRef(false);

  // ── Duplicate detection ────────────────────────────────────────────────────

  const dupStatus = useMemo(() => {
    const name = (data.name || '').trim();
    if (!name) return null;
    // Don't flag the castable's own current saved name
    const originalName = isExisting ? (castable.name || '') : '';
    if (originalName && name.toLowerCase() === originalName.toLowerCase()) return null;

    const activeNames = libraryIndex?.castables || [];
    if (activeNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'active';

    const archivedNames = libraryIndex?.archivedCastables || [];
    if (archivedNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'archived';

    return null;
  }, [data.name, libraryIndex, isExisting, castable.name]);

  const [dupSnack, setDupSnack] = useState(null);
  const handleNameBlur = () => { if (dupStatus) setDupSnack(dupStatus); };

  useEffect(() => {
    const derivedPrefix = deriveMetaPrefix(castable.meta, castable.book) ?? derivePrefix(castable.class, castable.book);
    setData(castable);
    setPrefix(derivedPrefix);
    setPrefixEdited(false);
    setFileName(initialFileName || computeCastableFilename(derivedPrefix, castable.name));
    setFileNameEdited(!!initialFileName);
    isDirtyRef.current = false;
    setDupSnack(null);
    onDirtyChange?.(false);
  }, [castable, initialFileName]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirty = useCallback(() => {
    if (!isDirtyRef.current) { isDirtyRef.current = true; onDirtyChange?.(true); }
  }, [onDirtyChange]);

  const updateData = useCallback((updater) => {
    markDirty();
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!fileNameEdited) setFileName(computeCastableFilename(prefix, next.name));
      return next;
    });
  }, [fileNameEdited, prefix, markDirty]);

  const set = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.value }));
  const setChecked = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.checked }));
  const setMeta = (field) => (e) => updateData((d) => ({ ...d, meta: { ...d.meta, [field]: e.target.checked } }));
  const setMetaText = (field) => (e) => updateData((d) => ({ ...d, meta: { ...d.meta, [field]: e.target.value } }));

  const handleMetaOverrideChange = (field) => (e) => {
    const checked = e.target.checked;
    const newMeta = {
      ...data.meta,
      isTest: false, isGM: false, deprecated: false,
      [field]: checked,
    };
    const overridePrefix = deriveMetaPrefix(newMeta, data.book);
    const newPrefix = overridePrefix ?? derivePrefix(data.class, data.book);
    setPrefix(newPrefix);
    if (overridePrefix !== null) setPrefixEdited(false);
    if (!fileNameEdited) setFileName(computeCastableFilename(newPrefix, data.name));
    updateData((d) => ({ ...d, meta: newMeta }));
  };

  // ── Class multiselect ──────────────────────────────────────────────────────

  const selectedClasses = (data.class || '').split(' ').filter(Boolean);

  const handleClassChange = (_, newVal) => {
    let joined;
    if (newVal.includes('All')) {
      // Toggle: if all classes are already present, clear; otherwise select all
      joined = isAllClasses(data.class) ? '' : ALL_CASTABLE_CLASSES.join(' ');
    } else {
      joined = newVal.join(' ');
    }
    if (!prefixEdited && !deriveMetaPrefix(data.meta, data.book)) {
      const derived = derivePrefix(joined, data.book);
      setPrefix(derived);
      if (!fileNameEdited) setFileName(computeCastableFilename(derived, data.name));
    }
    updateData((d) => ({ ...d, class: joined }));
  };

  // ── Prefix ─────────────────────────────────────────────────────────────────

  const handlePrefixChange = (e) => {
    markDirty();
    setPrefix(e.target.value);
    setPrefixEdited(true);
    if (!fileNameEdited) setFileName(computeCastableFilename(e.target.value, data.name));
  };

  // ── Filename ───────────────────────────────────────────────────────────────

  const handleRegenerate = () => {
    markDirty();
    setFileName(computeCastableFilename(prefix, data.name));
    setFileNameEdited(false);
  };

  const handleSave = () => onSave(data, fileName);
  if (saveRef) saveRef.current = handleSave;

  // ── Descriptions ───────────────────────────────────────────────────────────

  const addDescription = () =>
    updateData((d) => ({ ...d, descriptions: [...d.descriptions, { class: '', text: '' }] }));
  const setDescription = (i, field, val) =>
    updateData((d) => ({ ...d, descriptions: d.descriptions.map((x, idx) => idx === i ? { ...x, [field]: val } : x) }));
  const removeDescription = (i) =>
    updateData((d) => ({ ...d, descriptions: d.descriptions.filter((_, idx) => idx !== i) }));

  // ── Categories ─────────────────────────────────────────────────────────────

  const addCategory = () =>
    updateData((d) => ({ ...d, categories: [...d.categories, ''] }));
  const setCategory = (i, val) =>
    updateData((d) => ({ ...d, categories: d.categories.map((c, idx) => idx === i ? val : c) }));
  const removeCategory = (i) =>
    updateData((d) => ({ ...d, categories: d.categories.filter((_, idx) => idx !== i) }));

  // ── Cast costs ─────────────────────────────────────────────────────────────

  const addCastCost = () =>
    updateData((d) => ({ ...d, castCosts: [...d.castCosts, { type: 'Hp', value: '', quantity: '1', itemName: '' }] }));
  const setCastCost = (i, field, val) =>
    updateData((d) => ({ ...d, castCosts: d.castCosts.map((c, idx) => idx === i ? { ...c, [field]: val } : c) }));
  const setCastCostType = (i, newType) =>
    updateData((d) => ({ ...d, castCosts: d.castCosts.map((c, idx) =>
      idx === i ? { type: newType, value: '', quantity: '1', itemName: '' } : c
    )}));
  const removeCastCost = (i) =>
    updateData((d) => ({ ...d, castCosts: d.castCosts.filter((_, idx) => idx !== i) }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ── */}
      <EditorHeader
        title={data.name || '(unnamed castable)'}
        entityLabel="castable"
        fileName={fileName}
        initialFileName={initialFileName}
        computedFileName={computeCastableFilename(prefix, data.name)}
        isExisting={isExisting}
        isArchived={isArchived}
        onFileNameChange={(val) => { markDirty(); setFileName(val); setFileNameEdited(true); }}
        onRegenerate={handleRegenerate}
        onSave={handleSave}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />

      <Divider sx={{ mb: 1, flexShrink: 0 }} />

      <Box sx={{ flex: 1, overflow: 'auto' }}>

        {/* ── Basic fields (headerless) ── */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Line 1: Name + Prefix */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                label="Name" required size="small"
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
                value={data.name} onChange={set('name')} onBlur={handleNameBlur} inputProps={{ maxLength: 255 }}
              />
              <TextField
                label="Prefix" size="small" sx={{ width: 150 }}
                value={prefix} onChange={handlePrefixChange}
                inputProps={{ maxLength: 64, spellCheck: false }}
              />
            </Box>

            {/* Line 2: Lines, Cooldown, Icon, Book, Elements */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <TextField
                label="Lines" size="small" sx={{ width: 100 }}
                value={data.lines} onChange={set('lines')}
                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
              />
              <TextField
                label="Cooldown" size="small" sx={{ width: 100 }}
                value={data.cooldown} onChange={set('cooldown')}
                inputProps={{ inputMode: 'numeric' }}
              />
              <TextField
                label="Icon" size="small" sx={{ width: 100 }}
                value={data.icon} onChange={set('icon')}
                inputProps={{ inputMode: 'numeric' }}
              />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Book</InputLabel>
                <Select
                  value={data.book} label="Book"
                  onChange={(e) => {
                    const newBook = e.target.value;
                    if (!prefixEdited) {
                      const newPrefix = deriveMetaPrefix(data.meta, newBook) ?? derivePrefix(data.class, newBook);
                      setPrefix(newPrefix);
                      if (!fileNameEdited) setFileName(computeCastableFilename(newPrefix, data.name));
                    }
                    updateData((d) => ({ ...d, book: newBook }));
                  }}
                >
                  {CASTABLE_BOOKS.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                </Select>
              </FormControl>
              <Autocomplete
                options={ELEMENT_TYPES}
                value={data.elements || 'None'}
                onChange={(_, val) => updateData((d) => ({ ...d, elements: val || 'None' }))}
                disableClearable
                size="small"
                sx={{ width: 180 }}
                renderInput={(params) => <TextField {...params} label="Elements" />}
              />
            </Box>

            {/* Line 3: Class */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <Autocomplete
                multiple
                options={['All', ...ALL_CASTABLE_CLASSES]}
                value={selectedClasses}
                onChange={handleClassChange}
                disableCloseOnSelect
                size="small"
                sx={{ flex: 1, minWidth: 220 }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip key={option} label={option} size="small" {...getTagProps({ index })} />
                  ))
                }
                renderInput={(params) => <TextField {...params} label="Class" />}
              />
            </Box>

            {/* Line 4: Checkboxes */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={<Checkbox size="small" checked={data.isAssail} onChange={setChecked('isAssail')} />}
                label={<Typography variant="body2">Is Assail</Typography>}
                sx={{ m: 0 }}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={data.reflectable} onChange={setChecked('reflectable')} />}
                label={<Typography variant="body2">Reflectable</Typography>}
                sx={{ m: 0 }}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={data.breakStealth} onChange={setChecked('breakStealth')} />}
                label={<Typography variant="body2">Breaks Stealth</Typography>}
                sx={{ m: 0 }}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={data.includeInMetafile} onChange={setChecked('includeInMetafile')} />}
                label={<Typography variant="body2">Include in Metafile</Typography>}
                sx={{ m: 0 }}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={data.pvpOnly} onChange={setChecked('pvpOnly')} />}
                label={<Typography variant="body2">PvP Only</Typography>}
                sx={{ m: 0 }}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={data.scriptOverride} onChange={setChecked('scriptOverride')} />}
                label={<Typography variant="body2">Script Override</Typography>}
                sx={{ m: 0 }}
              />
            </Box>

            {/* Line 5: Export metadata */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControlLabel
                control={<Checkbox size="small" checked={!!data.meta?.isTest} onChange={handleMetaOverrideChange('isTest')} />}
                label={<Typography variant="body2">Test Ability</Typography>}
                sx={{ m: 0 }}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={!!data.meta?.isGM} onChange={handleMetaOverrideChange('isGM')} />}
                label={<Typography variant="body2">GM Ability</Typography>}
                sx={{ m: 0 }}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={!!data.meta?.deprecated} onChange={handleMetaOverrideChange('deprecated')} />}
                label={<Typography variant="body2">Deprecated</Typography>}
                sx={{ m: 0 }}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={!!data.meta?.givenViaScript} onChange={setMeta('givenViaScript')} />}
                label={<Typography variant="body2">Given via Script</Typography>}
                sx={{ m: 0 }}
              />
              <TextField
                label="Specialty" size="small" sx={{ width: 180 }}
                value={data.meta?.specialty || ''} onChange={setMetaText('specialty')}
                placeholder="e.g. Scorpion"
              />
              {(() => {
                const trainers = libraryIndex.castableTrainers?.[data.name?.toLowerCase()] || [];
                const label = trainers.length > 0
                  ? trainers.join(', ')
                  : data.meta?.givenViaScript ? 'Via script' : 'Unassigned';
                return (
                  <TextField
                    label="Assigned Trainer" size="small" sx={{ flex: 1, minWidth: 180 }}
                    value={label} inputProps={{ readOnly: true }}
                    InputLabelProps={{ shrink: true }}
                  />
                );
              })()}
            </Box>

            <CommentField value={data.comment} onChange={set('comment')} />

          </Box>
        </Paper>

        {/* ── Descriptions ── */}
        <Section title="Descriptions" open={openDescriptions} onToggle={() => setOpenDescriptions((v) => !v)}>
          {data.descriptions.map((desc, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <FormControl size="small" sx={{ width: 160 }}>
                <InputLabel>Class</InputLabel>
                <Select
                  value={isAllClasses(desc.class) ? 'All' : (desc.class || '')}
                  label="Class"
                  onChange={(e) => {
                    const val = e.target.value;
                    setDescription(i, 'class', val === 'All' ? ALL_CASTABLE_CLASSES.join(' ') : val);
                  }}
                >
                  <MenuItem value="All">All</MenuItem>
                  {CASTABLE_DESCRIPTION_CLASSES.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Description" size="small" sx={{ flex: 1 }}
                value={desc.text} onChange={(e) => setDescription(i, 'text', e.target.value)}
              />
              <IconButton size="small" color="error" onClick={() => removeDescription(i)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addDescription}>
            Add Description
          </Button>
        </Section>

        {/* ── Categories ── */}
        <Section title="Categories" open={openCategories} onToggle={() => setOpenCategories((v) => !v)}>
          {data.categories.map((cat, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <ConstantAutocomplete
                indexKey="castableCategories" label="Category" sx={{ flex: 1 }}
                value={cat} onChange={(val) => setCategory(i, val)}
                inputProps={{ maxLength: 255 }}
              />
              <IconButton size="small" color="error" onClick={() => removeCategory(i)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addCategory}>
            Add Category
          </Button>
        </Section>

        {/* ── Intents ── */}
        <Section title="Intents" open={openIntents} onToggle={() => setOpenIntents((v) => !v)}>
          <IntentsSection
            intents={data.intents || []}
            onChange={(val) => updateData((d) => ({ ...d, intents: val }))}
          />
        </Section>

        {/* ── Cast Costs ── */}
        <Section title="Cast Costs" open={openCastCosts} onToggle={() => setOpenCastCosts((v) => !v)}>
          {data.castCosts.map((cost, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ width: 110 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={cost.type} label="Type"
                  onChange={(e) => setCastCostType(i, e.target.value)}
                >
                  {CASTABLE_COST_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {cost.type !== 'Item' ? (
                <TextField
                  label="Value" size="small" sx={{ flex: 1, minWidth: 160 }}
                  value={cost.value}
                  onChange={(e) => setCastCost(i, 'value', e.target.value)}
                  placeholder="number or formula"
                />
              ) : (
                <>
                  <TextField
                    label="Quantity" size="small" sx={{ width: 100 }}
                    value={cost.quantity}
                    onChange={(e) => setCastCost(i, 'quantity', e.target.value)}
                    inputProps={{ inputMode: 'numeric' }}
                  />
                  <Autocomplete
                    freeSolo
                    options={libraryIndex.items || []}
                    value={cost.itemName || ''}
                    onInputChange={(_, val, reason) => { if (reason === 'input') setCastCost(i, 'itemName', val); }}
                    onChange={(_, val) => setCastCost(i, 'itemName', val ?? '')}
                    size="small" sx={{ flex: 1, minWidth: 160 }}
                    renderInput={(params) => <TextField {...params} label="Item Name" />}
                  />
                </>
              )}

              <IconButton size="small" color="error" onClick={() => removeCastCost(i)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addCastCost}>
            Add Cast Cost
          </Button>
        </Section>

        {/* ── Max Level ── */}
        <Section title="Max Level" open={openMaxLevel} onToggle={() => setOpenMaxLevel((v) => !v)}>
          {(() => {
            const ml = data.maxLevel || {};
            const setMl = (field, val) =>
              updateData((d) => ({ ...d, maxLevel: { ...d.maxLevel, [field]: val } }));
            const CLASS_LEVEL_FIELDS = [
              { key: 'monk',    label: 'Monk'    },
              { key: 'warrior', label: 'Warrior' },
              { key: 'peasant', label: 'Peasant' },
              { key: 'wizard',  label: 'Wizard'  },
              { key: 'priest',  label: 'Priest'  },
              { key: 'rogue',   label: 'Rogue'   },
            ];
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <FormControlLabel
                  control={
                    <Checkbox size="small" checked={!!ml.deprecated}
                      onChange={(e) => setMl('deprecated', e.target.checked)} />
                  }
                  label={
                    <Typography variant="body2">
                      Deprecated — saves as a comment for historical reference
                    </Typography>
                  }
                  sx={{ m: 0 }}
                />
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {CLASS_LEVEL_FIELDS.map(({ key, label }) => (
                    <TextField
                      key={key}
                      label={label}
                      size="small"
                      sx={{ width: 100 }}
                      value={ml[key] || ''}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                        setMl(key, v === '' ? '' : String(Math.min(99, Number(v))));
                      }}
                      inputProps={{ inputMode: 'numeric' }}
                    />
                  ))}
                </Box>
              </Box>
            );
          })()}
        </Section>

        {/* ── Script ── */}
        <Section title="Script" open={openScript} onToggle={() => setOpenScript((v) => !v)}>
          <ScriptAutocomplete
            freeSolo label="Script" fullWidth
            value={data.script || ''}
            onChange={(val) => updateData((d) => ({ ...d, script: val }))}
          />
        </Section>

        {/* ── Visual / Audio ── */}
        <Section title="Visual / Audio" open={openVisualAudio} onToggle={() => setOpenVisualAudio((v) => !v)}>
          <AnimationsSection
            sound={data.sound || { id: '' }}
            animations={data.animations}
            motions={libraryIndex?.motions || []}
            onSoundChange={(val) => updateData((d) => ({ ...d, sound: val }))}
            onAnimationsChange={(val) => updateData((d) => ({ ...d, animations: val }))}
          />
        </Section>

        {/* ── Formulas (Heal / Damage) ── */}
        <Section title="Formulas" open={openFormulas} onToggle={() => setOpenFormulas((v) => !v)}>
          <FormulasSection
            heal={data.heal ?? null}
            damage={data.damage ?? null}
            onChange={({ heal: h, damage: d }) => updateData((prev) => ({ ...prev, heal: h, damage: d }))}
          />
        </Section>

        {/* ── Statuses ── */}
        <Section title="Statuses" open={openStatuses} onToggle={() => setOpenStatuses((v) => !v)}>
          <StatusesSection
            statuses={data.statuses || { add: [], remove: [] }}
            libraryIndex={libraryIndex}
            onChange={(val) => updateData((d) => ({ ...d, statuses: val }))}
          />
        </Section>

        {/* ── Requirements ── */}
        <Section title="Requirements" open={openRequirements} onToggle={() => setOpenRequirements((v) => !v)}>
          <RequirementsSection
            requirements={data.requirements || []}
            libraryIndex={libraryIndex}
            onChange={(val) => updateData((d) => ({ ...d, requirements: val }))}
          />
        </Section>

        {/* ── Restrictions ── */}
        <Section title="Restrictions" open={openRestrictions} onToggle={() => setOpenRestrictions((v) => !v)}>
          <RestrictionsSection
            restrictions={data.restrictions || []}
            libraryIndex={libraryIndex}
            onChange={(val) => updateData((d) => ({ ...d, restrictions: val }))}
          />
        </Section>

        {/* ── Reactors ── */}
        <Section title="Reactors" open={openReactors} onToggle={() => setOpenReactors((v) => !v)}>
          <ReactorsSection
            reactors={data.reactors || []}
            libraryIndex={libraryIndex}
            onChange={(val) => updateData((d) => ({ ...d, reactors: val }))}
          />
        </Section>

        {/* ── Mastery ── */}
        <Section title="Mastery" open={openMastery} onToggle={() => setOpenMastery((v) => !v)}>
          {(() => {
            const ms = data.mastery || {};
            const setMs = (field, val) =>
              updateData((d) => ({ ...d, mastery: { ...d.mastery, [field]: val } }));
            return (
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Checkbox size="small" checked={!!ms.deprecated}
                      onChange={(e) => setMs('deprecated', e.target.checked)} />
                  }
                  label={<Typography variant="body2">Deprecated — saves as a comment</Typography>}
                  sx={{ m: 0 }}
                />
                <TextField
                  label="Uses" size="small" sx={{ width: 100 }}
                  value={ms.uses || ''}
                  onChange={(e) => setMs('uses', e.target.value.replace(/\D/g, ''))}
                  inputProps={{ inputMode: 'numeric' }}
                />
                <Autocomplete
                  multiple
                  options={MASTERY_MODIFIERS}
                  value={ms.modifiers || []}
                  onChange={(_, val) => setMs('modifiers', val)}
                  disableCloseOnSelect
                  size="small"
                  sx={{ minWidth: 200, flex: 1 }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip key={option} label={option} size="small" {...getTagProps({ index })} />
                    ))
                  }
                  renderInput={(params) => <TextField {...params} label="Modifiers" />}
                />
                <FormControlLabel
                  control={
                    <Checkbox size="small" checked={!!ms.tiered}
                      onChange={(e) => setMs('tiered', e.target.checked)} />
                  }
                  label={<Typography variant="body2">Tiered</Typography>}
                  sx={{ m: 0 }}
                />
              </Box>
            );
          })()}
        </Section>

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

export default CastableEditor;
