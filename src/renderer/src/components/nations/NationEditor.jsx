import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Typography, Divider, TextField, Tooltip, IconButton,
  Paper, Autocomplete, Collapse, Switch,
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

function computeNationFilename(name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '');
  if (!safe) return '';
  return `nation_${safe}.xml`;
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

// ── Map autocomplete ──────────────────────────────────────────────────────────
function MapPicker({ label, value, onChange, sx }) {
  const libraryIndex = useRecoilValue(libraryIndexState);
  const mapNames = libraryIndex.maps || [];
  return (
    <Autocomplete
      freeSolo options={mapNames} value={value}
      onInputChange={(_, val) => onChange(val)}
      size="small" sx={sx}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────
function NationEditor({ nation, initialFileName, isArchived, isExisting, onSave, onArchive, onUnarchive }) {
  const [data, setData] = useState(nation);
  const [fileName, setFileName] = useState(initialFileName || computeNationFilename(nation.name));
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName);

  const [openSpawnPoints, setOpenSpawnPoints] = useState(nation.spawnPoints.length > 0);
  const [openTerritory, setOpenTerritory] = useState(nation.territory !== null);

  useEffect(() => {
    setData(nation);
    setFileName(initialFileName || computeNationFilename(nation.name));
    setFileNameEdited(!!initialFileName);
    setOpenSpawnPoints(nation.spawnPoints.length > 0);
    setOpenTerritory(nation.territory !== null);
  }, [nation, initialFileName]);

  const updateData = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!fileNameEdited) setFileName(computeNationFilename(next.name));
      return next;
    });
  }, [fileNameEdited]);

  const set = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.value }));

  const handleRegenerate = () => {
    setFileName(computeNationFilename(data.name));
    setFileNameEdited(false);
  };

  // ── Spawn points ──────────────────────────────────────────────────────────
  const addSpawnPoint = () =>
    updateData((d) => ({ ...d, spawnPoints: [...d.spawnPoints, { mapName: '', x: '', y: '' }] }));
  const setSpawnPoint = (i, field, val) =>
    updateData((d) => ({
      ...d,
      spawnPoints: d.spawnPoints.map((sp, idx) => idx === i ? { ...sp, [field]: val } : sp),
    }));
  const removeSpawnPoint = (i) =>
    updateData((d) => ({ ...d, spawnPoints: d.spawnPoints.filter((_, idx) => idx !== i) }));

  // ── Territory ─────────────────────────────────────────────────────────────
  const enableTerritory = (checked) => {
    updateData((d) => ({ ...d, territory: checked ? [] : null }));
    setOpenTerritory(checked);
  };
  const addTerritoryMap = () =>
    updateData((d) => ({ ...d, territory: [...(d.territory || []), ''] }));
  const setTerritoryMap = (i, val) =>
    updateData((d) => ({
      ...d,
      territory: d.territory.map((m, idx) => idx === i ? val : m),
    }));
  const removeTerritoryMap = (i) =>
    updateData((d) => ({ ...d, territory: d.territory.filter((_, idx) => idx !== i) }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>
            {data.name || '(unnamed nation)'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {isExisting && !isArchived && (
              <Tooltip title="Archive Nation">
                <IconButton size="small" onClick={onArchive}><ArchiveIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
            {isExisting && isArchived && (
              <Tooltip title="Unarchive Nation">
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
            onChange={(e) => { setFileName(e.target.value); setFileNameEdited(true); }}
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Name" value={data.name} onChange={set('name')}
              size="small" required inputProps={{ maxLength: 255 }}
            />
            <TextField
              label="Description" value={data.description} onChange={set('description')}
              size="small" multiline minRows={2} inputProps={{ maxLength: 1000 }}
            />
          </Box>
        </Paper>

        {/* ── Spawn Points ── */}
        <Section title="Spawn Points" open={openSpawnPoints} onToggle={() => setOpenSpawnPoints((v) => !v)}>
          {data.spawnPoints.map((sp, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <MapPicker
                label="Map" value={sp.mapName} sx={{ flex: 1 }}
                onChange={(val) => setSpawnPoint(i, 'mapName', val)}
              />
              <TextField
                label="X" value={sp.x}
                onChange={(e) => setSpawnPoint(i, 'x', e.target.value)}
                size="small" sx={{ width: 80 }} inputProps={{ maxLength: 10 }}
              />
              <TextField
                label="Y" value={sp.y}
                onChange={(e) => setSpawnPoint(i, 'y', e.target.value)}
                size="small" sx={{ width: 80 }} inputProps={{ maxLength: 10 }}
              />
              <IconButton size="small" color="error" onClick={() => removeSpawnPoint(i)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addSpawnPoint}>Add Spawn Point</Button>
        </Section>

        {/* ── Territory ── */}
        <Section
          title="Territory"
          open={openTerritory}
          onToggle={() => setOpenTerritory((v) => !v)}
          enabled={data.territory !== null}
          onEnable={enableTerritory}
        >
          {data.territory !== null && (
            <>
              {data.territory.map((m, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                  <MapPicker
                    label="Map" value={m} sx={{ flex: 1 }}
                    onChange={(val) => setTerritoryMap(i, val)}
                  />
                  <IconButton size="small" color="error" onClick={() => removeTerritoryMap(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={addTerritoryMap}>Add Map</Button>
            </>
          )}
        </Section>

        <Box sx={{ height: 32 }} />
      </Box>
    </Box>
  );
}

export default NationEditor;
