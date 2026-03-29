import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Typography, Divider, TextField, Tooltip, IconButton,
  Paper, Autocomplete, Collapse, FormControlLabel, Checkbox,
} from '@mui/material';
import ConstantAutocomplete from '../common/ConstantAutocomplete';
import SaveIcon from '@mui/icons-material/Save';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useRecoilValue } from 'recoil';
import { libraryIndexState } from '../../recoil/atoms';
import CommentField from '../shared/CommentField';

function computeCreatureFilename(prefix, name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '');
  if (!safe) return '';
  const p = (prefix || '').trim().toLowerCase().replace(/\s+/g, '_');
  return p ? `${p}_${safe}.xml` : `${safe}.xml`;
}

const DEFAULT_HOSTILITY = {
  players: false, playerExceptCookie: '', playerOnlyCookie: '',
  monsters: false, monsterExceptCookie: '', monsterOnlyCookie: '',
};

const makeDefaultSubtype = () => ({
  name: '', sprite: '', behaviorSet: '', minDmg: '', maxDmg: '', assailSound: '',
  description: '', loot: [], hostility: { ...DEFAULT_HOSTILITY }, cookies: [],
});

// ── Collapsible section wrapper ───────────────────────────────────────────────
function Section({ title, open, onToggle, onDelete, children }) {
  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Box
        sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, cursor: 'pointer', userSelect: 'none' }}
        onClick={onToggle}
      >
        <Typography variant="subtitle2" sx={{ flex: 1 }}>{title}</Typography>
        {onDelete !== undefined && (
          <IconButton
            size="small" color="error"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            sx={{ mr: 0.5 }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
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

// ── BehaviorSet autocomplete ──────────────────────────────────────────────────
function BehaviorSetPicker({ value, onChange, sx }) {
  const libraryIndex = useRecoilValue(libraryIndexState);
  const options = libraryIndex.creaturebehaviorsets || [];
  return (
    <Autocomplete
      freeSolo options={options} value={value}
      onInputChange={(_, val, reason) => { if (reason === 'input') onChange(val); }}
      onChange={(_, val) => onChange(val ?? '')}
      size="small" sx={sx}
      renderInput={(params) => <TextField {...params} label="Behavior Set" />}
    />
  );
}

// ── LootSet autocomplete ──────────────────────────────────────────────────────
function LootSetPicker({ value, onChange, sx }) {
  const libraryIndex = useRecoilValue(libraryIndexState);
  const options = libraryIndex.lootsets || [];
  return (
    <Autocomplete
      freeSolo options={options} value={value}
      onInputChange={(_, val, reason) => { if (reason === 'input') onChange(val); }}
      onChange={(_, val) => onChange(val ?? '')}
      size="small" sx={sx}
      renderInput={(params) => <TextField {...params} label="Loot Set" />}
    />
  );
}

// ── Loot section content ──────────────────────────────────────────────────────
function LootContent({ loot, onChange }) {
  const add = () => onChange([...loot, { name: '', rolls: '', chance: '' }]);
  const set = (i, field, val) => onChange(loot.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  const remove = (i) => onChange(loot.filter((_, idx) => idx !== i));

  return (
    <>
      {loot.map((entry, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
          <LootSetPicker
            value={entry.name}
            onChange={(val) => set(i, 'name', val)}
            sx={{ flex: 2, minWidth: 160 }}
          />
          <TextField
            label="Rolls" size="small" sx={{ width: 80 }}
            value={entry.rolls}
            onChange={(e) => set(i, 'rolls', e.target.value)}
            inputProps={{ maxLength: 16 }}
          />
          <TextField
            label="Chance" size="small" sx={{ width: 100 }}
            value={entry.chance}
            onChange={(e) => set(i, 'chance', e.target.value)}
            inputProps={{ maxLength: 16 }}
          />
          <IconButton size="small" color="error" onClick={() => remove(i)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={add}>Add Loot Set</Button>
    </>
  );
}

// ── Hostility section content ─────────────────────────────────────────────────
function HostilityContent({ hostility, onChange }) {
  const set = (field, val) => onChange({ ...hostility, [field]: val });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Players row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={hostility.players}
              onChange={(e) => set('players', e.target.checked)}
            />
          }
          label={<Typography variant="body2">Players</Typography>}
          sx={{ minWidth: 100, m: 0 }}
        />
        {hostility.players && (
          <>
            <TextField
              label="Except Cookie" size="small" sx={{ flex: 1, minWidth: 140 }}
              value={hostility.playerExceptCookie}
              onChange={(e) => set('playerExceptCookie', e.target.value)}
              inputProps={{ maxLength: 128 }}
            />
            <TextField
              label="Only Cookie" size="small" sx={{ flex: 1, minWidth: 140 }}
              value={hostility.playerOnlyCookie}
              onChange={(e) => set('playerOnlyCookie', e.target.value)}
              inputProps={{ maxLength: 128 }}
            />
          </>
        )}
      </Box>
      {/* Monsters row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={hostility.monsters}
              onChange={(e) => set('monsters', e.target.checked)}
            />
          }
          label={<Typography variant="body2">Monsters</Typography>}
          sx={{ minWidth: 100, m: 0 }}
        />
        {hostility.monsters && (
          <>
            <TextField
              label="Except Cookie" size="small" sx={{ flex: 1, minWidth: 140 }}
              value={hostility.monsterExceptCookie}
              onChange={(e) => set('monsterExceptCookie', e.target.value)}
              inputProps={{ maxLength: 128 }}
            />
            <TextField
              label="Only Cookie" size="small" sx={{ flex: 1, minWidth: 140 }}
              value={hostility.monsterOnlyCookie}
              onChange={(e) => set('monsterOnlyCookie', e.target.value)}
              inputProps={{ maxLength: 128 }}
            />
          </>
        )}
      </Box>
    </Box>
  );
}

// ── Cookies section content ───────────────────────────────────────────────────
function CookiesContent({ cookies, onChange }) {
  const add = () => onChange([...cookies, { name: '', value: '' }]);
  const set = (i, field, val) => onChange(cookies.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  const remove = (i) => onChange(cookies.filter((_, idx) => idx !== i));

  return (
    <>
      {cookies.map((cookie, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
          <ConstantAutocomplete
            indexKey="cookieNames" label="Cookie Name" sx={{ flex: 1 }}
            value={cookie.name}
            onChange={(val) => set(i, 'name', val)}
            inputProps={{ maxLength: 128 }}
          />
          <TextField
            label="Cookie Value" size="small" sx={{ flex: 1 }}
            value={cookie.value}
            onChange={(e) => set(i, 'value', e.target.value)}
            inputProps={{ maxLength: 128 }}
          />
          <IconButton size="small" color="error" onClick={() => remove(i)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={add}>Add Cookie</Button>
    </>
  );
}

// ── Subtype accordion ─────────────────────────────────────────────────────────
function SubtypeAccordion({ data, index, onChange, onRemove }) {
  const [open, setOpen] = useState(true);
  const [openLoot, setOpenLoot] = useState(false);
  const [openHostility, setOpenHostility] = useState(false);
  const [openCookies, setOpenCookies] = useState(false);

  const set = (field, val) => onChange({ ...data, [field]: val });

  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Box
        sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen((v) => !v)}
      >
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {data.name || `Subtype ${index + 1}`}
        </Typography>
        <IconButton
          size="small" color="error"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          sx={{ mr: 0.5 }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>

      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2 }}>
          {/* Core fields */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Name" required size="small" sx={{ flex: 1, minWidth: 160 }}
                value={data.name}
                onChange={(e) => set('name', e.target.value)}
                inputProps={{ maxLength: 255 }}
              />
              <TextField
                label="Sprite" size="small" sx={{ width: 100 }}
                value={data.sprite}
                onChange={(e) => set('sprite', e.target.value)}
                inputProps={{ maxLength: 64 }}
              />
              <BehaviorSetPicker
                value={data.behaviorSet}
                onChange={(val) => set('behaviorSet', val)}
                sx={{ flex: 1, minWidth: 180 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Min Damage" size="small" sx={{ width: 120 }}
                value={data.minDmg}
                onChange={(e) => set('minDmg', e.target.value)}
                inputProps={{ maxLength: 32 }}
              />
              <TextField
                label="Max Damage" size="small" sx={{ width: 120 }}
                value={data.maxDmg}
                onChange={(e) => set('maxDmg', e.target.value)}
                inputProps={{ maxLength: 32 }}
              />
              <TextField
                label="Assail Sound" size="small" sx={{ width: 120 }}
                value={data.assailSound}
                onChange={(e) => set('assailSound', e.target.value)}
                inputProps={{ maxLength: 32 }}
              />
            </Box>
            <TextField
              label="Description" size="small" multiline minRows={2}
              value={data.description}
              onChange={(e) => set('description', e.target.value)}
              inputProps={{ maxLength: 1024 }}
            />
          </Box>

          {/* Nested sections */}
          <Section title="Loot" open={openLoot} onToggle={() => setOpenLoot((v) => !v)}>
            <LootContent loot={data.loot} onChange={(val) => set('loot', val)} />
          </Section>
          <Section title="Hostility" open={openHostility} onToggle={() => setOpenHostility((v) => !v)}>
            <HostilityContent hostility={data.hostility} onChange={(val) => set('hostility', val)} />
          </Section>
          <Section title="Cookies" open={openCookies} onToggle={() => setOpenCookies((v) => !v)}>
            <CookiesContent cookies={data.cookies} onChange={(val) => set('cookies', val)} />
          </Section>
        </Box>
      </Collapse>
    </Paper>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────
function CreatureEditor({ creature, initialFileName, isArchived, isExisting, onSave, onArchive, onUnarchive, onDirtyChange, saveRef }) {
  const [data, setData] = useState(creature);
  const [prefix, setPrefix] = useState('');
  const [fileName, setFileName] = useState(initialFileName || computeCreatureFilename('', creature.name));
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName);

  const [openLoot, setOpenLoot] = useState(false);
  const [openHostility, setOpenHostility] = useState(false);
  const [openCookies, setOpenCookies] = useState(false);

  const isDirtyRef = useRef(false);

  useEffect(() => {
    setData(creature);
    setPrefix('');
    setFileName(initialFileName || computeCreatureFilename('', creature.name));
    setFileNameEdited(!!initialFileName);
    setOpenLoot(false);
    setOpenHostility(false);
    setOpenCookies(false);
    isDirtyRef.current = false;
    onDirtyChange?.(false);
  }, [creature, initialFileName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!fileNameEdited) setFileName(computeCreatureFilename(prefix, data.name));
  }, [prefix]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirtyLocal = useCallback(() => {
    if (!isDirtyRef.current) { isDirtyRef.current = true; onDirtyChange?.(true); }
  }, [onDirtyChange]);

  const updateData = useCallback((updater) => {
    markDirtyLocal();
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!fileNameEdited) setFileName(computeCreatureFilename(prefix, next.name));
      return next;
    });
  }, [fileNameEdited, prefix, markDirtyLocal]);

  const set = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.value }));

  const handleRegenerate = () => {
    markDirtyLocal();
    setFileName(computeCreatureFilename(prefix, data.name));
    setFileNameEdited(false);
  };

  // Subtype helpers
  const addSubtype = () => updateData((d) => ({
    ...d, subtypes: [...d.subtypes, makeDefaultSubtype()],
  }));

  const updateSubtype = (i, updated) => updateData((d) => ({
    ...d, subtypes: d.subtypes.map((s, idx) => idx === i ? updated : s),
  }));

  const removeSubtype = (i) => updateData((d) => ({
    ...d, subtypes: d.subtypes.filter((_, idx) => idx !== i),
  }));

  if (saveRef) saveRef.current = () => onSave(data, fileName);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>
            {data.name || '(unnamed creature)'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {isExisting && !isArchived && (
              <Tooltip title="Archive Creature">
                <IconButton size="small" onClick={onArchive}><ArchiveIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
            {isExisting && isArchived && (
              <Tooltip title="Unarchive Creature">
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
        {/* Root creature fields (headerless) */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Prefix" size="small" sx={{ width: 140 }}
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                inputProps={{ maxLength: 64, spellCheck: false }}
              />
              <TextField
                label="Name" required size="small" sx={{ flex: 1, minWidth: 160 }}
                value={data.name}
                onChange={set('name')}
                inputProps={{ maxLength: 255 }}
              />
              <TextField
                label="Sprite" size="small" sx={{ width: 100 }}
                value={data.sprite}
                onChange={set('sprite')}
                inputProps={{ maxLength: 64 }}
              />
              <BehaviorSetPicker
                value={data.behaviorSet}
                onChange={(val) => updateData((d) => ({ ...d, behaviorSet: val }))}
                sx={{ flex: 1, minWidth: 180 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Min Damage" size="small" sx={{ width: 120 }}
                value={data.minDmg}
                onChange={set('minDmg')}
                inputProps={{ maxLength: 32 }}
              />
              <TextField
                label="Max Damage" size="small" sx={{ width: 120 }}
                value={data.maxDmg}
                onChange={set('maxDmg')}
                inputProps={{ maxLength: 32 }}
              />
              <TextField
                label="Assail Sound" size="small" sx={{ width: 120 }}
                value={data.assailSound}
                onChange={set('assailSound')}
                inputProps={{ maxLength: 32 }}
              />
            </Box>
            <TextField
              label="Description" size="small" multiline minRows={2}
              value={data.description}
              onChange={set('description')}
              inputProps={{ maxLength: 1024 }}
            />
            <CommentField value={data.comment} onChange={set('comment')} />
          </Box>
        </Paper>

        {/* Loot */}
        <Section title="Loot" open={openLoot} onToggle={() => setOpenLoot((v) => !v)}>
          <LootContent
            loot={data.loot}
            onChange={(val) => updateData((d) => ({ ...d, loot: val }))}
          />
        </Section>

        {/* Hostility */}
        <Section title="Hostility" open={openHostility} onToggle={() => setOpenHostility((v) => !v)}>
          <HostilityContent
            hostility={data.hostility}
            onChange={(val) => updateData((d) => ({ ...d, hostility: val }))}
          />
        </Section>

        {/* Cookies */}
        <Section title="Cookies" open={openCookies} onToggle={() => setOpenCookies((v) => !v)}>
          <CookiesContent
            cookies={data.cookies}
            onChange={(val) => updateData((d) => ({ ...d, cookies: val }))}
          />
        </Section>

        {/* Subtypes */}
        {data.subtypes.map((sub, i) => (
          <SubtypeAccordion
            key={i}
            data={sub}
            index={i}
            onChange={(updated) => updateSubtype(i, updated)}
            onRemove={() => removeSubtype(i)}
          />
        ))}

        <Box sx={{ mb: 2 }}>
          <Button startIcon={<AddIcon />} onClick={addSubtype}>Add Subtype</Button>
        </Box>
      </Box>
    </Box>
  );
}

export default CreatureEditor;
