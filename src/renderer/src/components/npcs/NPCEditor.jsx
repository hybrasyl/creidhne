import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box, Button, Typography, Divider, TextField, IconButton,
  Paper, Autocomplete, Collapse, Switch, FormControlLabel, Checkbox,
  FormControl, InputLabel, Select, MenuItem, Snackbar, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import GridViewIcon from '@mui/icons-material/GridView';
import { useRecoilValue } from 'recoil';
import { libraryIndexState } from '../../recoil/atoms';
import ConstantAutocomplete from '../shared/ConstantAutocomplete';
import NpcPortraitCanvas from '../shared/NpcPortraitCanvas';
import NpcPortraitPickerDialog from '../shared/NpcPortraitPickerDialog';
import CommentField from '../shared/CommentField';
import spriteMeta, { keyFromSprite, spriteUrl, frameDisplay } from '../../data/creatureSpriteData';
import SpritePickerDialog from '../shared/SpritePickerDialog';
import EditorHeader from '../shared/EditorHeader';
import StringKeyField from '../shared/StringKeyField';
import OpenScriptByNameButton from '../shared/OpenScriptByNameButton';

function deriveNpcPrefix(job) {
  if (!job) return 'npc';
  return job.toLowerCase().replace(/\s+/g, '_');
}

function computeNpcFilename(prefix, name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '');
  if (!safe) return '';
  const p = (prefix || '').trim().toLowerCase().replace(/\s+/g, '_');
  return p ? `${p}_${safe}.xml` : `npc_${safe}.xml`;
}

// ── Collapsible section wrapper ───────────────────────────────────────────────
function Section({ title, open, onToggle, enabled, onEnable, children }) {
  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Box
        sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, cursor: 'pointer', userSelect: 'none' }}
        onClick={onToggle}
      >
        <Typography variant="subtitle2" sx={{ flex: 1 }}>{title}</Typography>
        {onEnable !== undefined && (
          <Switch
            size="small"
            checked={enabled}
            onChange={(e) => { e.stopPropagation(); onEnable(e.target.checked); }}
            onClick={(e) => e.stopPropagation()}
            sx={{ mr: 0.5 }}
          />
        )}
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>
      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2 }}>{children}</Box>
      </Collapse>
    </Paper>
  );
}

