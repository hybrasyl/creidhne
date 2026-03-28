import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Typography, Divider, TextField, Tooltip, IconButton,
  Paper, Collapse, Drawer, List, ListItem, ListItemText,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import CommentField from '../shared/CommentField';

// TODO: Fill in variable descriptions for each $ variable
const KNOWN_VARIABLES = [
  { name: '$COINS',     desc: '(TODO)' },
  { name: '$DESC',      desc: '(TODO)' },
  { name: '$FEE',       desc: '(TODO)' },
  { name: '$GOLD',      desc: '(TODO)' },
  { name: '$ITEM',      desc: '(TODO)' },
  { name: '$LEVEL',     desc: '(TODO)' },
  { name: '$NAME',      desc: '(TODO)' },
  { name: '$PREREQ',    desc: '(TODO)' },
  { name: '$QUANTITY',  desc: '(TODO)' },
  { name: '$REF',       desc: '(TODO)' },
  { name: '$REPAIRAMT', desc: '(TODO)' },
  { name: '$REQS',      desc: '(TODO)' },
  { name: '$SENDER',    desc: '(TODO)' },
  { name: '$STATS',     desc: '(TODO)' },
];

function computeFileName(locale) {
  const safe = (locale || '').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return safe ? `${safe}.xml` : '';
}

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

