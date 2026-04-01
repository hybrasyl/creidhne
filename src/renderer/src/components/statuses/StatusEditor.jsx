import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box, Button, Typography, Divider, TextField, Tooltip, IconButton, Paper,
  Switch, Select, MenuItem, FormControl, InputLabel, FormControlLabel,
  Checkbox, Autocomplete, Collapse, Alert, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import ConstantAutocomplete from '../shared/ConstantAutocomplete';
import StringKeyField from '../shared/StringKeyField';
import HealEditor from '../shared/HealEditor';
import DamageEditor from '../shared/DamageEditor';
import SaveIcon from '@mui/icons-material/Save';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useRecoilValue } from 'recoil';
import { libraryIndexState } from '../../recoil/atoms';
import { ELEMENT_TYPES, ELEMENTAL_MODIFIER_TYPES, STAT_MODIFIERS } from '../../data/itemConstants';
import { CONDITIONS } from '../../data/statusConstants';
import CommentField from '../shared/CommentField';

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_ANIMATIONS = { targetId: '', targetSpeed: '', spellEffectId: '', spellEffectSpeed: '', soundId: '' };
const DEFAULT_MESSAGES   = [];
const MESSAGE_TYPES = [
  { value: 'target', label: 'Target System' },
  { value: 'source', label: 'Source System' },
  { value: 'say',    label: 'Self Say'       },
  { value: 'shout',  label: 'Self Shout'     },
  { value: 'group',  label: 'Group'          },
];
const DEFAULT_HEAL       = { kind: 'Static', value: '', min: '', max: '', formula: '' };
const DEFAULT_DAMAGE     = { element: 'None', type: 'Direct', flags: [], kind: 'Static', value: '', min: '', max: '', formula: '' };
const DEFAULT_STAT_MODS  = { rows: [], elementalModifiers: [] };
const DEFAULT_CONDITIONS = { set: [], unset: [] };
const DEFAULT_HANDLER    = { function: '', scriptSource: '' };

function computeStatusFilename(prefix, name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '');
  if (!safe) return '';
  const p = (prefix || '').trim().toLowerCase().replace(/\s+/g, '_');
  return p ? `${p}_${safe}.xml` : `${safe}.xml`;
}

// ── Computed remove/expire values ──────────────────────────────────────────────

function computeRemoveStatMods(data) {
  const { onApply, onTick, duration, tick } = data;
  if (!onApply.statModifiers && !onTick.statModifiers) return null;

  const dur   = parseFloat(duration);
  const tck   = parseFloat(tick);
  const ratio = (!isNaN(dur) && !isNaN(tck) && tck > 0) ? dur / tck : 0;

  const applyRows = onApply.statModifiers?.rows || [];
  const tickRows  = onTick.statModifiers?.rows  || [];
  const allKeys   = [...new Set([...applyRows.map((r) => r.key), ...tickRows.map((r) => r.key)])];

  const rows = [];
  for (const key of allKeys) {
    const av = parseFloat(applyRows.find((r) => r.key === key)?.value || '0');
    const tv = parseFloat(tickRows.find((r)  => r.key === key)?.value || '0');
    if (!isNaN(av) && !isNaN(tv)) {
      const total = av + tv * ratio;
      if (total !== 0) rows.push({ key, value: String(-total) });
    }
  }

  const applyElems = onApply.statModifiers?.elementalModifiers || [];
  const elementalModifiers = applyElems.map((em) => {
    const mod = parseFloat(em.modifier);
    return { ...em, modifier: !isNaN(mod) ? String(-mod) : em.modifier };
  });

  return (rows.length || elementalModifiers.length) ? { rows, elementalModifiers } : null;
}

function computeRemoveConditions(data) {
  const allSet = [
    ...(data.onApply.conditions?.set || []),
    ...(data.onTick.conditions?.set  || []),
  ];
  const unique = [...new Set(allSet.filter(Boolean))];
  return unique.length ? { set: [], unset: unique } : null;
}

// ── Shared wrappers ────────────────────────────────────────────────────────────

function Section({ title, open, onToggle, children }) {
  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, cursor: 'pointer', userSelect: 'none' }} onClick={onToggle}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>{title}</Typography>
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>
      <Collapse in={open}><Divider /><Box sx={{ p: 2 }}>{children}</Box></Collapse>
    </Paper>
  );
}

