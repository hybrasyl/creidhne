import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, IconButton, Tooltip, Typography, MenuItem, Select, FormControl,
  Autocomplete, TextField, ToggleButton, ToggleButtonGroup, Alert, CircularProgress,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { useRecoilState, useRecoilValue } from 'recoil';
import {
  referencePanelOpenState, referenceSelectionState,
  libraryIndexState, activeLibraryState,
} from '../../recoil/atoms';
import { ReferenceViewDispatcher } from './referenceViews';

// Type key → subdir/index field name (matches referenceLoader.js SUPPORTED_REFERENCE_TYPES)
const TYPE_OPTIONS = [
  { value: 'castables',            label: 'Castable' },
  { value: 'statuses',             label: 'Status' },
  { value: 'items',                label: 'Item' },
  { value: 'creatures',            label: 'Creature' },
  { value: 'npcs',                 label: 'NPC' },
  { value: 'nations',              label: 'Nation' },
  { value: 'lootsets',             label: 'Loot set' },
  { value: 'recipes',              label: 'Recipe' },
  { value: 'variantgroups',        label: 'Variant group' },
  { value: 'localizations',        label: 'Localization' },
  { value: 'elementtables',        label: 'Element table' },
  { value: 'creaturebehaviorsets', label: 'Behavior set' },
  { value: 'spawngroups',          label: 'Spawn group' },
];

const PANEL_WIDTH = 360;
const RAIL_WIDTH = 36;

function ClosedRail({ onOpen }) {
  return (
    <Box
      sx={{
        width: RAIL_WIDTH,
        flexShrink: 0,
        borderLeft: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 1,
      }}
    >
      <Tooltip title="Open reference panel" placement="left">
        <IconButton size="small" onClick={onOpen}>
          <MenuBookIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default function ReferencePanel() {
  const [open, setOpen] = useRecoilState(referencePanelOpenState);
  const [selection, setSelection] = useRecoilState(referenceSelectionState);
  const libraryIndex = useRecoilValue(libraryIndexState);
  const activeLibrary = useRecoilValue(activeLibraryState);

  const [type, setType] = useState(selection?.type || 'castables');
  const [name, setName] = useState(selection?.name || null);
  const [showXml, setShowXml] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { parsed, raw, path } | { error }

  const names = useMemo(() => {
    const list = libraryIndex?.[type];
    return Array.isArray(list) ? list : [];
  }, [libraryIndex, type]);

  // Sync local picker state with external selection changes (future: deep-link)
  useEffect(() => {
    if (selection?.type && selection.type !== type) setType(selection.type);
    if (selection?.name && selection.name !== name) setName(selection.name);
  }, [selection, type, name]);

  // Load whenever (library, type, name) changes and we have all three
  useEffect(() => {
    if (!open || !activeLibrary || !type || !name) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    window.electronAPI.loadReference(activeLibrary, type, name)
      .then((r) => { if (!cancelled) setResult(r); })
      .catch((err) => { if (!cancelled) setResult({ ok: false, error: err?.message || String(err) }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, activeLibrary, type, name]);

  if (!open) return <ClosedRail onOpen={() => setOpen(true)} />;

  const handleTypeChange = (e) => {
    const next = e.target.value;
    setType(next);
    setName(null);
    setResult(null);
    setSelection({ type: next, name: null });
  };

  const handleNameChange = (_, next) => {
    setName(next);
    setSelection({ type, name: next });
  };

  return (
    <Paper
      square
      elevation={0}
      sx={{
        width: PANEL_WIDTH,
        flexShrink: 0,
        borderLeft: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <MenuBookIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
        <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase' }}>
          Reference
        </Typography>
        <Tooltip title="Close reference panel">
          <IconButton size="small" onClick={() => setOpen(false)}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
        <FormControl size="small" fullWidth>
          <Select value={type} onChange={handleTypeChange} disabled={!activeLibrary}>
            {TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Autocomplete
          size="small"
          options={names}
          value={name}
          onChange={handleNameChange}
          disabled={!activeLibrary || names.length === 0}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={
                !activeLibrary
                  ? 'No active library'
                  : names.length === 0
                    ? 'Nothing to reference — rebuild index?'
                    : `Search ${TYPE_OPTIONS.find((o) => o.value === type)?.label.toLowerCase()}…`
              }
            />
          )}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={showXml ? 'xml' : 'summary'}
          onChange={(_, v) => { if (v) setShowXml(v === 'xml'); }}
          sx={{ alignSelf: 'flex-start' }}
        >
          <ToggleButton value="summary">Summary</ToggleButton>
          <ToggleButton value="xml">XML</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5, minHeight: 0 }}>
        {!activeLibrary && (
          <Alert severity="info" variant="outlined">Select an active library to use the reference panel.</Alert>
        )}
        {activeLibrary && !name && (
          <Typography variant="body2" color="text.secondary">
            Pick a type and entity to view.
          </Typography>
        )}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {!loading && result && !result.ok && (
          <Alert severity="warning">{result.error}</Alert>
        )}
        {!loading && result?.ok && (
          <ReferenceViewDispatcher
            type={type}
            parsed={result.parsed}
            raw={result.raw}
            showXml={showXml}
          />
        )}
      </Box>
    </Paper>
  );
}