// ── Key + Message row ─────────────────────────────────────────────────────────
function StringRow({ keyVal, message, onChangeKey, onChangeMessage, onDelete }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
      <TextField
        label="Key" value={keyVal} onChange={(e) => onChangeKey(e.target.value)}
        size="small" sx={{ width: 200 }} inputProps={{ spellCheck: false }}
      />
      <TextField
        label="Message" value={message} onChange={(e) => onChangeMessage(e.target.value)}
        size="small" sx={{ flex: 1 }} multiline maxRows={3}
      />
      <IconButton size="small" color="error" onClick={onDelete} sx={{ mt: 0.5 }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

// ── Call + Response row ───────────────────────────────────────────────────────
function ResponseRow({ call, response, onChangeCall, onChangeResponse, onDelete }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
      <TextField
        label="Call" value={call} onChange={(e) => onChangeCall(e.target.value)}
        size="small" sx={{ width: 220 }}
      />
      <TextField
        label="Response" value={response} onChange={(e) => onChangeResponse(e.target.value)}
        size="small" sx={{ flex: 1 }} multiline maxRows={3}
      />
      <IconButton size="small" color="error" onClick={onDelete} sx={{ mt: 0.5 }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────
function LocalizationEditor({ localization, initialFileName, isArchived, isExisting, onSave, onArchive, onUnarchive, onDirtyChange, saveRef }) {
  const [data, setData] = useState(localization);
  const [fileName, setFileName] = useState(initialFileName || computeFileName(localization.locale));
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName);
  const [varsOpen, setVarsOpen] = useState(false);
  const [openCommon, setOpenCommon] = useState(localization.common.length > 0);
  const [openMerchant, setOpenMerchant] = useState(localization.merchant.length > 0);
  const [openMonster, setOpenMonster] = useState(localization.monsterSpeak.length > 0);
  const [openNpc, setOpenNpc] = useState(localization.npcResponses.length > 0);

  const isDirtyRef = useRef(false);

  useEffect(() => {
    setData(localization);
    setFileName(initialFileName || computeFileName(localization.locale));
    setFileNameEdited(!!initialFileName);
    setOpenCommon(localization.common.length > 0);
    setOpenMerchant(localization.merchant.length > 0);
    setOpenMonster(localization.monsterSpeak.length > 0);
    setOpenNpc(localization.npcResponses.length > 0);
    isDirtyRef.current = false;
    onDirtyChange?.(false);
  }, [localization, initialFileName]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirtyLocal = useCallback(() => {
    if (!isDirtyRef.current) { isDirtyRef.current = true; onDirtyChange?.(true); }
  }, [onDirtyChange]);

  const update = useCallback((updater) => {
    markDirtyLocal();
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!fileNameEdited) setFileName(computeFileName(next.locale));
      return next;
    });
  }, [fileNameEdited, markDirtyLocal]);

  if (saveRef) saveRef.current = () => onSave(data, fileName);

  // ── Common ────────────────────────────────────────────────────────────────
  const addCommon    = () => update((d) => ({ ...d, common: [...d.common, { key: '', message: '' }] }));
  const setCommon    = (i, field, val) =>
    update((d) => ({ ...d, common: d.common.map((s, idx) => idx === i ? { ...s, [field]: val } : s) }));
  const removeCommon = (i) => update((d) => ({ ...d, common: d.common.filter((_, idx) => idx !== i) }));

  // ── Merchant ──────────────────────────────────────────────────────────────
  const addMerchant    = () => update((d) => ({ ...d, merchant: [...d.merchant, { key: '', message: '' }] }));
  const setMerchant    = (i, field, val) =>
    update((d) => ({ ...d, merchant: d.merchant.map((s, idx) => idx === i ? { ...s, [field]: val } : s) }));
  const removeMerchant = (i) => update((d) => ({ ...d, merchant: d.merchant.filter((_, idx) => idx !== i) }));

  // ── MonsterSpeak ──────────────────────────────────────────────────────────
  const addMonster    = () => update((d) => ({ ...d, monsterSpeak: [...d.monsterSpeak, { key: '', message: '' }] }));
  const setMonster    = (i, field, val) =>
    update((d) => ({ ...d, monsterSpeak: d.monsterSpeak.map((s, idx) => idx === i ? { ...s, [field]: val } : s) }));
  const removeMonster = (i) => update((d) => ({ ...d, monsterSpeak: d.monsterSpeak.filter((_, idx) => idx !== i) }));

  // ── NpcResponses ──────────────────────────────────────────────────────────
  const addNpc    = () => update((d) => ({ ...d, npcResponses: [...d.npcResponses, { call: '', response: '' }] }));
  const setNpc    = (i, field, val) =>
    update((d) => ({ ...d, npcResponses: d.npcResponses.map((r, idx) => idx === i ? { ...r, [field]: val } : r) }));
  const removeNpc = (i) => update((d) => ({ ...d, npcResponses: d.npcResponses.filter((_, idx) => idx !== i) }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, pb: 1, flexShrink: 0 }}>
        <TextField
          label="Locale Name" value={data.locale}
          onChange={(e) => update((d) => ({ ...d, locale: e.target.value }))}
          size="small" sx={{ width: 180 }} inputProps={{ spellCheck: false }}
          helperText="Format: en_us"
        />
        <TextField
          size="small" label="Filename" value={fileName}
          onChange={(e) => { markDirtyLocal(); setFileName(e.target.value); setFileNameEdited(true); }}
          sx={{ flex: 1 }} inputProps={{ spellCheck: false }}
        />
        <Tooltip title="View $ variables">
          <Button size="small" startIcon={<InfoOutlinedIcon />} onClick={() => setVarsOpen(true)} sx={{ mt: 0.5 }}>
            Variables
          </Button>
        </Tooltip>
        {isExisting && !isArchived && (
          <Tooltip title="Archive localization">
            <IconButton size="small" onClick={onArchive} sx={{ mt: 0.5 }}><ArchiveIcon fontSize="small" /></IconButton>
          </Tooltip>
        )}
        {isExisting && isArchived && (
          <Tooltip title="Unarchive localization">
            <IconButton size="small" onClick={onUnarchive} sx={{ mt: 0.5 }}><UnarchiveIcon fontSize="small" /></IconButton>
          </Tooltip>
        )}
        <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={() => onSave(data, fileName)} sx={{ mt: 0.5 }}>
          Save
        </Button>
      </Box>

      <CommentField value={data.comment} onChange={(e) => update((d) => ({ ...d, comment: e.target.value }))} sx={{ mb: 1, flexShrink: 0 }} />

      <Divider sx={{ mb: 1, flexShrink: 0 }} />

      {/* ── Form ── */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Section title="Common" open={openCommon} onToggle={() => setOpenCommon((v) => !v)}>
          {data.common.map((s, i) => (
            <StringRow
              key={i}
              keyVal={s.key} message={s.message}
              onChangeKey={(v) => setCommon(i, 'key', v)}
              onChangeMessage={(v) => setCommon(i, 'message', v)}
              onDelete={() => removeCommon(i)}
            />
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addCommon}>Add Common String</Button>
        </Section>

        <Section title="Merchant" open={openMerchant} onToggle={() => setOpenMerchant((v) => !v)}>
          {data.merchant.map((s, i) => (
            <StringRow
              key={i}
              keyVal={s.key} message={s.message}
              onChangeKey={(v) => setMerchant(i, 'key', v)}
              onChangeMessage={(v) => setMerchant(i, 'message', v)}
              onDelete={() => removeMerchant(i)}
            />
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addMerchant}>Add Merchant String</Button>
        </Section>

        <Section title="Monster" open={openMonster} onToggle={() => setOpenMonster((v) => !v)}>
          {data.monsterSpeak.map((s, i) => (
            <StringRow
              key={i}
              keyVal={s.key} message={s.message}
              onChangeKey={(v) => setMonster(i, 'key', v)}
              onChangeMessage={(v) => setMonster(i, 'message', v)}
              onDelete={() => removeMonster(i)}
            />
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addMonster}>Add Monster String</Button>
        </Section>

        <Section title="NPC Response" open={openNpc} onToggle={() => setOpenNpc((v) => !v)}>
          {data.npcResponses.map((r, i) => (
            <ResponseRow
              key={i}
              call={r.call} response={r.response}
              onChangeCall={(v) => setNpc(i, 'call', v)}
              onChangeResponse={(v) => setNpc(i, 'response', v)}
              onDelete={() => removeNpc(i)}
            />
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addNpc}>Add NPC Response</Button>
        </Section>

        <Box sx={{ height: 32 }} />
      </Box>

      {/* ── Variables Drawer ── */}
      <Drawer anchor="right" open={varsOpen} onClose={() => setVarsOpen(false)}>
        <Box sx={{ width: 300, p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" sx={{ flex: 1 }}>$ Variables</Typography>
            <IconButton size="small" onClick={() => setVarsOpen(false)}><CloseIcon fontSize="small" /></IconButton>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            TODO: fill in variable descriptions
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <List dense disablePadding>
            {KNOWN_VARIABLES.map((v) => (
              <ListItem key={v.name} disablePadding sx={{ py: 0.25 }}>
                <ListItemText
                  primary={v.name}
                  secondary={v.desc}
                  primaryTypographyProps={{ variant: 'body2', fontFamily: 'monospace' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </Box>
  );
}

export default LocalizationEditor;
