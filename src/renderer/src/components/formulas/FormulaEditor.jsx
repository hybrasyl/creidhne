import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box, Button, TextField, Typography, FormControl, InputLabel, Select, MenuItem,
  Snackbar, Alert, Divider,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CommentField from '../shared/CommentField';

const CATEGORIES = ['damage', 'heal', 'conversion', 'shield', 'stat', 'cast_cost', 'general'];

function FormulaEditor({ formula, allFormulas, isExisting, onSave, onDirtyChange, saveRef }) {
  const [data, setData] = useState(formula);
  const isDirtyRef = useRef(false);

  const markDirtyLocal = useCallback(() => {
    if (!isDirtyRef.current) { isDirtyRef.current = true; onDirtyChange?.(true); }
  }, [onDirtyChange]);

  const updateData = useCallback((updater) => {
    markDirtyLocal();
    setData((prev) => typeof updater === 'function' ? updater(prev) : updater);
  }, [markDirtyLocal]);

  const set = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.value }));

  useEffect(() => {
    setData(formula);
    isDirtyRef.current = false;
    setDupSnack(null);
    onDirtyChange?.(false);
  }, [formula]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Duplicate detection ──────────────────────────────────────────────────
  const dupStatus = useMemo(() => {
    const name = (data.name || '').trim();
    if (!name) return null;
    const originalName = isExisting ? (formula.name || '') : '';
    if (originalName && name.toLowerCase() === originalName.toLowerCase()) return null;
    if (allFormulas.some((f) => f.id !== formula.id && f.name.toLowerCase() === name.toLowerCase())) return 'active';
    return null;
  }, [data.name, allFormulas, isExisting, formula]);

  const [dupSnack, setDupSnack] = useState(null);
  const handleNameBlur = () => { if (dupStatus) setDupSnack(dupStatus); };

  const handleSave = () => onSave(data);
  if (saveRef) saveRef.current = handleSave;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, flexShrink: 0 }}>
        <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>
          {isExisting ? data.name || 'Formula' : 'New Formula'}
        </Typography>
        <Button size="small" variant="contained" startIcon={<SaveIcon />} onClick={handleSave}
          disabled={!data.name?.trim() || !!dupStatus}>
          Save
        </Button>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Row 1: Name + Category */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Name" required size="small" sx={{
              flex: 1,
              ...(dupStatus === 'active' && {
                '& .MuiOutlinedInput-root fieldset': { borderColor: 'error.main' },
                '& .MuiInputLabel-root:not(.Mui-focused)': { color: 'error.main' },
                '& .MuiFormHelperText-root': { color: 'error.main' },
              }),
            }}
            error={dupStatus === 'active'}
            helperText={dupStatus === 'active' ? `"${data.name}" already exists` : undefined}
            value={data.name || ''} onChange={set('name')} onBlur={handleNameBlur}
            inputProps={{ maxLength: 128 }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Category</InputLabel>
            <Select value={data.category || 'damage'} label="Category"
              onChange={(e) => updateData((d) => ({ ...d, category: e.target.value }))}>
              {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        {/* Row 2: Description */}
        <CommentField
          label="Description" value={data.description || ''}
          onChange={(e) => updateData((d) => ({ ...d, description: e.target.value }))}
          fullWidth
        />

        {/* Row 3: Formula string */}
        <TextField
          label="Formula" size="small" fullWidth multiline minRows={3}
          value={data.formula || ''}
          onChange={set('formula')}
          inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
          helperText="NCalc expression string — this value is written to castable/status XML"
        />
      </Box>

      <Snackbar open={!!dupSnack} autoHideDuration={5000} onClose={() => setDupSnack(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setDupSnack(null)} sx={{ width: '100%' }}>
          {`"${data.name}" already exists`}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default FormulaEditor;