function SubSection({ title, enabled, onEnable, open, onToggle, children }) {
  return (
    <Paper variant="outlined" sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 0.75, cursor: 'pointer', userSelect: 'none' }} onClick={onToggle}>
        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>{title}</Typography>
        {onEnable !== undefined && (
          <Switch size="small" checked={!!enabled}
            onChange={(e) => { e.stopPropagation(); onEnable(e.target.checked); }}
            onClick={(e) => e.stopPropagation()} sx={{ mr: 0.5 }} />
        )}
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>
      <Collapse in={open}><Divider /><Box sx={{ p: 1.5 }}>{children}</Box></Collapse>
    </Paper>
  );
}

// ── Effect sub-section renderers ───────────────────────────────────────────────

function UserFeedbackContent({ anim, onChange }) {
  const set = (field) => (e) => onChange({ ...anim, [field]: e.target.value.replace(/\D/g, '') });
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <TextField label="Target Anim ID"    value={anim.targetId}         size="small" sx={{ flex: 1, minWidth: 140 }} onChange={set('targetId')}         inputProps={{ inputMode: 'numeric' }} />
        <TextField label="Target Anim Speed" value={anim.targetSpeed}      size="small" sx={{ flex: 1, minWidth: 140 }} onChange={set('targetSpeed')}      inputProps={{ inputMode: 'numeric' }} />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <TextField label="Self Anim ID"      value={anim.spellEffectId}    size="small" sx={{ flex: 1, minWidth: 140 }} onChange={set('spellEffectId')}    inputProps={{ inputMode: 'numeric' }} />
        <TextField label="Self Anim Speed"   value={anim.spellEffectSpeed} size="small" sx={{ flex: 1, minWidth: 140 }} onChange={set('spellEffectSpeed')} inputProps={{ inputMode: 'numeric' }} />
      </Box>
      <TextField label="Sound ID" value={anim.soundId} size="small" sx={{ maxWidth: 200 }} onChange={set('soundId')} inputProps={{ inputMode: 'numeric' }} />
    </Box>
  );
}