// ── Nation autocomplete ───────────────────────────────────────────────────────
function NationPicker({ label, value, onChange, sx }) {
  const libraryIndex = useRecoilValue(libraryIndexState);
  const nationNames = libraryIndex.nations || [];
  return (
    <Autocomplete
      freeSolo options={nationNames} value={value}
      onInputChange={(_, val, reason) => { if (reason === 'input') onChange(val); }}
      onChange={(_, val) => onChange(val ?? '')}
      size="small" sx={sx}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}

// ── Cookie pickers row ────────────────────────────────────────────────────────
function CookiePickers({ exceptCookie, onlyCookie, onChangeExcept, onChangeOnly }) {
  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <ConstantAutocomplete
        indexKey="cookieNames" label="Except Cookie" sx={{ flex: 1 }}
        value={exceptCookie}
        onChange={onChangeExcept}
        inputProps={{ maxLength: 128 }}
      />
      <ConstantAutocomplete
        indexKey="cookieNames" label="Only Cookie" sx={{ flex: 1 }}
        value={onlyCookie}
        onChange={onChangeOnly}
        inputProps={{ maxLength: 128 }}
      />
    </Box>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────
function NPCEditor({ npc, initialFileName, isArchived, isExisting, onSave, onArchive, onUnarchive, onDirtyChange, saveRef }) {
  const libraryIndex = useRecoilValue(libraryIndexState);
  const itemNames = libraryIndex.items || [];
  const castableNames = libraryIndex.castables || [];
  const castableClasses = libraryIndex.castableClasses || {};
  const npcResponseCalls = libraryIndex.npcResponseCalls || {};
  const npcStringKeys = libraryIndex.npcStringKeys || [];
  const responseCallOptions = useMemo(
    () => Object.entries(npcResponseCalls).map(([key, message]) => ({ key, message, category: '' })).sort((a, b) => a.key.localeCompare(b.key)),
    [npcResponseCalls]
  );


  const [data, setData] = useState(npc);
  const [fileName, setFileName] = useState(() => {
    const p = deriveNpcPrefix(npc.meta?.job || '');
    return initialFileName || computeNpcFilename(p, npc.name);
  });
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName);

  const [openResponses, setOpenResponses] = useState(false);
  const [openStrings, setOpenStrings] = useState(false);
  const [openBank, setOpenBank] = useState(npc.roles.bank !== null);
  const [openPost, setOpenPost] = useState(npc.roles.post !== null);
  const [openRepair, setOpenRepair] = useState(npc.roles.repair !== null);
  const [openVend, setOpenVend] = useState(npc.roles.vend !== null);
  const [openTrain, setOpenTrain] = useState(npc.roles.train !== null);
  const [spritePickerOpen, setSpritePickerOpen] = useState(false);
  const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);

  const isDirtyRef = useRef(false);

  // ── Computed values ────────────────────────────────────────────────────────
  const computedPrefix = deriveNpcPrefix(data.meta?.job || '');
  const computedFileName = computeNpcFilename(computedPrefix, data.name);
  // ── Duplicate detection ────────────────────────────────────────────────────
  const dupStatus = useMemo(() => {
    const name = (data.name || '').trim();
    if (!name) return null;
    const originalName = isExisting ? (npc.name || '') : '';
    if (originalName && name.toLowerCase() === originalName.toLowerCase()) return null;
    const activeNames = libraryIndex?.npcs || [];
    if (activeNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'active';
    const archivedNames = libraryIndex?.archivedNpcs || [];
    if (archivedNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'archived';
    return null;
  }, [data.name, libraryIndex, isExisting, npc.name]);

  const [dupSnack, setDupSnack] = useState(null);
  const handleNameBlur = () => { if (dupStatus) setDupSnack(dupStatus); };

  useEffect(() => {
    setData(npc);
    setFileName(initialFileName || computeNpcFilename(deriveNpcPrefix(npc.meta?.job || ''), npc.name));
    setFileNameEdited(!!initialFileName);
    setOpenResponses(false);
    setOpenStrings(false);
    setOpenBank(npc.roles.bank !== null);
    setOpenPost(npc.roles.post !== null);
    setOpenRepair(npc.roles.repair !== null);
    setOpenVend(npc.roles.vend !== null);
    setOpenTrain(npc.roles.train !== null);
    setSpritePickerOpen(false);
    isDirtyRef.current = false;
    setDupSnack(null);
    onDirtyChange?.(false);
  }, [npc, initialFileName]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirtyLocal = useCallback(() => {
    if (!isDirtyRef.current) { isDirtyRef.current = true; onDirtyChange?.(true); }
  }, [onDirtyChange]);

  const updateData = useCallback((updater) => {
    markDirtyLocal();
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!fileNameEdited) setFileName(computeNpcFilename(deriveNpcPrefix(next.meta?.job || ''), next.name));
      return next;
    });
  }, [fileNameEdited, markDirtyLocal]);

  const set = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.value }));
  const setMetaField = (field) => (val) => updateData((d) => ({ ...d, meta: { ...(d.meta || {}), [field]: val } }));

  const handleRegenerate = () => {
    markDirtyLocal();
    setFileName(computeNpcFilename(computedPrefix, data.name));
    setFileNameEdited(false);
  };

  if (saveRef) saveRef.current = () => onSave(data, fileName);

  // ── Role enable/disable ───────────────────────────────────────────────────
  const enableRole = (roleKey, defaultVal) => (checked) => {
    updateData((d) => ({ ...d, roles: { ...d.roles, [roleKey]: checked ? defaultVal : null } }));
    if (roleKey === 'bank') setOpenBank(checked);
    if (roleKey === 'post') setOpenPost(checked);
    if (roleKey === 'repair') setOpenRepair(checked);
    if (roleKey === 'vend') setOpenVend(checked);
    if (roleKey === 'train') setOpenTrain(checked);
  };

  // ── Role field helpers ─────────────────────────────────────────────────────
  const setRoleField = (roleKey, field, val) =>
    updateData((d) => ({ ...d, roles: { ...d.roles, [roleKey]: { ...d.roles[roleKey], [field]: val } } }));

  // ── Adjustment helpers ────────────────────────────────────────────────────
  const addAdjustment = (roleKey) =>
    updateData((d) => ({
      ...d,
      roles: { ...d.roles, [roleKey]: { ...d.roles[roleKey], adjustments: [...(d.roles[roleKey]?.adjustments || []), { nation: '', value: '' }] } },
    }));
  const setAdjustment = (roleKey, i, field, val) =>
    updateData((d) => ({
      ...d,
      roles: {
        ...d.roles,
        [roleKey]: {
          ...d.roles[roleKey],
          adjustments: d.roles[roleKey].adjustments.map((adj, idx) => idx === i ? { ...adj, [field]: val } : adj),
        },
      },
    }));
  const removeAdjustment = (roleKey, i) =>
    updateData((d) => ({
      ...d,
      roles: { ...d.roles, [roleKey]: { ...d.roles[roleKey], adjustments: d.roles[roleKey].adjustments.filter((_, idx) => idx !== i) } },
    }));

  // ── Responses ─────────────────────────────────────────────────────────────
  const addResponse = () =>
    updateData((d) => ({ ...d, responses: [...d.responses, { call: '', response: '' }] }));
  const removeResponse = (i) =>
    updateData((d) => ({ ...d, responses: d.responses.filter((_, idx) => idx !== i) }));

  // ── Strings ───────────────────────────────────────────────────────────────
  const addString = () =>
    updateData((d) => ({ ...d, strings: [...d.strings, { key: '', message: '' }] }));
  const removeString = (i) =>
    updateData((d) => ({ ...d, strings: d.strings.filter((_, idx) => idx !== i) }));

  // ── Vend items ────────────────────────────────────────────────────────────
  const addVendItem = () =>
    updateData((d) => ({
      ...d,
      roles: { ...d.roles, vend: { ...d.roles.vend, items: [...(d.roles.vend?.items || []), { name: '', quantity: '1', restock: '' }] } },
    }));
  const setVendItem = (i, field, val) =>
    updateData((d) => ({
      ...d,
      roles: {
        ...d.roles,
        vend: {
          ...d.roles.vend,
          items: d.roles.vend.items.map((item, idx) => idx === i ? { ...item, [field]: val } : item),
        },
      },
    }));
  const removeVendItem = (i) =>
    updateData((d) => ({
      ...d,
      roles: { ...d.roles, vend: { ...d.roles.vend, items: d.roles.vend.items.filter((_, idx) => idx !== i) } },
    }));

  // ── Train castables ───────────────────────────────────────────────────────
  const addTrainCastable = () =>
    updateData((d) => ({
      ...d,
      roles: { ...d.roles, train: { ...d.roles.train, castables: [...(d.roles.train?.castables || []), { name: '', type: '', class: '' }] } },
    }));
  const removeTrainCastable = (i) =>
    updateData((d) => ({
      ...d,
      roles: { ...d.roles, train: { ...d.roles.train, castables: d.roles.train.castables.filter((_, idx) => idx !== i) } },
    }));

  const SPRITE_PREVIEW = 128;
  const spritePreviewKey = keyFromSprite(data.sprite);
  const spritePreviewMeta = spritePreviewKey ? spriteMeta[spritePreviewKey] : null;
  const spritePreviewFrame = spritePreviewMeta ? frameDisplay(spritePreviewMeta, spritePreviewMeta.still, SPRITE_PREVIEW) : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <EditorHeader
        title={data.name || '(unnamed npc)'}
        entityLabel="NPC"
        fileName={fileName}
        initialFileName={initialFileName}
        computedFileName={computedFileName}
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
        {/* Basic info */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            {/* Sprite card */}
            <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1, width: SPRITE_PREVIEW }}>
              <TextField
                label="Sprite" type="number" size="small"
                value={data.sprite}
                onChange={(e) => updateData((d) => ({ ...d, sprite: e.target.value }))}
                inputProps={{ min: 1, max: 9999 }}
              />
              <Box sx={{ width: SPRITE_PREVIEW, height: SPRITE_PREVIEW, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover' }}>
                {spritePreviewFrame && (
                  <Box sx={{ width: spritePreviewFrame.clipW, height: spritePreviewFrame.clipH, overflow: 'hidden', flexShrink: 0 }}>
                    <img src={spriteUrl(spritePreviewKey)} alt={spritePreviewKey} draggable={false} style={spritePreviewFrame.imgStyle} />
                  </Box>
                )}
              </Box>
              <Button size="small" fullWidth startIcon={<GridViewIcon />} onClick={() => setSpritePickerOpen(true)}>
                Browse
              </Button>
            </Box>

            {/* Portrait card */}
            <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1, width: SPRITE_PREVIEW }}>
              <TextField
                label="Portrait" size="small"
                value={data.portrait || ''}
                onChange={set('portrait')}
                inputProps={{ maxLength: 255 }}
              />
              <NpcPortraitCanvas filename={data.portrait} size={SPRITE_PREVIEW} />
              <Button size="small" fullWidth startIcon={<GridViewIcon />} onClick={() => setPortraitPickerOpen(true)}>
                Browse
              </Button>
            </Box>

            {/* Right stack */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Row 1: Prefix | Name | Display Name */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Prefix" value={computedPrefix}
                  size="small" sx={{ width: 140 }} inputProps={{ readOnly: true, spellCheck: false }}
                />
                <TextField
                  label="Name" value={data.name} onChange={set('name')} onBlur={handleNameBlur}
                  size="small" required inputProps={{ maxLength: 255 }}
                  error={dupStatus === 'active'}
                  helperText={
                    dupStatus === 'active'   ? `"${data.name}" already exists` :
                    dupStatus === 'archived' ? `"${data.name}" exists in archive` :
                    undefined
                  }
                  InputProps={{
                    endAdornment: <OpenScriptByNameButton name={data.name} tooltipPrefix="Open NPC script" />,
                  }}
                  sx={{
                    flex: 1,
                    ...(dupStatus === 'archived' && {
                      '& .MuiOutlinedInput-root fieldset': { borderColor: 'warning.main' },
                      '& .MuiInputLabel-root:not(.Mui-focused)': { color: 'warning.main' },
                      '& .MuiFormHelperText-root': { color: 'warning.main' },
                    }),
                  }}
                />
                <TextField
                  label="Display Name" value={data.displayName} onChange={set('displayName')}
                  size="small" sx={{ flex: 1 }} inputProps={{ maxLength: 255 }}
                />
              </Box>

              {/* Row 2: Job | Location */}
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <ConstantAutocomplete
                  indexKey="npcJobs" label="Job"
                  value={data.meta?.job || ''}
                  onChange={setMetaField('job')}
                  size="small" sx={{ flex: 1 }}
                  inputProps={{ maxLength: 64 }}
                />
                <TextField
                  label="Location" value={data.meta?.location || ''} onChange={(e) => setMetaField('location')(e.target.value)}
                  size="small" sx={{ flex: 1 }} inputProps={{ maxLength: 128 }}
                />
              </Box>

              {/* Row 3: Comment */}
              <CommentField value={data.comment} onChange={set('comment')} fullWidth />

              {/* Row 4: Checkboxes */}
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={data.allowDead}
                      onChange={(e) => updateData((d) => ({ ...d, allowDead: e.target.checked }))}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">Allow Dead</Typography>}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={data.roles.disableForget ?? false}
                      onChange={(e) => updateData((d) => ({ ...d, roles: { ...d.roles, disableForget: e.target.checked } }))}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">Disable Forget</Typography>}
                />
              </Box>
            </Box>
          </Box>
        </Paper>
        <SpritePickerDialog
          open={spritePickerOpen}
          value={data.sprite}
          onClose={() => setSpritePickerOpen(false)}
          onChange={(key) => {
            updateData((d) => ({ ...d, sprite: String(parseInt(key.replace('monster', ''), 10)) }));
            setSpritePickerOpen(false);
          }}
        />
        <NpcPortraitPickerDialog
          open={portraitPickerOpen}
          value={data.portrait}
          onClose={() => setPortraitPickerOpen(false)}
          onChange={(filename) => {
            updateData((d) => ({ ...d, portrait: filename }));
            setPortraitPickerOpen(false);
          }}
        />

        {/* ── Responses ── */}
        <Section title="Responses" open={openResponses} onToggle={() => setOpenResponses((v) => !v)}>
          {data.responses.map((r, i) => {
            const inIndex = npcResponseCalls[r.call] !== undefined;
            const stringKey = inIndex ? r.call : '';
            const warning = r.call && !inIndex ? `"${r.call}" is not a known call — Call will be cleared on save` : undefined;
            return (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
                <StringKeyField
                  stringKey={stringKey}
                  text={r.response}
                  pickerLabel="Call"
                  externalOptions={responseCallOptions}
                  warning={warning}
                  onChange={({ key, text }) => updateData((d) => ({
                    ...d,
                    responses: d.responses.map((resp, idx) => idx === i ? { call: key, response: text } : resp),
                  }))}
                />
                <IconButton size="small" color="error" onClick={() => removeResponse(i)} sx={{ mt: 0.5 }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            );
          })}
          <Button size="small" startIcon={<AddIcon />} onClick={addResponse}>Add Response</Button>
        </Section>

        {/* ── Strings ── */}
        <Section title="Strings" open={openStrings} onToggle={() => setOpenStrings((v) => !v)}>
          {data.strings.map((s, i) => {
            const inIndex = npcStringKeys.some((sk) => sk.key === s.key);
            const stringKey = inIndex ? s.key : '';
            const warning = s.key && !inIndex ? `"${s.key}" is not in the string library — Key will be cleared on save` : undefined;
            return (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
                <StringKeyField
                  stringKey={stringKey}
                  text={s.message}
                  pickerLabel="Key"
                  warning={warning}
                  onChange={({ key, text }) => updateData((d) => ({
                    ...d,
                    strings: d.strings.map((str, idx) => idx === i ? { key, message: text } : str),
                  }))}
                />
                <IconButton size="small" color="error" onClick={() => removeString(i)} sx={{ mt: 0.5 }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            );
          })}
          <Button size="small" startIcon={<AddIcon />} onClick={addString}>Add String</Button>
        </Section>

        {/* ── Bank ── */}
        <Section
          title="Bank"
          open={openBank}
          onToggle={() => setOpenBank((v) => !v)}
          enabled={data.roles.bank !== null}
          onEnable={enableRole('bank', { exceptCookie: '', onlyCookie: '', adjustments: [] })}
        >
          {data.roles.bank !== null && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <CookiePickers
                exceptCookie={data.roles.bank.exceptCookie}
                onlyCookie={data.roles.bank.onlyCookie}
                onChangeExcept={(val) => setRoleField('bank', 'exceptCookie', val)}
                onChangeOnly={(val) => setRoleField('bank', 'onlyCookie', val)}
              />
              <Typography variant="caption" color="text.secondary">Cost Adjustments</Typography>
              {data.roles.bank.adjustments.map((adj, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <NationPicker
                    label="Nation" value={adj.nation} sx={{ flex: 1 }}
                    onChange={(val) => setAdjustment('bank', i, 'nation', val)}
                  />
                  <TextField
                    label="Adjustment" value={adj.value}
                    onChange={(e) => setAdjustment('bank', i, 'value', e.target.value)}
                    size="small" sx={{ width: 140 }} inputProps={{ maxLength: 32 }}
                  />
                  <IconButton size="small" color="error" onClick={() => removeAdjustment('bank', i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={() => addAdjustment('bank')}>Add Cost Adjustment</Button>
            </Box>
          )}
        </Section>

        {/* ── Post ── */}
        <Section
          title="Post"
          open={openPost}
          onToggle={() => setOpenPost((v) => !v)}
          enabled={data.roles.post !== null}
          onEnable={enableRole('post', { nation: '', exceptCookie: '', onlyCookie: '', adjustments: [] })}
        >
          {data.roles.post !== null && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <NationPicker
                  label="Nation" value={data.roles.post.nation} sx={{ flex: 1 }}
                  onChange={(val) => setRoleField('post', 'nation', val)}
                />
                <ConstantAutocomplete
                  indexKey="cookieNames" label="Except Cookie" sx={{ flex: 1 }}
                  value={data.roles.post.exceptCookie}
                  onChange={(val) => setRoleField('post', 'exceptCookie', val)}
                  inputProps={{ maxLength: 128 }}
                />
                <ConstantAutocomplete
                  indexKey="cookieNames" label="Only Cookie" sx={{ flex: 1 }}
                  value={data.roles.post.onlyCookie}
                  onChange={(val) => setRoleField('post', 'onlyCookie', val)}
                  inputProps={{ maxLength: 128 }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">Cost Adjustments</Typography>
              {data.roles.post.adjustments.map((adj, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <NationPicker
                    label="Nation" value={adj.nation} sx={{ flex: 1 }}
                    onChange={(val) => setAdjustment('post', i, 'nation', val)}
                  />
                  <TextField
                    label="Adjustment" value={adj.value}
                    onChange={(e) => setAdjustment('post', i, 'value', e.target.value)}
                    size="small" sx={{ width: 140 }} inputProps={{ maxLength: 32 }}
                  />
                  <IconButton size="small" color="error" onClick={() => removeAdjustment('post', i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={() => addAdjustment('post')}>Add Cost Adjustment</Button>
            </Box>
          )}
        </Section>

        {/* ── Repair ── */}
        <Section
          title="Repair"
          open={openRepair}
          onToggle={() => setOpenRepair((v) => !v)}
          enabled={data.roles.repair !== null}
          onEnable={enableRole('repair', { type: '', exceptCookie: '', onlyCookie: '', adjustments: [] })}
        >
          {data.roles.repair !== null && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl size="small" sx={{ width: 120 }}>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={data.roles.repair.type || ''}
                    label="Type"
                    onChange={(e) => setRoleField('repair', 'type', e.target.value)}
                  >
                    <MenuItem value="">—</MenuItem>
                    <MenuItem value="Weapon">Weapon</MenuItem>
                    <MenuItem value="Armor">Armor</MenuItem>
                    <MenuItem value="All">All</MenuItem>
                  </Select>
                </FormControl>
                <ConstantAutocomplete
                  indexKey="cookieNames" label="Except Cookie" sx={{ flex: 1 }}
                  value={data.roles.repair.exceptCookie}
                  onChange={(val) => setRoleField('repair', 'exceptCookie', val)}
                  inputProps={{ maxLength: 128 }}
                />
                <ConstantAutocomplete
                  indexKey="cookieNames" label="Only Cookie" sx={{ flex: 1 }}
                  value={data.roles.repair.onlyCookie}
                  onChange={(val) => setRoleField('repair', 'onlyCookie', val)}
                  inputProps={{ maxLength: 128 }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">Cost Adjustments</Typography>
              {data.roles.repair.adjustments.map((adj, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <NationPicker
                    label="Nation" value={adj.nation} sx={{ flex: 1 }}
                    onChange={(val) => setAdjustment('repair', i, 'nation', val)}
                  />
                  <TextField
                    label="Adjustment" value={adj.value}
                    onChange={(e) => setAdjustment('repair', i, 'value', e.target.value)}
                    size="small" sx={{ width: 140 }} inputProps={{ maxLength: 32 }}
                  />
                  <IconButton size="small" color="error" onClick={() => removeAdjustment('repair', i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={() => addAdjustment('repair')}>Add Cost Adjustment</Button>
            </Box>
          )}
        </Section>

        {/* ── Vendor ── */}
        <Section
          title="Vendor"
          open={openVend}
          onToggle={() => setOpenVend((v) => !v)}
          enabled={data.roles.vend !== null}
          onEnable={enableRole('vend', { exceptCookie: '', onlyCookie: '', items: [], adjustments: [] })}
        >
          {data.roles.vend !== null && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <CookiePickers
                exceptCookie={data.roles.vend.exceptCookie}
                onlyCookie={data.roles.vend.onlyCookie}
                onChangeExcept={(val) => setRoleField('vend', 'exceptCookie', val)}
                onChangeOnly={(val) => setRoleField('vend', 'onlyCookie', val)}
              />
              {data.roles.vend.items.map((item, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Autocomplete
                    freeSolo options={itemNames} value={item.name}
                    onInputChange={(_, val, reason) => { if (reason === 'input') setVendItem(i, 'name', val); }}
                    onChange={(_, val) => setVendItem(i, 'name', val ?? '')}
                    size="small" sx={{ flex: 1 }}
                    renderInput={(params) => <TextField {...params} label="Item" />}
                  />
                  <TextField
                    label="Qty" type="number" value={item.quantity}
                    onChange={(e) => setVendItem(i, 'quantity', e.target.value)}
                    size="small" sx={{ width: 80 }} inputProps={{ min: 1 }}
                  />
                  <TextField
                    label="Restock" type="number" value={item.restock}
                    onChange={(e) => setVendItem(i, 'restock', e.target.value)}
                    size="small" sx={{ width: 90 }} inputProps={{ min: 0 }}
                  />
                  <IconButton size="small" color="error" onClick={() => removeVendItem(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={addVendItem}>Add Item</Button>
              <Typography variant="caption" color="text.secondary">Cost Adjustments</Typography>
              {data.roles.vend.adjustments.map((adj, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <NationPicker
                    label="Nation" value={adj.nation} sx={{ flex: 1 }}
                    onChange={(val) => setAdjustment('vend', i, 'nation', val)}
                  />
                  <TextField
                    label="Adjustment" value={adj.value}
                    onChange={(e) => setAdjustment('vend', i, 'value', e.target.value)}
                    size="small" sx={{ width: 140 }} inputProps={{ maxLength: 32 }}
                  />
                  <IconButton size="small" color="error" onClick={() => removeAdjustment('vend', i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={() => addAdjustment('vend')}>Add Cost Adjustment</Button>
            </Box>
          )}
        </Section>

        {/* ── Trainer ── */}
        <Section
          title="Trainer"
          open={openTrain}
          onToggle={() => setOpenTrain((v) => !v)}
          enabled={data.roles.train !== null}
          onEnable={enableRole('train', { exceptCookie: '', onlyCookie: '', castables: [], adjustments: [] })}
        >
          {data.roles.train !== null && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <CookiePickers
                exceptCookie={data.roles.train.exceptCookie}
                onlyCookie={data.roles.train.onlyCookie}
                onChangeExcept={(val) => setRoleField('train', 'exceptCookie', val)}
                onChangeOnly={(val) => setRoleField('train', 'onlyCookie', val)}
              />
              {data.roles.train.castables.map((c, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Autocomplete
                    freeSolo options={castableNames} value={c.name}
                    onInputChange={(_, val, reason) => {
                      if (reason !== 'input') return;
                      const autoClass = castableClasses[val] || '';
                      updateData((d) => ({
                        ...d,
                        roles: {
                          ...d.roles,
                          train: {
                            ...d.roles.train,
                            castables: d.roles.train.castables.map((entry, idx) =>
                              idx === i ? { ...entry, name: val, class: autoClass || (val ? entry.class : '') } : entry
                            ),
                          },
                        },
                      }));
                    }}
                    onChange={(_, val) => {
                      const v = val ?? '';
                      const autoClass = castableClasses[v] || '';
                      updateData((d) => ({
                        ...d,
                        roles: {
                          ...d.roles,
                          train: {
                            ...d.roles.train,
                            castables: d.roles.train.castables.map((entry, idx) =>
                              idx === i ? { ...entry, name: v, class: autoClass || (v ? entry.class : '') } : entry
                            ),
                          },
                        },
                      }));
                    }}
                    size="small" sx={{ flex: 1 }}
                    renderInput={(params) => <TextField {...params} label="Castable" />}
                  />
                  <TextField
                    label="Class" value={castableClasses[c.name] || c.class || ''}
                    size="small" sx={{ flex: 1 }} disabled
                  />
                  <IconButton size="small" color="error" onClick={() => removeTrainCastable(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={addTrainCastable}>Add Castable</Button>
              <Typography variant="caption" color="text.secondary">Cost Adjustments</Typography>
              {data.roles.train.adjustments.map((adj, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <NationPicker
                    label="Nation" value={adj.nation} sx={{ flex: 1 }}
                    onChange={(val) => setAdjustment('train', i, 'nation', val)}
                  />
                  <TextField
                    label="Adjustment" value={adj.value}
                    onChange={(e) => setAdjustment('train', i, 'value', e.target.value)}
                    size="small" sx={{ width: 140 }} inputProps={{ maxLength: 32 }}
                  />
                  <IconButton size="small" color="error" onClick={() => removeAdjustment('train', i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={() => addAdjustment('train')}>Add Cost Adjustment</Button>
            </Box>
          )}
        </Section>

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

export default NPCEditor;
