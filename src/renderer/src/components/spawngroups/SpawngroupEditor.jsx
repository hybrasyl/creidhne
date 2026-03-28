import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import { libraryIndexState } from '../../recoil/atoms';
import {
  Box, Button, Typography, Divider, TextField, Tooltip, IconButton, Paper,
  FormControl, InputLabel, Select, MenuItem, FormControlLabel, Checkbox,
  Autocomplete, Chip, Collapse,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CommentField from '../shared/CommentField';
import { IMMUNITY_TYPES, MESSAGE_TYPES } from '../../data/behaviorSetConstants';
import { ELEMENT_TYPES } from '../../data/itemConstants';

const SPAWN_FLAGS = ['Active', 'MovementDisabled', 'AiDisabled', 'DeathDisabled'];

function computeFilename(prefix, name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '');
  if (!safe) return '';
  const p = (prefix || '').trim().toLowerCase().replace(/\s+/g, '_');
  return p ? `${p}_${safe}.xml` : `${safe}.xml`;
}

const makeDefaultSpawn = () => ({
  name: '',
  import: '',
  flags: [],
  immunities: [],
  loot: [],
  coordinates: [],
  combat: {
    minDmg: '', maxDmg: '', offensiveElement: '',
    ac: '', mr: '', defensiveElement: '',
  },
  base: { level: '', weakChance: '', strongChance: '', behaviorSet: '' },
  spec: {
    disabled: false,
    minCount: '', maxCount: '', maxPerInterval: '',
    interval: '', limit: '', percentage: '',
  },
  hostility: {
    players: false, playerExceptCookie: '', playerOnlyCookie: '',
    monsters: false, monsterExceptCookie: '', monsterOnlyCookie: '',
  },
  cookies: [],
});

// ── Section wrapper ───────────────────────────────────────────────────────────

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

// ── Shared content components ─────────────────────────────────────────────────

