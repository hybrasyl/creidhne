import React, { useState, useEffect, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import {
  Box, List, ListItem, ListItemButton, ListItemText, Typography, Divider,
  Button, Tooltip, TextField, InputAdornment, IconButton, Snackbar, Alert, CircularProgress,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { activeLibraryState } from '../recoil/atoms';
import FormulaEditor from '../components/formulas/FormulaEditor';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';

const CATEGORY_COLORS = {
  damage: 'error', heal: 'success', stat: 'info', cast_cost: 'warning', general: 'default',
};

const DEFAULT_FORMULA = { id: null, name: '', description: '', category: 'damage', formula: '' };

// ── List panel ────────────────────────────────────────────────────────────────
function FormulaListPanel({ formulas, selectedId, onSelect, onNew, onImport, onDelete }) {
  const [search, setSearch] = React.useState('');
  const filtered = search.trim()
    ? formulas.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : formulas;

  return (
    <Box sx={{ width: 240, flexShrink: 0, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">Formulas</Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Import from Lua">
            <IconButton size="small" onClick={onImport}>
              <FileUploadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="New Formula">
            <Button size="small" startIcon={<AddIcon />} onClick={onNew}>New</Button>
          </Tooltip>
        </Box>
      </Box>
      <Box sx={{ px: 1, pb: 1 }}>
        <TextField
          size="small" fullWidth placeholder="Filter..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {formulas.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No formulas. Import a Lua file or create one manually.
          </Typography>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No matches.</Typography>
        ) : (
          <List dense disablePadding>
            {filtered.map((f) => (
              <ListItem key={f.id} disablePadding
                secondaryAction={
                  selectedId === f.id
                    ? <Tooltip title="Delete"><IconButton size="small" edge="end" onClick={() => onDelete(f.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                    : null
                }>
                <ListItemButton selected={selectedId === f.id} onClick={() => onSelect(f.id)}>
                  <ListItemText
                    primary={f.name}
                    primaryTypographyProps={{ noWrap: true, variant: 'body2' }}
                    secondary={
                      <Chip label={f.category || 'damage'} size="small"
                        color={CATEGORY_COLORS[f.category] || 'default'}
                        sx={{ height: 16, fontSize: '0.65rem', mt: 0.25 }} />
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function FormulasPage() {
  const activeLibrary = useRecoilValue(activeLibraryState);
  const [formulasData, setFormulasData] = useState({ globals: {}, templates: [], formulas: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [editingFormula, setEditingFormula] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState(null);

  const { markDirty, markClean, saveRef, guard, dialogOpen,
    handleDialogSave, handleDialogDiscard, handleDialogCancel } = useUnsavedGuard('Formula');

  const loadData = async (library) => {
    if (!library) { setFormulasData({ globals: {}, templates: [], formulas: [] }); return; }
    setLoading(true);
    try {
      const data = await window.electronAPI.loadFormulas(library);
      setFormulasData(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedId(null);
    setEditingFormula(null);
    loadData(activeLibrary);
  }, [activeLibrary]); // eslint-disable-line react-hooks/exhaustive-deps

  const doNew = () => {
    setSelectedId(null);
    setEditingFormula({ ...DEFAULT_FORMULA, id: crypto.randomUUID() });
  };
  const handleNew = () => guard(doNew);

  const doSelect = (id) => {
    const f = formulasData.formulas.find((f) => f.id === id);
    if (!f) return;
    setSelectedId(id);
    setEditingFormula({ ...f });
  };
  const handleSelect = (id) => guard(() => doSelect(id));

  const handleDelete = (id) => {
    guard(() => {
      const next = { ...formulasData, formulas: formulasData.formulas.filter((f) => f.id !== id) };
      setFormulasData(next);
      setSelectedId(null);
      setEditingFormula(null);
      markClean();
      window.electronAPI.saveFormulas(activeLibrary, next).catch((err) => {
        setSnackbar({ message: `Failed to delete: ${err?.message ?? 'Unknown error'}`, severity: 'error' });
      });
    });
  };

  const handleSave = async (data) => {
    try {
      const isNew = !formulasData.formulas.some((f) => f.id === data.id);
      const nextFormulas = isNew
        ? [...formulasData.formulas, data]
        : formulasData.formulas.map((f) => f.id === data.id ? data : f);
      const next = { ...formulasData, formulas: nextFormulas };
      await window.electronAPI.saveFormulas(activeLibrary, next);
      setFormulasData(next);
      setEditingFormula(data);
      setSelectedId(data.id);
      markClean();
      setSnackbar({ message: 'Saved.', severity: 'success' });
    } catch (err) {
      setSnackbar({ message: `Failed to save: ${err?.message ?? 'Unknown error'}`, severity: 'error' });
    }
  };

  const doImport = async () => {
    if (!activeLibrary) return;
    try {
      const result = await window.electronAPI.importFormulas(activeLibrary);
      if (!result) return; // user cancelled
      await window.electronAPI.saveFormulas(activeLibrary, result.data);
      setFormulasData(result.data);
      setSelectedId(null);
      setEditingFormula(null);
      markClean();
      const parts = [];
      if (result.updated)          parts.push(`${result.updated} updated`);
      if (result.added)            parts.push(`${result.added} added`);
      if (result.duplicates?.length) parts.push(`${result.duplicates.length} duplicate string(s) flagged`);
      setSnackbar({
        message: `Import complete: ${parts.join(', ') || 'no changes'}.`,
        severity: result.duplicates?.length ? 'warning' : 'success',
      });
    } catch (err) {
      setSnackbar({ message: `Import failed: ${err?.message ?? 'Unknown error'}`, severity: 'error' });
    }
  };
  const handleImport = () => guard(doImport);

  const handleDirtyChange = useCallback((dirty) => { dirty ? markDirty() : markClean(); }, [markDirty, markClean]);

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <FormulaListPanel
        formulas={formulasData.formulas}
        selectedId={selectedId}
        onSelect={handleSelect}
        onNew={handleNew}
        onImport={handleImport}
        onDelete={handleDelete}
      />
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress size={64} thickness={4} color="info" disableShrink />
          </Box>
        ) : editingFormula ? (
          <FormulaEditor
            formula={editingFormula}
            allFormulas={formulasData.formulas}
            isExisting={formulasData.formulas.some((f) => f.id === editingFormula.id)}
            onSave={handleSave}
            onDirtyChange={handleDirtyChange}
            saveRef={saveRef}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body1" color="text.secondary">
              Select a formula or create a new one.
            </Typography>
          </Box>
        )}
      </Box>

      <UnsavedChangesDialog
        open={dialogOpen} label="Formula"
        onSave={handleDialogSave} onDiscard={handleDialogDiscard} onCancel={handleDialogCancel}
      />
      <Snackbar open={!!snackbar} autoHideDuration={6000} onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar?.severity ?? 'info'} onClose={() => setSnackbar(null)} sx={{ width: '100%' }}>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default FormulasPage;
