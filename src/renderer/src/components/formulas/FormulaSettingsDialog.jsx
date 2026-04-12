import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Tabs, Tab, Box, TextField, Typography, Divider,
  FormControl, InputLabel, Select, MenuItem, Tooltip,
  Accordion, AccordionSummary, AccordionDetails, IconButton,
  InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import {
  BUDGET_MODES, BUDGET_APPLICATIONS, DEFAULT_BUDGET_MODIFIER,
  COEFFICIENT_GROUPS, DEFAULT_SETTINGS,
  FORMULA_CONSTANTS, FORMULA_CONSTANT_KEYS,
} from '../../data/formulaConstants';
import BUILTIN_PATTERNS from '../../data/formulaPatterns';

// ── Helpers ──────────────────────────────────────────────────────────────────
function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function mergeSettings(saved) {
  return {
    budgetModifier: { ...DEFAULT_BUDGET_MODIFIER, ...saved?.budgetModifier },
    customVariables: { ...(saved?.customVariables || {}) },
    coefficients: { ...(saved?.coefficients || {}) },
    defaultPatternId: saved?.defaultPatternId ?? null,
  };
}

const MODE_LABELS = { none: 'None', linearStep: 'Linear Step', binary: 'Binary', steppedTiers: 'Stepped Tiers' };
const APP_LABELS  = { additive: 'Additive', multiplicative: 'Multiplicative' };

