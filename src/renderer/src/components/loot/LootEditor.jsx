import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Typography, Divider, TextField, Tooltip, IconButton,
  Paper, Autocomplete, Collapse, Switch, Checkbox, FormControlLabel,
} from '@mui/material';
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

function computeLootFilename(name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '');
  if (!safe) return '';
  return `lootset_${safe}.xml`;
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

// ── Main editor ───────────────────────────────────────────────────────────────
function LootEditor({ loot, initialFileName, isArchived, isExisting, onSave, onArchive, onUnarchive, onDirtyChange, saveRef }) {
  const libraryIndex = useRecoilValue(libraryIndexState);
  const itemNames = libraryIndex.items || [];
  const variantNames = libraryIndex.variantgroups || [];

  const [data, setData] = useState(loot);
  const [fileName, setFileName] = useState(initialFileName || computeLootFilename(loot.name));
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName);
  const [openTable, setOpenTable] = useState(true);
  const [openItems, setOpenItems] = useState(true);

  const isDirtyRef = useRef(false);

  useEffect(() => {
    setData(loot);
    setFileName(initialFileName || computeLootFilename(loot.name));
    setFileNameEdited(!!initialFileName);
    isDirtyRef.current = false;
    onDirtyChange?.(false);
  }, [loot, initialFileName]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirtyLocal = useCallback(() => {
    if (!isDirtyRef.current) { isDirtyRef.current = true; onDirtyChange?.(true); }
  }, [onDirtyChange]);

  const updateData = useCallback((updater) => {
    markDirtyLocal();
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!fileNameEdited) setFileName(computeLootFilename(next.name));
      return next;
    });
  }, [fileNameEdited, markDirtyLocal]);

  const handleRegenerate = () => {
    markDirtyLocal();
    setFileName(computeLootFilename(data.name));
    setFileNameEdited(false);
  };

  if (saveRef) saveRef.current = () => onSave(data, fileName);

  const setTable = (field, val) =>
    updateData((d) => ({ ...d, table: { ...d.table, [field]: val } }));

  const setGold = (field, val) =>
    updateData((d) => ({ ...d, table: { ...d.table, gold: { ...d.table.gold, [field]: val } } }));

  const setXp = (field, val) =>
    updateData((d) => ({ ...d, table: { ...d.table, xp: { ...d.table.xp, [field]: val } } }));

  const setItemsField = (field, val) =>
    updateData((d) => ({ ...d, table: { ...d.table, items: { ...d.table.items, [field]: val } } }));

  const addEntry = () =>
    updateData((d) => ({
      ...d,
      table: {
        ...d.table,
        items: {
          ...d.table.items,
          entries: [...d.table.items.entries, { name: '', variants: [], unique: true, always: true, max: '' }],
        },
      },
    }));

  const setEntry = useCallback((i, field, val) =>
    updateData((d) => ({
      ...d,
      table: {
        ...d.table,
        items: {
          ...d.table.items,
          entries: d.table.items.entries.map((e, idx) => idx === i ? { ...e, [field]: val } : e),
        },
      },
    })), [updateData]);

  const removeEntry = (i) =>
    updateData((d) => ({
      ...d,
      table: {
        ...d.table,
        items: {
          ...d.table.items,
          entries: d.table.items.entries.filter((_, idx) => idx !== i),
        },
      },
    }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>
            {data.name || '(unnamed loot set)'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {isExisting && !isArchived && (
              <Tooltip title="Archive Loot Set">
                <IconButton size="small" onClick={onArchive}><ArchiveIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
            {isExisting && isArchived && (
              <Tooltip title="Unarchive Loot Set">
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
        {/* Basic info */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Name" value={data.name} size="small" required
              onChange={(e) => updateData((d) => ({ ...d, name: e.target.value }))}
              sx={{ flex: 1 }} inputProps={{ maxLength: 255 }}
            />
            <TextField
              label="Prefix" value={data.prefix} size="small"
              onChange={(e) => updateData((d) => ({ ...d, prefix: e.target.value }))}
              sx={{ flex: 1 }} inputProps={{ maxLength: 255 }}
            />
          </Box>
        </Paper>

        {/* ── Table ── */}
        <Section title="Table" open={openTable} onToggle={() => setOpenTable((v) => !v)}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Number of Rolls" value={data.table.rolls} size="small" sx={{ flex: 1 }}
                onChange={(e) => setTable('rolls', e.target.value)}
              />
              <TextField
                label="Chance" value={data.table.chance} size="small" sx={{ flex: 1 }}
                onChange={(e) => setTable('chance', e.target.value)}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Gold Min" value={data.table.gold.min} size="small" sx={{ flex: 1 }}
                onChange={(e) => setGold('min', e.target.value)}
              />
              <TextField
                label="Gold Max" value={data.table.gold.max} size="small" sx={{ flex: 1 }}
                onChange={(e) => setGold('max', e.target.value)}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="XP Min" value={data.table.xp.min} size="small" sx={{ flex: 1 }}
                onChange={(e) => setXp('min', e.target.value)}
              />
              <TextField
                label="XP Max" value={data.table.xp.max} size="small" sx={{ flex: 1 }}
                onChange={(e) => setXp('max', e.target.value)}
              />
            </Box>
          </Box>
        </Section>

        {/* ── Items ── */}
        <Section title="Items" open={openItems} onToggle={() => setOpenItems((v) => !v)}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="Number of Rolls" value={data.table.items.rolls} size="small" sx={{ flex: 1 }}
              onChange={(e) => setItemsField('rolls', e.target.value)}
            />
            <TextField
              label="Chance" value={data.table.items.chance} size="small" sx={{ flex: 1 }}
              onChange={(e) => setItemsField('chance', e.target.value)}
            />
          </Box>

          {data.table.items.entries.map((entry, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                <Autocomplete
                  freeSolo options={itemNames} value={entry.name}
                  onInputChange={(_, val) => setEntry(i, 'name', val)}
                  size="small" sx={{ flex: 1 }}
                  renderInput={(params) => <TextField {...params} label="Item" />}
                />
                <TextField
                  label="Maximum Drop" value={entry.max} size="small" sx={{ width: 120 }}
                  onChange={(e) => setEntry(i, 'max', e.target.value)}
                />
                <IconButton size="small" color="error" onClick={() => removeEntry(i)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Autocomplete
                  multiple options={variantNames} value={entry.variants}
                  onChange={(_, val) => setEntry(i, 'variants', val)}
                  size="small" sx={{ flex: 1 }}
                  renderInput={(params) => <TextField {...params} label="Variants" />}
                />
                <FormControlLabel
                  label="Unique"
                  sx={{ ml: 0.5, mr: 0 }}
                  control={
                    <Checkbox
                      size="small" checked={entry.unique}
                      onChange={(e) => setEntry(i, 'unique', e.target.checked)}
                    />
                  }
                />
                <FormControlLabel
                  label="Always"
                  sx={{ ml: 0.5, mr: 0 }}
                  control={
                    <Checkbox
                      size="small" checked={entry.always}
                      onChange={(e) => setEntry(i, 'always', e.target.checked)}
                    />
                  }
                />
              </Box>
            </Paper>
          ))}

          <Button size="small" startIcon={<AddIcon />} onClick={addEntry}>Add Item</Button>
        </Section>

        <Box sx={{ height: 32 }} />
      </Box>
    </Box>
  );
}

export default LootEditor;