function MessagesContent({ msgs, onChange }) {
  const usedTypes = msgs.map((m) => m.type);
  const allUsed   = usedTypes.length >= MESSAGE_TYPES.length;

  const addMsg = () => {
    const next = MESSAGE_TYPES.find((t) => !usedTypes.includes(t.value));
    if (!next) return;
    onChange([...msgs, { type: next.value, text: '', key: '' }]);
  };

  const updateMsg = (i, updates) =>
    onChange(msgs.map((m, idx) => idx === i ? { ...m, ...updates } : m));

  const removeMsg = (i) =>
    onChange(msgs.filter((_, idx) => idx !== i));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {msgs.map((msg, i) => {
        const available = MESSAGE_TYPES.filter((t) => t.value === msg.type || !usedTypes.includes(t.value));
        return (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControl size="small" sx={{ width: 150, flexShrink: 0 }}>
              <InputLabel>Type</InputLabel>
              <Select value={msg.type} label="Type"
                onChange={(e) => updateMsg(i, { type: e.target.value })}>
                {available.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
            <StringKeyField text={msg.text} stringKey={msg.key}
              onChange={({ text, key }) => updateMsg(i, { text, key })} />
            <IconButton size="small" color="error" onClick={() => removeMsg(i)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      })}
      <Box>
        <Button size="small" startIcon={<AddIcon />} onClick={addMsg} disabled={allUsed}>
          Add Message
        </Button>
      </Box>
    </Box>
  );
}


// ── Stat modifier row ──────────────────────────────────────────────────────────

function StatModRow({ row, index, usedKeys, onChange, onRemove }) {
  const available = STAT_MODIFIERS.filter((s) => s.key === row.key || !usedKeys.includes(s.key));
  const statDef   = STAT_MODIFIERS.find((s) => s.key === row.key);

  const handleKeyChange = (newKey) => {
    const def = STAT_MODIFIERS.find((s) => s.key === newKey);
    onChange(index, 'key', newKey);
    onChange(index, 'value', def?.type === 'element' ? 'None' : '');
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
      <FormControl size="small" sx={{ minWidth: 260 }}>
        <InputLabel>Stat</InputLabel>
        <Select value={row.key} label="Stat" onChange={(e) => handleKeyChange(e.target.value)}>
          {available.map((s) => <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>)}
        </Select>
      </FormControl>
      {statDef?.type === 'element' ? (
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Element</InputLabel>
          <Select value={row.value} label="Element" onChange={(e) => onChange(index, 'value', e.target.value)}>
            {ELEMENT_TYPES.map((el) => <MenuItem key={el} value={el}>{el}</MenuItem>)}
          </Select>
        </FormControl>
      ) : (
        <TextField label="Value" value={row.value} size="small" sx={{ width: 180 }}
          placeholder="number (pos or neg)"
          onChange={(e) => onChange(index, 'value', e.target.value)} />
      )}
      <IconButton size="small" color="error" onClick={() => onRemove(index)}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

function StatusStatModContent({ sm, onChange }) {
  const libraryIndex  = useRecoilValue(libraryIndexState);
  const elementNames  = libraryIndex.elementnames || [];

  const { rows, elementalModifiers } = sm;
  const usedKeys = rows.map((r) => r.key);
  const allUsed  = usedKeys.length >= STAT_MODIFIERS.length;

  const addRow = () => {
    const next = STAT_MODIFIERS.find((s) => !usedKeys.includes(s.key));
    if (!next) return;
    onChange({ ...sm, rows: [...rows, { key: next.key, value: next.type === 'element' ? 'None' : '' }] });
  };

  const changeRow = (i, field, val) =>
    onChange({ ...sm, rows: rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r) });

  const removeRow = (i) =>
    onChange({ ...sm, rows: rows.filter((_, idx) => idx !== i) });

  const addElem    = () => onChange({ ...sm, elementalModifiers: [...elementalModifiers, { type: 'Augment', element: '', modifier: '1' }] });
  const setElem    = (i, field, val) => onChange({ ...sm, elementalModifiers: elementalModifiers.map((em, idx) => idx === i ? { ...em, [field]: val } : em) });
  const removeElem = (i) => onChange({ ...sm, elementalModifiers: elementalModifiers.filter((_, idx) => idx !== i) });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" gutterBottom>Stat Modifiers</Typography>
        {rows.map((row, i) => (
          <StatModRow key={i} row={row} index={i} usedKeys={usedKeys}
            onChange={changeRow} onRemove={removeRow} />
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={addRow} disabled={allUsed}>
          Add Stat Modifier
        </Button>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" gutterBottom>Elemental Modifiers</Typography>
        {elementalModifiers.map((em, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Type</InputLabel>
              <Select value={em.type} label="Type" onChange={(e) => setElem(i, 'type', e.target.value)}>
                {ELEMENTAL_MODIFIER_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <Autocomplete
              freeSolo options={elementNames} value={em.element}
              onInputChange={(_, val, reason) => { if (reason === 'input') setElem(i, 'element', val); }}
              onChange={(_, val) => setElem(i, 'element', val ?? '')}
              size="small" sx={{ flex: 1, minWidth: 140 }}
              renderInput={(params) => <TextField {...params} label="Element" />}
            />
            <TextField label="Modifier" value={em.modifier} size="small" sx={{ width: 110 }}
              onChange={(e) => setElem(i, 'modifier', e.target.value)} />
            <IconButton size="small" color="error" onClick={() => removeElem(i)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={addElem}>Add Elemental Modifier</Button>
      </Paper>
    </Box>
  );
}

function StatusStatModReadOnly({ sm }) {
  if (!sm || (!sm.rows?.length && !sm.elementalModifiers?.length)) {
    return <Typography variant="body2" color="text.secondary">No stat modifiers required.</Typography>;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="caption" color="text.secondary">
        Computed: -(OnApply + OnTick × Duration/Tick). Read-only.
      </Typography>
      {sm.rows?.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" gutterBottom>Stat Modifiers</Typography>
          {sm.rows.map((row, i) => {
            const label = STAT_MODIFIERS.find((s) => s.key === row.key)?.label || row.key;
            return (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                <TextField label="Stat"  value={label}     size="small" sx={{ minWidth: 260 }} inputProps={{ readOnly: true }} />
                <TextField label="Value" value={row.value} size="small" sx={{ width: 180 }}    inputProps={{ readOnly: true }} />
              </Box>
            );
          })}
        </Paper>
      )}
      {sm.elementalModifiers?.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" gutterBottom>Elemental Modifiers (negated)</Typography>
          {sm.elementalModifiers.map((em, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
              <TextField label="Type"     value={em.type}     size="small" sx={{ width: 130 }} inputProps={{ readOnly: true }} />
              <TextField label="Element"  value={em.element}  size="small" sx={{ flex: 1 }}    inputProps={{ readOnly: true }} />
              <TextField label="Modifier" value={em.modifier} size="small" sx={{ width: 110 }} inputProps={{ readOnly: true }} />
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}

// ── Conditions ─────────────────────────────────────────────────────────────────

function ConditionsContent({ conds, onChange }) {
  const rows = [
    ...(conds.set   || []).map((v) => ({ op: 'Set',   value: v })),
    ...(conds.unset || []).map((v) => ({ op: 'Unset', value: v })),
  ];

  const updateRow = (i, field, val) => {
    const updated = rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    onChange({
      set:   updated.filter((r) => r.op === 'Set').map((r) => r.value),
      unset: updated.filter((r) => r.op === 'Unset').map((r) => r.value),
    });
  };

  const addNewRow = () => {
    const updated = [...rows, { op: 'Set', value: '' }];
    onChange({
      set:   updated.filter((r) => r.op === 'Set').map((r) => r.value),
      unset: updated.filter((r) => r.op === 'Unset').map((r) => r.value),
    });
  };

  const removeRow = (i) => {
    const updated = rows.filter((_, idx) => idx !== i);
    onChange({
      set:   updated.filter((r) => r.op === 'Set').map((r) => r.value),
      unset: updated.filter((r) => r.op === 'Unset').map((r) => r.value),
    });
  };

  return (
    <Box>
      {rows.map((row, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Action</InputLabel>
            <Select value={row.op} label="Action" onChange={(e) => updateRow(i, 'op', e.target.value)}>
              <MenuItem value="Set">Set</MenuItem>
              <MenuItem value="Unset">Unset</MenuItem>
            </Select>
          </FormControl>
          <Autocomplete freeSolo options={CONDITIONS} value={row.value}
            onInputChange={(_, val, reason) => { if (reason === 'input') updateRow(i, 'value', val); }}
            onChange={(_, val) => updateRow(i, 'value', val ?? '')}
            size="small" sx={{ flex: 1 }}
            renderInput={(params) => <TextField {...params} label="Condition" />}
          />
          <IconButton size="small" color="error" onClick={() => removeRow(i)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={addNewRow}>Add Condition Event</Button>
    </Box>
  );
}

function ConditionsReadOnly({ conds }) {
  if (!conds || (!conds.set?.length && !conds.unset?.length)) {
    return <Typography variant="body2" color="text.secondary">No conditions to unset.</Typography>;
  }
  const rows = [
    ...(conds.set   || []).map((v) => ({ op: 'Set',   value: v })),
    ...(conds.unset || []).map((v) => ({ op: 'Unset', value: v })),
  ];
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Auto-unsets all conditions set by OnApply + OnTick
      </Typography>
      {rows.map((row, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
          <TextField label="Action"    value={row.op}    size="small" sx={{ width: 100 }} inputProps={{ readOnly: true }} />
          <TextField label="Condition" value={row.value} size="small" sx={{ flex: 1 }}   inputProps={{ readOnly: true }} />
        </Box>
      ))}
    </Box>
  );
}

// ── Effect accordion ───────────────────────────────────────────────────────────

function EffectAccordion({ title, data, onChange, readOnly = false, computedStatMods, computedConditions }) {
  const [open,         setOpen]         = useState(true);
  const [openFeedback, setOpenFeedback] = useState(!!data.animations);
  const [openMessages, setOpenMessages] = useState(!!data.messages);
  const [openHeal,     setOpenHeal]     = useState(!!data.heal);
  const [openDamage,   setOpenDamage]   = useState(!!data.damage);
  const [openStats,    setOpenStats]    = useState(!!data.statModifiers || !!computedStatMods);
  const [openConds,    setOpenConds]    = useState(!!data.conditions || !!computedConditions);
  const [openScript,   setOpenScript]   = useState(!!data.handler);

  useEffect(() => {
    setOpenFeedback(!!data.animations);
    setOpenMessages(!!data.messages);
    setOpenHeal(!!data.heal);
    setOpenDamage(!!data.damage);
    setOpenStats(!!data.statModifiers || !!computedStatMods);
    setOpenConds(!!data.conditions || !!computedConditions);
    setOpenScript(!!data.handler);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const upd = (field, val) => onChange({ ...data, [field]: val });

  const enableFeedback = (on) => { upd('animations',   on ? { ...DEFAULT_ANIMATIONS } : null); setOpenFeedback(on); };
  const enableMessages = (on) => { upd('messages',     on ? []                        : null); setOpenMessages(on); };
  const enableHeal     = (on) => { upd('heal',         on ? { ...DEFAULT_HEAL }       : null); setOpenHeal(on);     };
  const enableDamage   = (on) => { upd('damage',       on ? { ...DEFAULT_DAMAGE }     : null); setOpenDamage(on);   };
  const enableStats    = (on) => { upd('statModifiers', on ? { ...DEFAULT_STAT_MODS, elementalModifiers: [] } : null); setOpenStats(on); };
  const enableConds    = (on) => { upd('conditions',   on ? { ...DEFAULT_CONDITIONS } : null); setOpenConds(on);    };
  const enableScript   = (on) => { upd('handler',      on ? { ...DEFAULT_HANDLER }   : null); setOpenScript(on);   };

  const showStats = readOnly ? !!computedStatMods : true;
  const showConds = readOnly ? !!computedConditions : true;

  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, cursor: 'pointer', userSelect: 'none' }} onClick={() => setOpen((v) => !v)}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>{title}</Typography>
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>
      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2 }}>

          <SubSection title="User Feedback"
            enabled={!!data.animations} onEnable={enableFeedback}
            open={openFeedback} onToggle={() => setOpenFeedback((v) => !v)}>
            {data.animations
              ? <UserFeedbackContent anim={data.animations} onChange={(v) => upd('animations', v)} />
              : <Typography variant="body2" color="text.secondary">Enable to add animations and sound.</Typography>}
          </SubSection>

          <SubSection title="Messages"
            enabled={!!data.messages} onEnable={enableMessages}
            open={openMessages} onToggle={() => setOpenMessages((v) => !v)}>
            {data.messages
              ? <MessagesContent msgs={data.messages} onChange={(v) => upd('messages', v)} />
              : <Typography variant="body2" color="text.secondary">Enable to add messages.</Typography>}
          </SubSection>

          <SubSection title="Heal Formula"
            enabled={!!data.heal} onEnable={enableHeal}
            open={openHeal} onToggle={() => setOpenHeal((v) => !v)}>
            {data.heal
              ? <HealEditor value={data.heal} onChange={(v) => upd('heal', v)} />
              : <Typography variant="body2" color="text.secondary">Enable to add a heal formula.</Typography>}
          </SubSection>

          <SubSection title="Damage Formula"
            enabled={!!data.damage} onEnable={enableDamage}
            open={openDamage} onToggle={() => setOpenDamage((v) => !v)}>
            {data.damage
              ? <DamageEditor value={data.damage} onChange={(v) => upd('damage', v)} showElement />
              : <Typography variant="body2" color="text.secondary">Enable to add a damage formula.</Typography>}
          </SubSection>

          {showStats && (
            <SubSection title="Stat Modifiers"
              enabled={readOnly ? undefined : !!data.statModifiers}
              onEnable={readOnly ? undefined : enableStats}
              open={openStats} onToggle={() => setOpenStats((v) => !v)}>
              {readOnly
                ? <StatusStatModReadOnly sm={computedStatMods} />
                : data.statModifiers
                  ? <StatusStatModContent sm={data.statModifiers} onChange={(v) => upd('statModifiers', v)} />
                  : <Typography variant="body2" color="text.secondary">Enable to add stat modifiers.</Typography>}
            </SubSection>
          )}

          {showConds && (
            <SubSection title="Conditions"
              enabled={readOnly ? undefined : !!data.conditions}
              onEnable={readOnly ? undefined : enableConds}
              open={openConds} onToggle={() => setOpenConds((v) => !v)}>
              {readOnly
                ? <ConditionsReadOnly conds={computedConditions} />
                : data.conditions
                  ? <ConditionsContent conds={data.conditions} onChange={(v) => upd('conditions', v)} />
                  : <Typography variant="body2" color="text.secondary">Enable to add condition events.</Typography>}
            </SubSection>
          )}

          <SubSection title="Script"
            enabled={!!data.handler} onEnable={readOnly ? undefined : enableScript}
            open={openScript} onToggle={() => setOpenScript((v) => !v)}>
            <Typography variant="body2" color="text.secondary">Script handlers are not yet implemented in the editor.</Typography>
          </SubSection>

        </Box>
      </Collapse>
    </Paper>
  );
}

// ── Main editor ────────────────────────────────────────────────────────────────

function StatusEditor({ status, initialFileName, isArchived, isExisting, onSave, onArchive, onUnarchive, onDirtyChange, saveRef }) {
  const [data,           setData]           = useState(status);
  const [prefix,         setPrefix]         = useState('status');
  const [fileName,       setFileName]       = useState(initialFileName || computeStatusFilename('status', status.name));
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName);
  const [castHint,       setCastHint]       = useState(false);
  const [openProhibited,   setOpenProhibited]   = useState(false);
  const [openCategories,   setOpenCategories]   = useState(false);
  const [openRestrictions, setOpenRestrictions] = useState(false);

  const libraryIndex = useRecoilValue(libraryIndexState);
  const isDirtyRef = useRef(false);
  const [dupSnack,      setDupSnack]      = useState(null);
  const [mismatchDialog, setMismatchDialog] = useState(null); // null | mismatch[]

  useEffect(() => {
    setData(status);
    setPrefix('status');
    setFileName(initialFileName || computeStatusFilename('status', status.name));
    setFileNameEdited(!!initialFileName);
    setCastHint(false);
    setOpenProhibited(!!status.prohibitedMessage);
    setOpenCategories(status.categories?.length > 0);
    setOpenRestrictions(status.castRestrictions?.length > 0);
    isDirtyRef.current = false;
    setDupSnack(null);
    onDirtyChange?.(false);

    // ── Mismatch check: string keys in meta vs current npcStringKeys ──────────
    const npcStringKeys = libraryIndex.npcStringKeys || [];
    const mismatches = [];

    const checkKey = (field, key, storedText) => {
      if (!key) return;
      const found = npcStringKeys.find((s) => s.key === key);
      if (found && found.message !== storedText)
        mismatches.push({ field, key, storedText, currentText: found.message });
    };

    checkKey('Prohibited Message', status.prohibitedMessageKey, status.prohibitedMessage);

    const chLabelMap = { target: 'Target', source: 'Source', say: 'Say', shout: 'Shout', group: 'Group' };
    for (const [block, label] of [['onApply','OnApply'],['onTick','OnTick'],['onRemove','OnRemove'],['onExpire','OnExpire']]) {
      const msgs = status[block]?.messages;
      if (!Array.isArray(msgs)) continue;
      for (const entry of msgs) {
        if (!entry.key) continue;
        checkKey(`${label} → ${chLabelMap[entry.type]}`, entry.key, entry.text);
      }
    }

    if (mismatches.length) setMismatchDialog(mismatches);
  }, [status, initialFileName]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveMismatches = (useUpdated) => {
    setData((prev) => {
      let next = { ...prev };
      for (const mm of mismatchDialog) {
        if (mm.field === 'Prohibited Message') {
          next = useUpdated
            ? { ...next, prohibitedMessage: mm.currentText }
            : { ...next, prohibitedMessageKey: '' };
        } else {
          const [blockLabel, chLabel] = mm.field.split(' → ');
          const blockKey = { OnApply: 'onApply', OnTick: 'onTick', OnRemove: 'onRemove', OnExpire: 'onExpire' }[blockLabel];
          const chType   = { Target: 'target', Source: 'source', Say: 'say', Shout: 'shout', Group: 'group' }[chLabel];
          if (blockKey && chType) {
            const msgs = (next[blockKey].messages || []).map((entry) =>
              entry.type === chType
                ? (useUpdated ? { ...entry, text: mm.currentText } : { ...entry, key: '' })
                : entry
            );
            next = { ...next, [blockKey]: { ...next[blockKey], messages: msgs } };
          }
        }
      }
      return next;
    });
    setMismatchDialog(null);
  };

  // ── Duplicate detection ───────────────────────────────────────────────────
  const dupStatus = useMemo(() => {
    const name = (data.name || '').trim();
    if (!name) return null;
    const originalName = isExisting ? (status.name || '') : '';
    if (originalName && name.toLowerCase() === originalName.toLowerCase()) return null;
    const activeNames = libraryIndex?.statuses || [];
    if (activeNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'active';
    const archivedNames = libraryIndex?.archivedStatuses || [];
    if (archivedNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'archived';
    return null;
  }, [data.name, libraryIndex, isExisting, status.name]);

  const handleNameBlur = () => { if (dupStatus) setDupSnack(dupStatus); };

  useEffect(() => {
    if (!fileNameEdited) setFileName(computeStatusFilename(prefix, data.name));
  }, [prefix]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirty = useCallback(() => {
    if (!isDirtyRef.current) { isDirtyRef.current = true; onDirtyChange?.(true); }
  }, [onDirtyChange]);

  const updateData = useCallback((updater) => {
    markDirty();
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!fileNameEdited) setFileName(computeStatusFilename(prefix, next.name));
      return next;
    });
  }, [fileNameEdited, prefix, markDirty]);

  const set = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.value }));

  const addCategory    = () => updateData((d) => ({ ...d, categories: [...d.categories, ''] }));
  const setCategory    = (i, v) => updateData((d) => ({ ...d, categories: d.categories.map((c, idx) => idx === i ? v : c) }));
  const removeCategory = (i) => updateData((d) => ({ ...d, categories: d.categories.filter((_, idx) => idx !== i) }));

  const addRestriction    = () => { setCastHint(true); updateData((d) => ({ ...d, castRestrictions: [...d.castRestrictions, { type: 'use-castable', value: '' }] })); };
  const setRestriction    = (i, field, val) => updateData((d) => ({ ...d, castRestrictions: d.castRestrictions.map((r, idx) => idx === i ? { ...r, [field]: val } : r) }));
  const removeRestriction = (i) => updateData((d) => ({ ...d, castRestrictions: d.castRestrictions.filter((_, idx) => idx !== i) }));

  const setEffect = (key) => (val) => updateData((d) => ({ ...d, [key]: val }));

  const computedStatMods   = computeRemoveStatMods(data);
  const computedConditions = computeRemoveConditions(data);

  const handleRegenerate = () => {
    markDirty();
    setFileName(computeStatusFilename(prefix, data.name));
    setFileNameEdited(false);
  };

  const handleSave = () => {
    const saveData = {
      ...data,
      onRemove: { ...data.onRemove, statModifiers: computedStatMods, conditions: computedConditions },
      onExpire: { ...data.onExpire, statModifiers: computedStatMods, conditions: computedConditions },
    };
    onSave(saveData, fileName);
  };

  if (saveRef) saveRef.current = handleSave;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>{data.name || '(unnamed status)'}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {isExisting && !isArchived && (
              <Tooltip title="Archive status">
                <IconButton size="small" onClick={onArchive}><ArchiveIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
            {isExisting && isArchived && (
              <Tooltip title="Unarchive status">
                <IconButton size="small" onClick={onUnarchive}><UnarchiveIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
            <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={handleSave}>Save</Button>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {(() => {
            const computedFileName = computeStatusFilename(prefix, data.name);
            const recyclePending = !!initialFileName && fileName !== computedFileName;
            const willRename     = !!initialFileName && fileName !== initialFileName;
            const fileNameWarn   = recyclePending || willRename;
            const helperText     = willRename
              ? `Saving will create "${fileName}" and archive "${initialFileName}"`
              : recyclePending ? `Computed name: "${computedFileName}" — click ↺ to apply (saves as new file)` : undefined;
            const recycleDisabled = fileName === computedFileName;
            const recycleTooltip  = recycleDisabled
              ? 'Filename is auto-computed'
              : willRename ? 'Reset to computed filename' : 'Apply computed filename';
            return (
              <>
                <TextField
                  size="small" label="Filename" value={fileName}
                  onChange={(e) => { markDirty(); setFileName(e.target.value); setFileNameEdited(true); }}
                  sx={{
                    flex: 1,
                    ...(fileNameWarn && {
                      '& .MuiOutlinedInput-root fieldset': { borderColor: 'warning.main' },
                      '& .MuiInputLabel-root:not(.Mui-focused)': { color: 'warning.main' },
                      '& .MuiFormHelperText-root': { color: 'warning.main' },
                    }),
                  }}
                  inputProps={{ spellCheck: false }}
                  helperText={helperText}
                  FormHelperTextProps={{ sx: { mx: 0 } }}
                />
                <Tooltip title={recycleTooltip}>
                  <span>
                    <IconButton size="small" onClick={handleRegenerate} disabled={recycleDisabled}>
                      <AutorenewIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </>
            );
          })()}
        </Box>
      </Box>

      <Divider sx={{ mb: 1, flexShrink: 0 }} />

      <Box sx={{ flex: 1, overflow: 'auto' }}>

        {/* Top fields */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField label="Prefix" size="small" sx={{ width: 130 }} value={prefix}
                onChange={(e) => setPrefix(e.target.value)} inputProps={{ maxLength: 64, spellCheck: false }} />
              <TextField
                label="Name" required size="small" sx={{
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
              <TextField label="Icon" size="small" sx={{ width: 130 }} value={data.icon}
                onChange={(e) => updateData((d) => ({ ...d, icon: e.target.value.replace(/\D/g, '') }))}
                inputProps={{ inputMode: 'numeric' }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField label="Duration"     size="small" sx={{ width: 120 }} value={data.duration}
                onChange={(e) => updateData((d) => ({ ...d, duration:     e.target.value.replace(/\D/g, '') }))} inputProps={{ inputMode: 'numeric' }} />
              <TextField label="Tick"         size="small" sx={{ width: 100 }} value={data.tick}
                onChange={(e) => updateData((d) => ({ ...d, tick:         e.target.value.replace(/\D/g, '') }))} inputProps={{ inputMode: 'numeric' }} />
              <TextField label="Remove Chance" size="small" sx={{ width: 140 }} value={data.removeChance}
                onChange={(e) => updateData((d) => ({ ...d, removeChance: e.target.value.replace(/\D/g, '') }))} inputProps={{ inputMode: 'numeric' }} />
              <FormControlLabel
                control={<Checkbox size="small" checked={data.removeOnDeath}
                  onChange={(e) => updateData((d) => ({ ...d, removeOnDeath: e.target.checked }))} />}
                label="Remove on Death"
              />
            </Box>
            <CommentField value={data.comment} onChange={set('comment')} />
            <TextField
              label="Applied By" size="small" inputProps={{ readOnly: true }} InputLabelProps={{ shrink: true }}
              value={(libraryIndex.statusCasters?.[data.name?.toLowerCase()] || []).join(', ') || 'No castables apply this status'}
            />
          </Box>
        </Paper>

        {/* Prohibited Message */}
        <Section title="Prohibited Message" open={openProhibited} onToggle={() => setOpenProhibited((v) => !v)}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <StringKeyField
              text={data.prohibitedMessage} stringKey={data.prohibitedMessageKey}
              pickerLabel="Prohibited Message"
              onChange={({ text, key }) => updateData((d) => ({ ...d, prohibitedMessage: text, prohibitedMessageKey: key }))}
            />
          </Box>
        </Section>

        {/* Categories */}
        <Section title="Categories" open={openCategories} onToggle={() => setOpenCategories((v) => !v)}>
          {data.categories.map((cat, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <ConstantAutocomplete indexKey="statusCategories" label="Category" value={cat} sx={{ flex: 1 }}
                onChange={(val) => setCategory(i, val)} inputProps={{ maxLength: 255 }} />
              <IconButton size="small" color="error" onClick={() => removeCategory(i)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button startIcon={<AddIcon />} size="small" onClick={addCategory}>Add Category</Button>
        </Section>

        {/* Cast Restrictions */}
        <Section title="Cast Restrictions" open={openRestrictions} onToggle={() => setOpenRestrictions((v) => !v)}>
          {(castHint || data.castRestrictions.length > 0) && (
            <Alert severity="info" icon={false} sx={{ mb: 1.5, py: 0 }}>
              Cast Restrictions operate off of Categories
            </Alert>
          )}
          {data.castRestrictions.map((r, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Type</InputLabel>
                <Select value={r.type} label="Type"
                  onChange={(e) => setRestriction(i, 'type', e.target.value)}>
                  <MenuItem value="use-castable">Use (Castable Category)</MenuItem>
                  <MenuItem value="use-status">Use (Status Category)</MenuItem>
                  <MenuItem value="receive-castable">Receive (Castable Category)</MenuItem>
                  <MenuItem value="receive-status">Receive (Status Category)</MenuItem>
                </Select>
              </FormControl>
              <ConstantAutocomplete
                indexKey={r.type.includes('castable') ? 'castableCategories' : 'statusCategories'}
                label="Category" value={r.value} sx={{ flex: 1, minWidth: 160 }}
                onChange={(val) => setRestriction(i, 'value', val)}
                inputProps={{ maxLength: 255 }}
              />
              <IconButton size="small" color="error" onClick={() => removeRestriction(i)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button startIcon={<AddIcon />} size="small" onClick={addRestriction}>Add New Restriction</Button>
        </Section>

        {/* Effect accordions */}
        <EffectAccordion title="OnApply"  data={data.onApply}  onChange={setEffect('onApply')}  />
        <EffectAccordion title="OnTick"   data={data.onTick}   onChange={setEffect('onTick')}   />
        <EffectAccordion title="OnRemove" data={data.onRemove} onChange={setEffect('onRemove')}
          readOnly computedStatMods={computedStatMods} computedConditions={computedConditions} />
        <EffectAccordion title="OnExpire" data={data.onExpire} onChange={setEffect('onExpire')}
          readOnly computedStatMods={computedStatMods} computedConditions={computedConditions} />

        <Box sx={{ height: 32 }} />
      </Box>
      <Snackbar
        open={!!dupSnack} autoHideDuration={5000} onClose={() => setDupSnack(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={dupSnack === 'archived' ? 'warning' : 'error'} onClose={() => setDupSnack(null)} sx={{ width: '100%' }}>
          {dupSnack === 'active' ? `"${data.name}" already exists!` : `"${data.name}" exists in archive`}
        </Alert>
      </Snackbar>

      <Dialog open={!!mismatchDialog} maxWidth="sm" fullWidth>
        <DialogTitle>String Key Mismatch</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            The following string keys no longer match the stored message text. This may mean the localization file was updated after this status was last saved.
          </DialogContentText>
          {(mismatchDialog || []).map((mm, i) => (
            <Box key={i} sx={{ mb: 1.5 }}>
              <Typography variant="body2" fontWeight={500}>{mm.field} — <code>{mm.key}</code></Typography>
              <Typography variant="caption" color="text.secondary" display="block">Stored: {mm.storedText}</Typography>
              <Typography variant="caption" color="text.secondary" display="block">Current: {mm.currentText}</Typography>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => resolveMismatches(false)}>Keep as Custom</Button>
          <Button variant="contained" onClick={() => resolveMismatches(true)}>Use Updated Strings</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default StatusEditor;
