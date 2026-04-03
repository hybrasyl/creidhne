import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Tooltip, IconButton, Typography } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import { useRecoilValue } from 'recoil';
import { activeLibraryState } from '../../recoil/atoms';
import FormulaPickerDialog from './FormulaPickerDialog';

/**
 * Shared formula row used by HealEditor and DamageEditor when kind === 'Formula'.
 *
 * Renders on a single line:
 *   [Pick] [Name (readonly)] [Formula (readonly)] [Clear]
 *
 * If the formula name is not in the library (or there is no name), shows warning
 * styling and action buttons: "+ Add to index" / "Replace from index".
 *
 * Props:
 *   formulaName — current formula name (may be empty)
 *   formula     — current formula string
 *   category    — picker pre-filter ('heal' | 'damage')
 *   onSelect    — ({ name, formula }) => void
 *   onClear     — () => void
 */
function FormulaRow({ formulaName, formula, category, onSelect, onClear }) {
  const activeLibrary = useRecoilValue(activeLibraryState);
  const [pickerOpen, setPickerOpen]         = useState(false);
  const [formulas, setFormulas]             = useState([]);
  const [formulasLoaded, setFormulasLoaded] = useState(false);
  const [addingToIndex, setAddingToIndex]   = useState(false);
  const [newName, setNewName]               = useState('');
  const [saving, setSaving]                 = useState(false);

  useEffect(() => {
    if (!activeLibrary) return;
    setFormulasLoaded(false);
    window.electronAPI.loadFormulas(activeLibrary)
      .then((data) => { setFormulas(data.formulas || []); setFormulasLoaded(true); })
      .catch(() => setFormulasLoaded(true));
  }, [activeLibrary]);

  const matched     = formulasLoaded && formulaName ? formulas.find((f) => f.name === formulaName) : null;
  const isCustom    = formulasLoaded && !formulaName && !!formula;
  const notInIndex  = formulasLoaded && !!formulaName && !matched;
  const hasIssue    = isCustom || notInIndex;

  const displayName = formulaName || (formula ? 'custom' : '');
  const warnSx = hasIssue ? {
    '& .MuiOutlinedInput-root fieldset':       { borderColor: 'warning.main' },
    '& .MuiInputLabel-root:not(.Mui-focused)': { color: 'warning.main' },
  } : {};

  const handleFormulaSelect = (f) => {
    onSelect(f);
    setAddingToIndex(false);
  };

  const handleAddToIndex = async () => {
    const name = newName.trim();
    if (!name || !activeLibrary) return;
    setSaving(true);
    try {
      const data = await window.electronAPI.loadFormulas(activeLibrary);
      const entry = { id: crypto.randomUUID(), name, description: '', category: category || 'general', formula };
      const updated = { ...data, formulas: [...data.formulas, entry] };
      await window.electronAPI.saveFormulas(activeLibrary, updated);
      setFormulas(updated.formulas);
      onSelect({ name, formula });
      setAddingToIndex(false);
      setNewName('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1, minWidth: 0 }}>
      {/* Main row */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <Button size="small" variant="outlined" onClick={() => setPickerOpen(true)} sx={{ flexShrink: 0, height: 40 }}>
          Pick
        </Button>
        <TextField
          label="Formula Name" size="small" sx={{ width: 180, ...warnSx }}
          value={displayName} inputProps={{ readOnly: true, tabIndex: -1 }}
        />
        <TextField
          label="Formula" size="small" sx={{ flex: 1, minWidth: 0 }}
          value={formula || ''} inputProps={{ readOnly: true, tabIndex: -1, style: { fontFamily: 'monospace' } }}
        />
        {(formulaName || formula) && (
          <Tooltip title="Clear formula">
            <IconButton size="small" onClick={onClear} sx={{ flexShrink: 0 }}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Issue actions */}
      {hasIssue && !addingToIndex && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button size="small" color="warning" onClick={() => { setAddingToIndex(true); setNewName(formulaName || ''); }}>
            + Add to index
          </Button>
          <Button size="small" color="warning" onClick={() => setPickerOpen(true)}>
            Replace from index
          </Button>
          <Typography variant="caption" color="warning.main">
            {notInIndex ? 'Not in library' : 'No library entry'}
          </Typography>
        </Box>
      )}

      {/* Add-to-index inline form */}
      {addingToIndex && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            label="Name" size="small" sx={{ flex: 1 }} autoFocus
            value={newName} onChange={(e) => setNewName(e.target.value)}
            inputProps={{ maxLength: 128 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddToIndex(); if (e.key === 'Escape') { setAddingToIndex(false); setNewName(''); } }}
          />
          <Button size="small" variant="contained" disabled={!newName.trim() || saving} onClick={handleAddToIndex}>
            Save to Library
          </Button>
          <Button size="small" onClick={() => { setAddingToIndex(false); setNewName(''); }}>
            Cancel
          </Button>
        </Box>
      )}

      <FormulaPickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)}
        onSelect={handleFormulaSelect} category={category} />
    </Box>
  );
}

export default FormulaRow;