function ImmunityRow({ row, index, libraryIndex, onChangeField, onChangeType, onRemove }) {
  const { type, value, messageType, message } = row;

  const valueOptions = (() => {
    switch (type) {
      case 'Element':  return libraryIndex.elementnames || [];
      case 'Castable': return libraryIndex.castables     || [];
      case 'Status':   return libraryIndex.statuses      || [];
      default:         return [];
    }
  })();

  const isCategory = type === 'StatusCategory' || type === 'CastableCategory';

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Type</InputLabel>
        <Select value={type} label="Type" onChange={(e) => onChangeType(index, e.target.value)}>
          {IMMUNITY_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </Select>
      </FormControl>

      {isCategory ? (
        <TextField
          label="Category" size="small" sx={{ flex: 1, minWidth: 160 }}
          value={value}
          onChange={(e) => onChangeField(index, 'value', e.target.value)}
        />
      ) : (
        <Autocomplete
          freeSolo
          options={valueOptions}
          value={value}
          onInputChange={(_, val, reason) => { if (reason === 'input') onChangeField(index, 'value', val); }}
          onChange={(_, val) => onChangeField(index, 'value', val ?? '')}
          size="small"
          sx={{ flex: 1, minWidth: 160 }}
          renderInput={(params) => <TextField {...params} label={type || 'Value'} />}
        />
      )}

      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Message Type</InputLabel>
        <Select value={messageType} label="Message Type" onChange={(e) => onChangeField(index, 'messageType', e.target.value)}>
          {MESSAGE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </Select>
      </FormControl>

      <TextField
        label="Message" size="small" sx={{ flex: 1, minWidth: 140 }}
        value={message}
        onChange={(e) => onChangeField(index, 'message', e.target.value)}
        inputProps={{ maxLength: 50 }}
      />

      <IconButton size="small" color="error" onClick={() => onRemove(index)}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

function LootContent({ loot, lootsetOptions, onChange }) {
  const add = () => onChange([...loot, { name: '', rolls: '', chance: '' }]);
  const set = (i, field, val) => onChange(loot.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  const remove = (i) => onChange(loot.filter((_, idx) => idx !== i));

  return (
    <>
      {loot.map((entry, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
          <Autocomplete
            freeSolo
            options={lootsetOptions}
            value={entry.name}
            onInputChange={(_, val, reason) => { if (reason === 'input') set(i, 'name', val); }}
            onChange={(_, val) => set(i, 'name', val ?? '')}
            size="small"
            sx={{ flex: 1, minWidth: 200 }}
            renderInput={(params) => <TextField {...params} label="Loot Set" />}
          />
          <TextField
            label="Rolls" size="small" sx={{ width: 90 }}
            value={entry.rolls}
            onChange={(e) => set(i, 'rolls', e.target.value.replace(/\D/g, ''))}
            inputProps={{ inputMode: 'numeric' }}
          />
          <TextField
            label="Chance" size="small" sx={{ width: 90 }}
            value={entry.chance}
            onChange={(e) => set(i, 'chance', e.target.value.replace(/\D/g, ''))}
            inputProps={{ inputMode: 'numeric' }}
          />
          <IconButton size="small" color="error" onClick={() => remove(i)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={add}>Add Loot</Button>
    </>
  );
}

function HostilityContent({ hostility, onChange }) {
  const set = (field, val) => onChange({ ...hostility, [field]: val });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {[
        { key: 'players', label: 'Players', exceptKey: 'playerExceptCookie', onlyKey: 'playerOnlyCookie' },
        { key: 'monsters', label: 'Monsters', exceptKey: 'monsterExceptCookie', onlyKey: 'monsterOnlyCookie' },
      ].map(({ key, label, exceptKey, onlyKey }) => (
        <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Checkbox size="small" checked={hostility[key]}
                onChange={(e) => set(key, e.target.checked)} />
            }
            label={<Typography variant="body2">{label}</Typography>}
            sx={{ minWidth: 100, m: 0 }}
          />
          {hostility[key] && (
            <>
              <TextField
                label="Except Cookie" size="small" sx={{ flex: 1, minWidth: 140 }}
                value={hostility[exceptKey]}
                onChange={(e) => set(exceptKey, e.target.value)}
                inputProps={{ maxLength: 128 }}
              />
              <TextField
                label="Only Cookie" size="small" sx={{ flex: 1, minWidth: 140 }}
                value={hostility[onlyKey]}
                onChange={(e) => set(onlyKey, e.target.value)}
                inputProps={{ maxLength: 128 }}
              />
            </>
          )}
        </Box>
      ))}
    </Box>
  );
}

function CookiesContent({ cookies, onChange }) {
  const add = () => onChange([...cookies, { name: '', value: '' }]);
  const set = (i, field, val) => onChange(cookies.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  const remove = (i) => onChange(cookies.filter((_, idx) => idx !== i));

  return (
    <>
      {cookies.map((cookie, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
          <TextField
            label="Cookie Name" size="small" sx={{ flex: 1 }}
            value={cookie.name}
            onChange={(e) => set(i, 'name', e.target.value)}
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

// ── Spawn accordion ───────────────────────────────────────────────────────────

function SpawnAccordion({ spawn, index, libraryIndex, onChange, onRemove }) {
  const [open,              setOpen]              = useState(true);
  const [openImmunities,    setOpenImmunities]    = useState(false);
  const [openLoot,          setOpenLoot]          = useState(false);
  const [openCoordinates,   setOpenCoordinates]   = useState(false);
  const [openCombat,        setOpenCombat]        = useState(false);
  const [openBase,          setOpenBase]          = useState(false);
  const [openSpec,          setOpenSpec]          = useState(false);
  const [openHostility,     setOpenHostility]     = useState(false);
  const [openCookies,       setOpenCookies]       = useState(false);

  const set = (field, val) => onChange({ ...spawn, [field]: val });
  const setNested = (section, field, val) =>
    onChange({ ...spawn, [section]: { ...spawn[section], [field]: val } });

  const title = `Spawn ${index + 1}${spawn.name ? ` — ${spawn.name}` : ''}`;

  const creatureOptions = [
    ...(libraryIndex.creatures || []),
    ...(libraryIndex.creatureTypes || []),
  ];
  const lootsetOptions = libraryIndex.lootsets || [];

  const negInt = (val) => val.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '');
  const posInt = (val) => val.replace(/\D/g, '');
  const posDec = (val) => val.replace(/[^0-9.]/g, '');

  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>

      {/* Spawn header */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, userSelect: 'none' }}>
        <Box
          sx={{ display: 'flex', flex: 1, alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setOpen((v) => !v)}
        >
          <Typography variant="subtitle2" sx={{ flex: 1 }}>{title}</Typography>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </Box>
        <IconButton size="small" color="error" sx={{ ml: 1 }} onClick={onRemove}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

          {/* Row: Name, Import, Flags */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Autocomplete
              freeSolo
              options={creatureOptions}
              value={spawn.name}
              onInputChange={(_, val, reason) => { if (reason === 'input') set('name', val); }}
              onChange={(_, val) => set('name', val ?? '')}
              size="small"
              sx={{ flex: 2, minWidth: 180 }}
              renderInput={(params) => <TextField {...params} label="Name" />}
            />
            <Autocomplete
              freeSolo
              options={libraryIndex.spawngroups || []}
              value={spawn.import}
              onInputChange={(_, val, reason) => { if (reason === 'input') set('import', val); }}
              onChange={(_, val) => set('import', val ?? '')}
              size="small"
              sx={{ flex: 2, minWidth: 180 }}
              renderInput={(params) => <TextField {...params} label="Import" />}
            />
            <Autocomplete
              multiple
              options={SPAWN_FLAGS}
              value={spawn.flags}
              onChange={(_, val) => set('flags', val)}
              disableCloseOnSelect
              size="small"
              sx={{ flex: 2, minWidth: 200 }}
              renderTags={(value, getTagProps) =>
                value.map((option, i) => (
                  <Chip key={option} label={option} size="small" {...getTagProps({ index: i })} />
                ))
              }
              renderInput={(params) => <TextField {...params} label="Flags" />}
            />
          </Box>

          {/* Immunities */}
          <Section title="Immunities" open={openImmunities} onToggle={() => setOpenImmunities((v) => !v)}>
            {spawn.immunities.map((row, i) => (
              <ImmunityRow
                key={i}
                row={row}
                index={i}
                libraryIndex={libraryIndex}
                onChangeField={(idx, field, val) =>
                  set('immunities', spawn.immunities.map((imm, j) => j === idx ? { ...imm, [field]: val } : imm))
                }
                onChangeType={(idx, newType) =>
                  set('immunities', spawn.immunities.map((imm, j) => j === idx ? { ...imm, type: newType, value: '' } : imm))
                }
                onRemove={(idx) => set('immunities', spawn.immunities.filter((_, j) => j !== idx))}
              />
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() =>
              set('immunities', [...spawn.immunities, { type: 'Element', value: '', messageType: 'Say', message: '' }])
            }>
              Add Immunity
            </Button>
          </Section>

          {/* Spawn Loot */}
          <Section title="Spawn Loot" open={openLoot} onToggle={() => setOpenLoot((v) => !v)}>
            <LootContent
              loot={spawn.loot}
              lootsetOptions={lootsetOptions}
              onChange={(val) => set('loot', val)}
            />
          </Section>

          {/* Coordinates */}
          <Section title="Coordinates" open={openCoordinates} onToggle={() => setOpenCoordinates((v) => !v)}>
            {spawn.coordinates.map((coord, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                <TextField
                  label="X" size="small" sx={{ width: 100 }}
                  value={coord.x}
                  onChange={(e) => {
                    const updated = spawn.coordinates.map((c, j) => j === i ? { ...c, x: negInt(e.target.value) } : c);
                    set('coordinates', updated);
                  }}
                  inputProps={{ inputMode: 'numeric' }}
                />
                <TextField
                  label="Y" size="small" sx={{ width: 100 }}
                  value={coord.y}
                  onChange={(e) => {
                    const updated = spawn.coordinates.map((c, j) => j === i ? { ...c, y: negInt(e.target.value) } : c);
                    set('coordinates', updated);
                  }}
                  inputProps={{ inputMode: 'numeric' }}
                />
                <IconButton size="small" color="error"
                  onClick={() => set('coordinates', spawn.coordinates.filter((_, j) => j !== i))}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />}
              onClick={() => set('coordinates', [...spawn.coordinates, { x: '', y: '' }])}>
              Add Coordinate
            </Button>
          </Section>

          {/* Combat */}
          <Section title="Combat" open={openCombat} onToggle={() => setOpenCombat((v) => !v)}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <TextField
                  label="Min Damage" size="small" sx={{ width: 120 }}
                  value={spawn.combat.minDmg}
                  onChange={(e) => setNested('combat', 'minDmg', posInt(e.target.value))}
                  inputProps={{ inputMode: 'numeric' }}
                />
                <TextField
                  label="Max Damage" size="small" sx={{ width: 120 }}
                  value={spawn.combat.maxDmg}
                  onChange={(e) => setNested('combat', 'maxDmg', posInt(e.target.value))}
                  inputProps={{ inputMode: 'numeric' }}
                />
                <Autocomplete
                  options={ELEMENT_TYPES}
                  value={spawn.combat.offensiveElement || 'None'}
                  onChange={(_, val) => setNested('combat', 'offensiveElement', val || 'None')}
                  disableClearable
                  size="small"
                  sx={{ width: 180 }}
                  renderInput={(params) => <TextField {...params} label="Offensive Element" />}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <TextField
                  label="Armor Class" size="small" sx={{ width: 120 }}
                  value={spawn.combat.ac}
                  onChange={(e) => setNested('combat', 'ac', negInt(e.target.value))}
                  inputProps={{ inputMode: 'numeric' }}
                />
                <TextField
                  label="Magic Resist" size="small" sx={{ width: 120 }}
                  value={spawn.combat.mr}
                  onChange={(e) => setNested('combat', 'mr', negInt(e.target.value))}
                  inputProps={{ inputMode: 'numeric' }}
                />
                <Autocomplete
                  options={ELEMENT_TYPES}
                  value={spawn.combat.defensiveElement || 'None'}
                  onChange={(_, val) => setNested('combat', 'defensiveElement', val || 'None')}
                  disableClearable
                  size="small"
                  sx={{ width: 180 }}
                  renderInput={(params) => <TextField {...params} label="Defensive Element" />}
                />
              </Box>
            </Box>
          </Section>

          {/* Spawn Base */}
          <Section title="Spawn Base" open={openBase} onToggle={() => setOpenBase((v) => !v)}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                label="Level" size="small" sx={{ width: 90 }}
                value={spawn.base.level}
                onChange={(e) => setNested('base', 'level', posInt(e.target.value))}
                inputProps={{ inputMode: 'numeric' }}
              />
              <TextField
                label="Weak Chance" size="small" sx={{ width: 120 }}
                value={spawn.base.weakChance}
                onChange={(e) => setNested('base', 'weakChance', posDec(e.target.value))}
                inputProps={{ inputMode: 'decimal' }}
              />
              <TextField
                label="Strong Chance" size="small" sx={{ width: 120 }}
                value={spawn.base.strongChance}
                onChange={(e) => setNested('base', 'strongChance', posDec(e.target.value))}
                inputProps={{ inputMode: 'decimal' }}
              />
            </Box>
          </Section>

          {/* Spawn Spec */}
          <Section title="Spawn Spec" open={openSpec} onToggle={() => setOpenSpec((v) => !v)}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box>
                <FormControlLabel
                  control={
                    <Checkbox size="small" checked={spawn.spec.disabled}
                      onChange={(e) => setNested('spec', 'disabled', e.target.checked)} />
                  }
                  label={<Typography variant="body2">Disabled</Typography>}
                  sx={{ m: 0 }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <TextField
                  label="Min Count" size="small" sx={{ width: 110 }}
                  value={spawn.spec.minCount}
                  onChange={(e) => setNested('spec', 'minCount', posInt(e.target.value))}
                  inputProps={{ inputMode: 'numeric' }}
                />
                <TextField
                  label="Max Count" size="small" sx={{ width: 110 }}
                  value={spawn.spec.maxCount}
                  onChange={(e) => setNested('spec', 'maxCount', posInt(e.target.value))}
                  inputProps={{ inputMode: 'numeric' }}
                />
                <TextField
                  label="Max Per Interval" size="small" sx={{ width: 140 }}
                  value={spawn.spec.maxPerInterval}
                  onChange={(e) => setNested('spec', 'maxPerInterval', posInt(e.target.value))}
                  inputProps={{ inputMode: 'numeric' }}
                />
                <TextField
                  label="Interval" size="small" sx={{ width: 100 }}
                  value={spawn.spec.interval}
                  onChange={(e) => setNested('spec', 'interval', posInt(e.target.value))}
                  inputProps={{ inputMode: 'numeric' }}
                />
                <TextField
                  label="Limit" size="small" sx={{ width: 90 }}
                  value={spawn.spec.limit}
                  onChange={(e) => setNested('spec', 'limit', posInt(e.target.value))}
                  inputProps={{ inputMode: 'numeric' }}
                />
                <TextField
                  label="Percentage" size="small" sx={{ width: 110 }}
                  value={spawn.spec.percentage}
                  onChange={(e) => setNested('spec', 'percentage', posDec(e.target.value))}
                  inputProps={{ inputMode: 'decimal' }}
                />
              </Box>
            </Box>
          </Section>

          {/* Hostility */}
          <Section title="Hostility" open={openHostility} onToggle={() => setOpenHostility((v) => !v)}>
            <HostilityContent
              hostility={spawn.hostility}
              onChange={(val) => set('hostility', val)}
            />
          </Section>

          {/* Set Cookies */}
          <Section title="Set Cookies" open={openCookies} onToggle={() => setOpenCookies((v) => !v)}>
            <CookiesContent
              cookies={spawn.cookies}
              onChange={(val) => set('cookies', val)}
            />
          </Section>

        </Box>
      </Collapse>
    </Paper>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

function SpawngroupEditor({
  spawngroup, initialFileName, isArchived, isExisting,
  onSave, onArchive, onUnarchive, onDirtyChange, saveRef,
}) {
  const [data, setData] = useState(spawngroup);
  const [prefix, setPrefix] = useState('');
  const [fileName, setFileName] = useState(
    () => initialFileName || computeFilename('', spawngroup.name)
  );
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName);

  const [openGroupLoot, setOpenGroupLoot] = useState(true);
  const [openSpawns,    setOpenSpawns]    = useState(true);

  const libraryIndex = useRecoilValue(libraryIndexState);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    setData(spawngroup);
    setPrefix('');
    setFileName(initialFileName || computeFilename('', spawngroup.name));
    setFileNameEdited(!!initialFileName);
    isDirtyRef.current = false;
    onDirtyChange?.(false);
  }, [spawngroup, initialFileName]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirty = useCallback(() => {
    if (!isDirtyRef.current) { isDirtyRef.current = true; onDirtyChange?.(true); }
  }, [onDirtyChange]);

  const updateData = useCallback((updater) => {
    markDirty();
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!fileNameEdited) setFileName(computeFilename(prefix, next.name));
      return next;
    });
  }, [fileNameEdited, prefix, markDirty]);

  const set = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.value }));
  const setChecked = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.checked }));

  const handlePrefixChange = (e) => {
    markDirty();
    setPrefix(e.target.value);
    if (!fileNameEdited) setFileName(computeFilename(e.target.value, data.name));
  };

  const handleRegenerate = () => {
    markDirty();
    setFileName(computeFilename(prefix, data.name));
    setFileNameEdited(false);
  };

  const handleSave = () => onSave(data, fileName);
  if (saveRef) saveRef.current = handleSave;

  // ── Group Loot ──────────────────────────────────────────────────────────────

  const lootsetOptions = libraryIndex.lootsets || [];

  // ── Spawns ──────────────────────────────────────────────────────────────────

  const addSpawn = () =>
    updateData((d) => ({ ...d, spawns: [...(d.spawns || []), makeDefaultSpawn()] }));

  const updateSpawn = (i, updated) =>
    updateData((d) => ({ ...d, spawns: d.spawns.map((s, idx) => idx === i ? updated : s) }));

  const removeSpawn = (i) =>
    updateData((d) => ({ ...d, spawns: d.spawns.filter((_, idx) => idx !== i) }));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>
            {data.name || '(unnamed spawn group)'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {isExisting && !isArchived && (
              <Tooltip title="Archive spawn group">
                <IconButton size="small" onClick={onArchive}><ArchiveIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
            {isExisting && isArchived && (
              <Tooltip title="Unarchive spawn group">
                <IconButton size="small" onClick={onUnarchive}><UnarchiveIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
            <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={handleSave}>
              Save
            </Button>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TextField
            size="small" label="Filename" value={fileName}
            onChange={(e) => { markDirty(); setFileName(e.target.value); setFileNameEdited(true); }}
            sx={{ flex: 1 }} inputProps={{ spellCheck: false }}
          />
          <Tooltip title="Regenerate from prefix + name">
            <IconButton size="small" onClick={handleRegenerate}><AutorenewIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Divider sx={{ mb: 1, flexShrink: 0 }} />

      <Box sx={{ flex: 1, overflow: 'auto' }}>

        {/* ── Basic fields ── */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Line 1: Name + Prefix */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                label="Name" required size="small" sx={{ flex: 1, minWidth: 160 }}
                value={data.name} onChange={set('name')} inputProps={{ maxLength: 255 }}
              />
              <TextField
                label="Prefix" size="small" sx={{ width: 150 }}
                value={prefix} onChange={handlePrefixChange}
                inputProps={{ maxLength: 64, spellCheck: false }}
              />
            </Box>

            {/* Line 2: Base Level, Active From, Active To, Despawn After */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                label="Base Level" size="small" sx={{ width: 110 }}
                value={data.baseLevel} onChange={set('baseLevel')}
                inputProps={{ inputMode: 'numeric' }}
              />
              <TextField
                label="Active From" size="small" sx={{ flex: 1, minWidth: 120 }}
                value={data.activeFrom} onChange={set('activeFrom')}
              />
              <TextField
                label="Active To" size="small" sx={{ flex: 1, minWidth: 120 }}
                value={data.activeTo} onChange={set('activeTo')}
              />
              <TextField
                label="Despawn After" size="small" sx={{ flex: 1, minWidth: 120 }}
                value={data.despawnAfter} onChange={set('despawnAfter')}
              />
            </Box>

            {/* Line 3: Checkboxes */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={<Checkbox size="small" checked={data.disabled} onChange={setChecked('disabled')} />}
                label={<Typography variant="body2">Disabled</Typography>}
                sx={{ m: 0 }}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={data.despawnLoot} onChange={setChecked('despawnLoot')} />}
                label={<Typography variant="body2">Despawn Loot</Typography>}
                sx={{ m: 0 }}
              />
            </Box>

            {/* Line 4: Comment */}
            <CommentField value={data.comment} onChange={set('comment')} />

          </Box>
        </Paper>

        {/* ── Group Loot ── */}
        <Section title="Group Loot" open={openGroupLoot} onToggle={() => setOpenGroupLoot((v) => !v)}>
          <LootContent
            loot={data.loot}
            lootsetOptions={lootsetOptions}
            onChange={(val) => updateData((d) => ({ ...d, loot: val }))}
          />
        </Section>

        {/* ── Spawns ── */}
        <Section title="Spawns" open={openSpawns} onToggle={() => setOpenSpawns((v) => !v)}>
          <Button size="small" startIcon={<AddIcon />} onClick={addSpawn}
            sx={{ mb: (data.spawns || []).length ? 2 : 0 }}>
            Add Spawn
          </Button>
          {(data.spawns || []).map((spawn, i) => (
            <SpawnAccordion
              key={i}
              spawn={spawn}
              index={i}
              libraryIndex={libraryIndex}
              onChange={(updated) => updateSpawn(i, updated)}
              onRemove={() => removeSpawn(i)}
            />
          ))}
        </Section>

      </Box>
    </Box>
  );
}

export default SpawngroupEditor;