// ── Budget Modifier Tab ──────────────────────────────────────────────────────
function BudgetModifierTab({ settings, onChange }) {
  const bm = settings.budgetModifier;
  const vars = settings.customVariables;

  const setBM = (field, value) => {
    onChange({ ...settings, budgetModifier: { ...bm, [field]: value } });
  };
  const setDimension = (dim, field, value) => {
    setBM(dim, { ...bm[dim], [field]: value });
  };
  const setVar = (key, value) => {
    onChange({ ...settings, customVariables: { ...vars, [key]: value } });
  };
  const deleteVar = (key) => {
    const next = { ...vars };
    delete next[key];
    onChange({ ...settings, customVariables: next });
  };

  // Add new custom variable
  const [newVarKey, setNewVarKey] = useState('');
  const handleAddVar = () => {
    const k = newVarKey.trim();
    if (!k || vars.hasOwnProperty(k)) return;
    onChange({ ...settings, customVariables: { ...vars, [k]: '' } });
    setNewVarKey('');
  };

  return (
    <Box sx={{ p: 2, overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Budget Modifier */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>Budget Modifier</Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Mode</InputLabel>
            <Select value={bm.mode} label="Mode" onChange={(e) => setBM('mode', e.target.value)}>
              {BUDGET_MODES.map((m) => <MenuItem key={m} value={m}>{MODE_LABELS[m]}</MenuItem>)}
            </Select>
          </FormControl>
          {bm.mode === 'linearStep' && (
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Application</InputLabel>
              <Select value={bm.application} label="Application" onChange={(e) => setBM('application', e.target.value)}>
                {BUDGET_APPLICATIONS.map((a) => <MenuItem key={a} value={a}>{APP_LABELS[a]}</MenuItem>)}
              </Select>
            </FormControl>
          )}
        </Box>

        {bm.mode === 'linearStep' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Lines */}
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Lines (Spells only)</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField size="small" label="Baseline" type="number" sx={{ width: 100 }}
                  value={bm.lines.baseline ?? ''} onChange={(e) => setDimension('lines', 'baseline', e.target.value === '' ? null : Number(e.target.value))} />
                <TextField size="small" label="Step" type="number" sx={{ width: 100 }}
                  inputProps={{ step: 0.01 }}
                  value={bm.lines.step ?? ''} onChange={(e) => setDimension('lines', 'step', e.target.value === '' ? null : Number(e.target.value))} />
                <TextField size="small" label="Cap" type="number" sx={{ width: 100 }}
                  value={bm.lines.cap ?? ''} placeholder="none"
                  onChange={(e) => setDimension('lines', 'cap', e.target.value === '' ? null : Number(e.target.value))} />
              </Box>
            </Box>
            {/* Cooldown */}
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Cooldown</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField size="small" label="Baseline" type="number" sx={{ width: 100 }}
                  value={bm.cooldown.baseline ?? ''} onChange={(e) => setDimension('cooldown', 'baseline', e.target.value === '' ? null : Number(e.target.value))} />
                <TextField size="small" label="Step" type="number" sx={{ width: 100 }}
                  inputProps={{ step: 0.01 }}
                  value={bm.cooldown.step ?? ''} onChange={(e) => setDimension('cooldown', 'step', e.target.value === '' ? null : Number(e.target.value))} />
                <TextField size="small" label="Cap" type="number" sx={{ width: 100 }}
                  value={bm.cooldown.cap ?? ''} placeholder="none"
                  onChange={(e) => setDimension('cooldown', 'cap', e.target.value === '' ? null : Number(e.target.value))} />
              </Box>
            </Box>
          </Box>
        )}

        {bm.mode === 'binary' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Lines (Spells only)</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField size="small" label="Baseline" type="number" sx={{ width: 100 }}
                  value={bm.lines.baseline ?? ''} onChange={(e) => setDimension('lines', 'baseline', e.target.value === '' ? null : Number(e.target.value))} />
                <TextField size="small" label="Bonus" type="number" sx={{ width: 100 }}
                  inputProps={{ step: 0.01 }}
                  value={bm.lines.bonus ?? ''} onChange={(e) => setDimension('lines', 'bonus', e.target.value === '' ? null : Number(e.target.value))} />
                <TextField size="small" label="Penalty" type="number" sx={{ width: 100 }}
                  inputProps={{ step: 0.01 }}
                  value={bm.lines.penalty ?? ''} onChange={(e) => setDimension('lines', 'penalty', e.target.value === '' ? null : Number(e.target.value))} />
              </Box>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Cooldown</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField size="small" label="Baseline" type="number" sx={{ width: 100 }}
                  value={bm.cooldown.baseline ?? ''} onChange={(e) => setDimension('cooldown', 'baseline', e.target.value === '' ? null : Number(e.target.value))} />
                <TextField size="small" label="Bonus" type="number" sx={{ width: 100 }}
                  inputProps={{ step: 0.01 }}
                  value={bm.cooldown.bonus ?? ''} onChange={(e) => setDimension('cooldown', 'bonus', e.target.value === '' ? null : Number(e.target.value))} />
                <TextField size="small" label="Penalty" type="number" sx={{ width: 100 }}
                  inputProps={{ step: 0.01 }}
                  value={bm.cooldown.penalty ?? ''} onChange={(e) => setDimension('cooldown', 'penalty', e.target.value === '' ? null : Number(e.target.value))} />
              </Box>
            </Box>
          </Box>
        )}

        {bm.mode === 'none' && (
          <Typography variant="body2" color="text.secondary">
            No budget modifier applied. Coefficients are used as-is.
          </Typography>
        )}

        {bm.mode === 'steppedTiers' && (
          <Typography variant="body2" color="text.secondary">
            Stepped tiers configuration coming soon.
          </Typography>
        )}
      </Box>

      <Divider />

      {/* Formula Constants */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>Formula Constants</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Scalar values referenced by formula patterns. These are stored alongside custom variables.
        </Typography>
        <Table size="small" sx={{ mb: 1 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Value</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {FORMULA_CONSTANTS.map((fc) => (
              <TableRow key={fc.key}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{fc.key}</Typography>
                </TableCell>
                <TableCell>
                  <TextField size="small" variant="standard" type="number" sx={{ width: 100 }}
                    value={vars[fc.key] ?? ''} placeholder={String(fc.default)}
                    onChange={(e) => setVar(fc.key, e.target.value === '' ? '' : Number(e.target.value))} />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">{fc.description}</Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Divider />

      {/* Custom Variables */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>Custom Variables</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Additional free-form constants available to patterns and formulas.
        </Typography>
        {Object.keys(vars).filter((k) => !FORMULA_CONSTANT_KEYS.includes(k)).length > 0 && (
          <Table size="small" sx={{ mb: 1 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Value</TableCell>
                <TableCell sx={{ width: 40 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(vars).filter(([k]) => !FORMULA_CONSTANT_KEYS.includes(k)).map(([key, val]) => (
                <TableRow key={key}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{key}</Typography>
                  </TableCell>
                  <TableCell>
                    <TextField size="small" variant="standard" fullWidth type="number"
                      value={val} onChange={(e) => setVar(key, e.target.value === '' ? '' : Number(e.target.value))} />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => deleteVar(key)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField size="small" placeholder="Variable name" value={newVarKey}
            onChange={(e) => setNewVarKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddVar(); }}
            inputProps={{ style: { fontFamily: 'monospace' } }} />
          <Button size="small" startIcon={<AddIcon />} onClick={handleAddVar}
            disabled={!newVarKey.trim() || vars.hasOwnProperty(newVarKey.trim())}>
            Add
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

// ── Coefficients Tab ─────────────────────────────────────────────────────────
function CoefficientsTab({ settings, onChange }) {
  const coeffs = settings.coefficients;
  const [bulkMultiplier, setBulkMultiplier] = useState(0.8);

  const setCoeff = (key, col, value) => {
    const current = coeffs[key] || { spell: null, skill: null };
    onChange({
      ...settings,
      coefficients: {
        ...coeffs,
        [key]: { ...current, [col]: value === '' ? null : Number(value) },
      },
    });
  };

  const handleBulkApply = () => {
    const next = { ...coeffs };
    for (const group of COEFFICIENT_GROUPS) {
      for (const c of group.coefficients) {
        const cur = next[c.key] || { spell: null, skill: null };
        if (cur.spell != null) {
          next[c.key] = { ...cur, skill: Math.round(cur.spell * bulkMultiplier * 10000) / 10000 };
        }
      }
    }
    onChange({ ...settings, coefficients: next });
  };

  return (
    <Box sx={{ p: 2, overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Bulk apply */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="body2" color="text.secondary">Apply Skill = Spell ×</Typography>
        <TextField size="small" type="number" sx={{ width: 80 }}
          inputProps={{ step: 0.01 }}
          value={bulkMultiplier} onChange={(e) => setBulkMultiplier(Number(e.target.value))} />
        <Tooltip title="Set all Skill values to Spell × multiplier (only where Spell has a value)">
          <Button size="small" variant="outlined" startIcon={<AutoFixHighIcon />} onClick={handleBulkApply}>
            Apply
          </Button>
        </Tooltip>
      </Box>

      <Divider />

      {/* Coefficient groups */}
      {COEFFICIENT_GROUPS.map((group) => (
        <Accordion key={group.id} defaultExpanded disableGutters
          sx={{ '&:before': { display: 'none' }, boxShadow: 'none', border: 1, borderColor: 'divider' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">{group.label}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', width: '45%' }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Spell</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Skill</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {group.coefficients.map((c) => {
                  const val = coeffs[c.key] || { spell: null, skill: null };
                  return (
                    <TableRow key={c.key} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell>
                        <Tooltip title={c.description} placement="right">
                          <Typography variant="body2">{c.label}</Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {c.skillOnly ? (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        ) : (
                          <TextField size="small" variant="standard" type="number"
                            inputProps={{ step: 0.01 }}
                            value={val.spell ?? ''} placeholder=""
                            onChange={(e) => setCoeff(c.key, 'spell', e.target.value)} />
                        )}
                      </TableCell>
                      <TableCell>
                        <TextField size="small" variant="standard" type="number"
                          inputProps={{ step: 0.01 }}
                          value={val.skill ?? ''} placeholder=""
                          onChange={(e) => setCoeff(c.key, 'skill', e.target.value)} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

// ── Parameter type labels ─────────────────────────────────────────────────────
const PARAM_TYPE_CHIPS = {
  number:        { label: 'Number',       color: 'default' },
  rand:          { label: 'Random',       color: 'info' },
  stat_block:    { label: 'Stat Block',   color: 'success' },
  setting:       { label: 'Setting',      color: 'warning' },
  coefficient:   { label: 'Coefficient',  color: 'error' },
  castable_cost: { label: 'Castable',     color: 'secondary' },
};

// ── Patterns Tab ─────────────────────────────────────────────────────────────
function PatternsTab({ settings, onChange }) {
  const defaultId = settings.defaultPatternId;

  const handleSetDefault = (e, id) => {
    e.stopPropagation(); // prevent accordion toggle
    onChange({ ...settings, defaultPatternId: id === defaultId ? null : id });
  };

  return (
    <Box sx={{ p: 2, overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ mb: 1 }}>
        <Typography variant="subtitle2" gutterBottom>Formula Patterns</Typography>
        <Typography variant="body2" color="text.secondary">
          Patterns define the structural shape of a formula. Click the "Default" chip to
          set which pattern is pre-selected when creating new formulas.
        </Typography>
      </Box>

      {BUILTIN_PATTERNS.map((pattern) => {
        const isDefault = defaultId === pattern.id;
        return (
          <Accordion key={pattern.id} disableGutters
            sx={{ '&:before': { display: 'none' }, boxShadow: 'none', border: 1,
                  borderColor: isDefault ? 'success.main' : 'divider',
                  borderWidth: isDefault ? 2 : 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, mr: 1 }}>
                <Typography variant="subtitle2">{pattern.name}</Typography>
                <Chip
                  label={isDefault ? 'Default' : 'Set Default'}
                  size="small"
                  color={isDefault ? 'success' : 'default'}
                  variant={isDefault ? 'filled' : 'outlined'}
                  onClick={(e) => handleSetDefault(e, pattern.id)}
                  sx={{ height: 22, fontSize: '0.7rem', cursor: 'pointer' }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {pattern.description}
              </Typography>

              {/* Structure preview */}
              <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, mb: 1.5, fontFamily: 'monospace',
                          fontSize: '0.8rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {pattern.structure}
              </Box>

              {/* Parameters */}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Parameters
              </Typography>
              <Table size="small">
                <TableBody>
                  {pattern.parameters.map((p) => {
                    const chip = PARAM_TYPE_CHIPS[p.type] || { label: p.type, color: 'default' };
                    return (
                      <TableRow key={p.key} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                        <TableCell sx={{ width: '30%', py: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{p.label}</Typography>
                            <Chip label={chip.label} size="small" color={chip.color}
                              sx={{ height: 18, fontSize: '0.65rem' }} />
                            {p.optional && (
                              <Chip label="Optional" size="small" variant="outlined"
                                sx={{ height: 18, fontSize: '0.65rem' }} />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">{p.description}</Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}

// ── Main Dialog ──────────────────────────────────────────────────────────────
function FormulaSettingsDialog({ open, onClose, settings: savedSettings, onSave }) {
  const [tab, setTab] = useState(0);
  const [local, setLocal] = useState(() => mergeSettings(savedSettings));

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocal(mergeSettings(savedSettings));
      setTab(0);
    }
  }, [open, savedSettings]);

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { height: '85vh', display: 'flex', flexDirection: 'column' } }}>
      <DialogTitle sx={{ pb: 0 }}>Formula Settings</DialogTitle>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Budget Modifier" />
          <Tab label="Coefficients" />
          <Tab label="Patterns" />
        </Tabs>
      </Box>
      <DialogContent sx={{ p: 0, flex: 1, overflow: 'hidden' }}>
        <Box sx={{ height: '100%', overflow: 'auto' }}>
          {tab === 0 && <BudgetModifierTab settings={local} onChange={setLocal} />}
          {tab === 1 && <CoefficientsTab settings={local} onChange={setLocal} />}
          {tab === 2 && <PatternsTab settings={local} onChange={setLocal} />}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

export default FormulaSettingsDialog;
