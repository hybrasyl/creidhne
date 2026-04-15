import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box, Button, TextField, Typography, FormControl, InputLabel, Select, MenuItem,
  Snackbar, Alert, Divider, Checkbox, FormControlLabel, Autocomplete, Paper, Chip,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { useRecoilValue } from 'recoil';
import { libraryIndexState, activeLibraryState } from '../../recoil/atoms';
import CommentField from '../shared/CommentField';
import StatBlockBuilder, { statBlockToExpression } from './StatBlockBuilder';
import BUILTIN_PATTERNS from '../../data/formulaPatterns';
import { RAND_VARIABLES } from '../../data/formulaVariables';
import { COEFFICIENT_GROUPS } from '../../data/formulaConstants';
import { assembleFormula } from '../../utils/formulaAssembly';

const CATEGORIES = ['damage', 'heal', 'conversion', 'shield', 'stat', 'cast_cost', 'general'];

// ── Targeting / Delivery options for coefficient lookup ──────────────────────
const EFFECT_TYPES = [
  { key: 'DMG', label: 'Damage' },
  { key: 'HEAL', label: 'Heal' },
  { key: 'CONV', label: 'Conversion' },
  { key: 'SHIELD', label: 'Shield' },
];

const TARGETING_TYPES = [
  { key: 'ST', label: 'Single Target' },
  { key: 'AOE', label: 'AOE' },
];

const DELIVERY_TYPES = [
  { key: 'DIRECT', label: 'Direct' },
  { key: 'DOT', label: 'Over Time (DOT/HOT)' },
  { key: 'HDIR', label: 'Hybrid — Direct portion' },
  { key: 'HDOT', label: 'Hybrid — Over Time portion' },
];

const ASSAIL_KEY = 'DMG_ASSAIL';

function buildCoefficientKey(effect, targeting, delivery) {
  if (effect === 'DMG' && targeting === 'ASSAIL') return ASSAIL_KEY;
  const parts = [effect, targeting];
  if (delivery && delivery !== 'DIRECT') parts.push(delivery);
  return parts.join('_');
}

// ── Coefficient resolver ─────────────────────────────────────────────────────
function resolveCoefficient(coefficients, coeffKey, spellOrSkill, budgetModifier, castableRef) {
  const entry = coefficients?.[coeffKey];
  if (!entry) return null;

  const base = spellOrSkill === 'skill' ? entry.skill : entry.spell;
  if (base == null) return null;

  // Apply budget modifier if configured
  if (!budgetModifier || budgetModifier.mode === 'none' || !castableRef) return base;

  const bm = budgetModifier;
  if (bm.mode === 'linearStep') {
    // Determine which dimension to use (lines or cooldown)
    const dim = castableRef.budgetDimension === 'line' ? bm.lines : bm.cooldown;
    const actual = castableRef.budgetDimension === 'line' ? castableRef.lines : castableRef.cooldown;
    if (dim?.baseline == null || actual == null) return base;

    let delta = (actual - dim.baseline) * (dim.step || 0);
    if (dim.cap != null) delta = Math.min(delta, dim.cap);

    if (bm.application === 'multiplicative') {
      return Math.round(base * (1 + delta) * 10000) / 10000;
    }
    return Math.round((base + delta) * 10000) / 10000;
  }

  if (bm.mode === 'binary') {
    const dim = castableRef.budgetDimension === 'line' ? bm.lines : bm.cooldown;
    const actual = castableRef.budgetDimension === 'line' ? castableRef.lines : castableRef.cooldown;
    if (dim?.baseline == null || actual == null) return base;

    const mod = actual >= dim.baseline ? (dim.bonus || 0) : -(dim.penalty || 0);
    return Math.round((base + mod) * 10000) / 10000;
  }

  return base;
}

// ── Parameter field renderers ────────────────────────────────────────────────
function NumberParam({ value, onChange, label, optional }) {
  return (
    <TextField size="small" type="number" label={label} sx={{ width: 120 }}
      value={value ?? ''} placeholder={optional ? 'optional' : ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
  );
}

function RandParam({ value, onChange }) {
  const v = value || { variable: 'RAND_10', multiplier: 1 };
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel>Variable</InputLabel>
        <Select value={v.variable} label="Variable"
          onChange={(e) => onChange({ ...v, variable: e.target.value })}>
          {RAND_VARIABLES.map((r) => <MenuItem key={r.key} value={r.key}>{r.label}</MenuItem>)}
        </Select>
      </FormControl>
      <Typography variant="body2" color="text.secondary">×</Typography>
      <TextField size="small" type="number" label="Multiplier" sx={{ width: 100 }}
        value={v.multiplier ?? 1}
        onChange={(e) => onChange({ ...v, multiplier: e.target.value === '' ? 1 : Number(e.target.value) })} />
      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
        = {v.variable}{v.multiplier && v.multiplier !== 1 ? ` * ${v.multiplier}` : ''}
      </Typography>
    </Box>
  );
}

function SettingParam({ paramDef, settings }) {
  const val = settings?.customVariables?.[paramDef.settingKey];
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <TextField size="small" label={paramDef.label} value={val ?? ''} disabled sx={{ width: 120 }} />
      <Typography variant="caption" color="text.secondary">
        (from Formula Settings)
      </Typography>
    </Box>
  );
}

function CoefficientParam({ value, coeffKey, spellOrSkill }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <TextField size="small" label="Coefficient" value={value ?? '—'} disabled sx={{ width: 120 }}
        inputProps={{ style: { fontFamily: 'monospace' } }} />
      <Typography variant="caption" color="text.secondary">
        {coeffKey ? `${coeffKey} (${spellOrSkill})` : 'Select targeting + delivery below'}
      </Typography>
    </Box>
  );
}

// ── Used-by panel ───────────────────────────────────────────────────────────
// Reads hybindex-ts reverse-index fields from the library index. Read-only;
// empty state is a single muted line.
function UsedByPanel({ formulaName, libraryIndex }) {
  const castables = (formulaName && libraryIndex?.formulaUsedByCastables?.[formulaName]) || [];
  const statuses  = (formulaName && libraryIndex?.formulaUsedByStatuses?.[formulaName]) || [];
  const total = castables.length + statuses.length;
  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        Used by {total > 0 ? `(${total})` : ''}
      </Typography>
      {total === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
          Not referenced by any castable or status.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {castables.map((n) => <Chip key={`c-${n}`} size="small" label={n} variant="outlined" />)}
          {statuses.map((n)  => <Chip key={`s-${n}`} size="small" label={n} variant="outlined" color="secondary" />)}
        </Box>
      )}
    </Paper>
  );
}

// ── Main Editor ──────────────────────────────────────────────────────────────
function FormulaEditor({ formula, allFormulas, isExisting, onSave, onDirtyChange, saveRef, settings }) {
  const [data, setData] = useState(formula);
  const isDirtyRef = useRef(false);
  const libraryIndex = useRecoilValue(libraryIndexState);
  const activeLibrary = useRecoilValue(activeLibraryState);

  // Pattern-driven parameter values
  const [paramValues, setParamValues] = useState(formula.paramValues || {});
  const [handEdit, setHandEdit] = useState(formula.handEdit || false);

  // Castable/Status reference
  const [refType, setRefType] = useState(formula.refType || 'castable'); // 'castable' | 'status'
  const [refName, setRefName] = useState(formula.refName || '');
  const [spellOrSkill, setSpellOrSkill] = useState(formula.spellOrSkill || 'spell');
  const [budgetDimension, setBudgetDimension] = useState(formula.budgetDimension || 'cd');
  const [castableLines, setCastableLines] = useState(formula.castableLines ?? null);
  const [castableCooldown, setCastableCooldown] = useState(formula.castableCooldown ?? null);

  // Coefficient selection
  const [coeffEffect, setCoeffEffect] = useState(formula.coeffEffect || 'DMG');
  const [coeffTargeting, setCoeffTargeting] = useState(formula.coeffTargeting || 'ST');
  const [coeffDelivery, setCoeffDelivery] = useState(formula.coeffDelivery || 'DIRECT');

  const markDirtyLocal = useCallback(() => {
    if (!isDirtyRef.current) { isDirtyRef.current = true; onDirtyChange?.(true); }
  }, [onDirtyChange]);

  const updateData = useCallback((updater) => {
    markDirtyLocal();
    setData((prev) => typeof updater === 'function' ? updater(prev) : updater);
  }, [markDirtyLocal]);

  const set = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.value }));

  const updateParam = (key, value) => {
    markDirtyLocal();
    setParamValues((prev) => ({ ...prev, [key]: value }));
  };

  // Reset when formula prop changes
  useEffect(() => {
    setData(formula);
    setParamValues(formula.paramValues || {});
    setHandEdit(formula.handEdit || false);
    setRefType(formula.refType || 'castable');
    setRefName(formula.refName || '');
    setSpellOrSkill(formula.spellOrSkill || 'spell');
    setBudgetDimension(formula.budgetDimension || 'cd');
    setCastableLines(formula.castableLines ?? null);
    setCastableCooldown(formula.castableCooldown ?? null);
    setCoeffEffect(formula.coeffEffect || 'DMG');
    setCoeffTargeting(formula.coeffTargeting || 'ST');
    setCoeffDelivery(formula.coeffDelivery || 'DIRECT');
    isDirtyRef.current = false;
    setDupSnack(null);
    onDirtyChange?.(false);
  }, [formula]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pattern lookup ────────────────────────────────────────────────────────
  const selectedPattern = useMemo(
    () => BUILTIN_PATTERNS.find((p) => p.id === data.patternId) || null,
    [data.patternId],
  );

  // ── Coefficient calculation ───────────────────────────────────────────────
  const coeffKey = useMemo(() => {
    if (coeffTargeting === 'ASSAIL') return ASSAIL_KEY;
    return buildCoefficientKey(coeffEffect, coeffTargeting, coeffDelivery);
  }, [coeffEffect, coeffTargeting, coeffDelivery]);

  const castableRef = useMemo(() => ({
    budgetDimension: budgetDimension === 'line' ? 'line' : 'cd',
    lines: castableLines,
    cooldown: castableCooldown,
  }), [budgetDimension, castableLines, castableCooldown]);

  const resolvedCoefficient = useMemo(
    () => resolveCoefficient(settings?.coefficients, coeffKey, spellOrSkill, settings?.budgetModifier, castableRef),
    [settings, coeffKey, spellOrSkill, castableRef],
  );

  // ── Assembled formula ─────────────────────────────────────────────────────
  const assembledFormula = useMemo(() => {
    if (!selectedPattern) return '';
    // Build resolved param values with settings and coefficient injected
    // Per-formula overrides take precedence over global values
    const resolved = { ...paramValues };
    for (const p of selectedPattern.parameters) {
      if (p.type === 'setting' && p.settingKey) {
        const overrideKey = `_override_${p.key}`;
        resolved[p.key] = paramValues[overrideKey] != null
          ? paramValues[overrideKey]
          : (settings?.customVariables?.[p.settingKey] ?? 0);
      }
      if (p.type === 'coefficient') {
        const overrideKey = '_override_Coefficient';
        resolved[p.key] = paramValues[overrideKey] != null
          ? paramValues[overrideKey]
          : (resolvedCoefficient ?? 0);
      }
    }
    return assembleFormula(selectedPattern.ncalc, resolved, selectedPattern.parameters);
  }, [selectedPattern, paramValues, settings, resolvedCoefficient]);

  // ── Duplicate detection ───────────────────────────────────────────────────
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

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    const formulaString = handEdit ? data.formula : (assembledFormula || data.formula);
    onSave({
      ...data,
      formula: formulaString,
      paramValues,
      handEdit,
      refType,
      refName,
      spellOrSkill,
      budgetDimension,
      castableLines,
      castableCooldown,
      coeffEffect,
      coeffTargeting,
      coeffDelivery,
    });
  };
  if (saveRef) saveRef.current = handleSave;

  // ── Castable / Status lists ───────────────────────────────────────────────
  const castableNames = libraryIndex?.castables || [];
  const statusNames = libraryIndex?.statuses || [];
  const refOptions = refType === 'castable' ? castableNames : statusNames;

  // Load castable info from XML when a castable is selected
  const handleRefNameChange = async (name) => {
    markDirtyLocal();
    setRefName(name || '');
    if (refType === 'castable' && name && activeLibrary) {
      try {
        const info = await window.electronAPI.castableInfo(activeLibrary, name);
        if (info) {
          // Determine spell/skill from book attribute
          const isSpell = info.book && info.book.toLowerCase().includes('spell');
          setSpellOrSkill(isSpell ? 'spell' : 'skill');
          setCastableLines(info.lines);
          setCastableCooldown(info.cooldown);
          // If lines > 0 and it's a spell, default budget to lines
          if (info.lines && info.lines > 0 && isSpell) {
            setBudgetDimension('line');
          } else {
            setBudgetDimension('cd');
          }
        }
      } catch { /* castable not found, leave fields as-is */ }
    }
    if (refType === 'status') {
      setSpellOrSkill('spell'); // default; user can override
    }
  };

  // ── Delivery options based on ref type ─────────────────────────────────────
  // Castables: Direct, Hybrid-Direct, or Hybrid-DOT (never pure DOT)
  // Statuses: always Over Time (DOT/HOT)
  const deliveryOptions = useMemo(() => {
    if (refType === 'status') return [{ key: 'DOT', label: 'Over Time (DOT/HOT)' }];
    // Castables do direct damage only — HDOT belongs on the status formula
    return [
      { key: 'DIRECT', label: 'Direct' },
      { key: 'HDIR', label: 'Hybrid — Direct portion' },
    ];
  }, [refType]);

  // Auto-set delivery when switching ref type
  useEffect(() => {
    if (refType === 'status' && coeffDelivery !== 'DOT') {
      setCoeffDelivery('DOT');
      markDirtyLocal();
    }
    if (refType === 'castable' && coeffDelivery === 'DOT') {
      setCoeffDelivery('DIRECT');
      markDirtyLocal();
    }
  }, [refType]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
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
        {/* Row 1: Name + Category + Pattern */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Name" required size="small" sx={{
              flex: 1,
              ...(dupStatus === 'active' && {
                '& .MuiOutlinedInput-root fieldset': { borderColor: 'error.main' },
                '& .MuiInputLabel-root:not(.Mui-focused)': { color: 'error.main' },
              }),
            }}
            error={dupStatus === 'active'}
            helperText={dupStatus === 'active' ? `"${data.name}" already exists` : undefined}
            value={data.name || ''} onChange={set('name')} onBlur={handleNameBlur}
            inputProps={{ maxLength: 128 }}
          />
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Category</InputLabel>
            <Select value={data.category || 'damage'} label="Category"
              onChange={(e) => updateData((d) => ({ ...d, category: e.target.value }))}>
              {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel shrink>Pattern</InputLabel>
            <Select value={data.patternId || ''} label="Pattern" displayEmpty notched
              onChange={(e) => updateData((d) => ({ ...d, patternId: e.target.value || null }))}>
              <MenuItem value="">
                <em>None (hand-edit only)</em>
              </MenuItem>
              {BUILTIN_PATTERNS.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        {/* Row 2: Description */}
        <CommentField
          label="Description" value={data.description || ''}
          onChange={(e) => updateData((d) => ({ ...d, description: e.target.value }))}
          fullWidth
        />

        {/* Used by — reverse index from libraryIndex (read-only) */}
        <UsedByPanel formulaName={data.name} libraryIndex={libraryIndex} />

        {/* Castable / Status Reference */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Castable / Status Reference</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Type</InputLabel>
              <Select value={refType} label="Type"
                onChange={(e) => { markDirtyLocal(); setRefType(e.target.value); setRefName(''); }}>
                <MenuItem value="castable">Castable</MenuItem>
                <MenuItem value="status">Status</MenuItem>
              </Select>
            </FormControl>
            <Autocomplete
              size="small" sx={{ minWidth: 240, flex: 1 }}
              freeSolo options={refOptions}
              value={refName}
              onInputChange={(_, val, reason) => {
                if (reason === 'input' || reason === 'reset') {
                  markDirtyLocal();
                  setRefName(val || '');
                }
              }}
              onChange={(_, val) => {
                // Fires on dropdown selection
                if (val) handleRefNameChange(val);
              }}
              onBlur={() => {
                // Fires when user finishes typing and leaves the field
                if (refName) handleRefNameChange(refName);
              }}
              renderInput={(params) => <TextField {...params} label={refType === 'castable' ? 'Castable Name' : 'Status Name'} />}
            />
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Class</InputLabel>
              <Select value={spellOrSkill} label="Class"
                onChange={(e) => { markDirtyLocal(); setSpellOrSkill(e.target.value); }}>
                <MenuItem value="spell">Spell</MenuItem>
                <MenuItem value="skill">Skill</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Status hint */}
          {refType === 'status' && (
            <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
              Status formulas represent damage/healing for a single tick. The castable that applies
              the status controls total duration and tick interval.
            </Typography>
          )}

          {/* Lines / Cooldown display + Budget Source */}
          {refType === 'castable' && (
            <Box sx={{ display: 'flex', gap: 2, mt: 1.5, alignItems: 'center' }}>
              <TextField size="small" label="Lines" sx={{ width: 80 }}
                value={castableLines ?? '—'} disabled
                inputProps={{ style: { fontFamily: 'monospace' } }} />
              <TextField size="small" label="Cooldown (sec)" sx={{ width: 120 }}
                value={castableCooldown ?? '—'} disabled
                inputProps={{ style: { fontFamily: 'monospace' } }} />
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Budget Source</InputLabel>
                <Select value={budgetDimension} label="Budget Source"
                  onChange={(e) => { markDirtyLocal(); setBudgetDimension(e.target.value); }}>
                  <MenuItem value="cd">Cooldown</MenuItem>
                  {spellOrSkill === 'spell' && <MenuItem value="line">Lines</MenuItem>}
                </Select>
              </FormControl>
            </Box>
          )}
        </Paper>

        {/* Coefficient Selection */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Coefficient</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Effect</InputLabel>
              <Select value={coeffEffect} label="Effect"
                onChange={(e) => { markDirtyLocal(); setCoeffEffect(e.target.value); }}>
                {EFFECT_TYPES.map((t) => <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Targeting</InputLabel>
              <Select value={coeffTargeting} label="Targeting"
                onChange={(e) => { markDirtyLocal(); setCoeffTargeting(e.target.value); }}>
                {TARGETING_TYPES.map((t) => <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>)}
                {spellOrSkill === 'skill' && <MenuItem value="ASSAIL">Assail</MenuItem>}
              </Select>
            </FormControl>
            {coeffTargeting !== 'ASSAIL' && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Delivery</InputLabel>
                <Select value={coeffDelivery} label="Delivery"
                  onChange={(e) => { markDirtyLocal(); setCoeffDelivery(e.target.value); }}>
                  {deliveryOptions.map((d) => <MenuItem key={d.key} value={d.key}>{d.label}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={coeffKey} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                = {resolvedCoefficient ?? '—'}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Pattern Parameters */}
        {selectedPattern && (() => {
          const params = selectedPattern.parameters;
          // Group params into sections for better layout
          const baseParam = params.find((p) => p.key === 'Base');
          const randParam = params.find((p) => p.type === 'rand');
          const weaponParam = params.find((p) => p.key === 'WeaponCoeff');
          const statParams = params.filter((p) => p.type === 'stat_block');
          const settingParams = params.filter((p) => p.type === 'setting');
          const coeffParam = params.find((p) => p.type === 'coefficient');
          const costParam = params.find((p) => p.type === 'castable_cost');
          const otherParams = params.filter((p) =>
            p !== baseParam && p !== randParam && p !== weaponParam && p !== coeffParam && p !== costParam
            && p.type !== 'stat_block' && p.type !== 'setting',
          );

          return (
            <>
              {/* Base Damage section */}
              {(baseParam || randParam) && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Base Damage</Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {baseParam && (
                      <NumberParam
                        value={paramValues[baseParam.key]} label="Base Damage"
                        onChange={(v) => updateParam(baseParam.key, v)}
                      />
                    )}
                    {randParam && (() => {
                      const rv = paramValues[randParam.key] || { variable: '', multiplier: 1 };
                      return (
                        <>
                          <FormControl size="small" sx={{ minWidth: 130 }}>
                            <InputLabel shrink>Random</InputLabel>
                            <Select value={rv.variable || ''} label="Random" displayEmpty notched
                              onChange={(e) => {
                                const variable = e.target.value;
                                updateParam(randParam.key, {
                                  variable,
                                  multiplier: variable && !rv.multiplier ? 1 : rv.multiplier,
                                });
                              }}>
                              <MenuItem value=""><em>None</em></MenuItem>
                              {RAND_VARIABLES.map((r) => <MenuItem key={r.key} value={r.key}>{r.label}</MenuItem>)}
                            </Select>
                          </FormControl>
                          {rv.variable && (
                            <>
                              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>×</Typography>
                              <TextField size="small" type="number" label="Quantity" sx={{ width: 90 }}
                                value={rv.multiplier ?? 1} placeholder="1"
                                onChange={(e) => updateParam(randParam.key, {
                                  ...rv,
                                  multiplier: e.target.value === '' ? 1 : Number(e.target.value),
                                })} />
                              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', fontFamily: 'monospace' }}>
                                = {rv.variable}{rv.multiplier && rv.multiplier !== 1 ? ` * ${rv.multiplier}` : ''}
                              </Typography>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </Box>
                </Paper>
              )}

              {/* Weapon Damage section */}
              {weaponParam && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Weapon Damage</Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControlLabel
                      control={
                        <Checkbox size="small"
                          checked={paramValues._weaponEnabled ?? false}
                          onChange={(e) => {
                            updateParam('_weaponEnabled', e.target.checked);
                            if (!e.target.checked) updateParam(weaponParam.key, null);
                            else if (!paramValues[weaponParam.key]) updateParam(weaponParam.key, 1);
                          }} />
                      }
                      label={<Typography variant="body2">Enable weapon damage (SOURCEWEAPONSMALLDAMAGE)</Typography>}
                    />
                    {(paramValues._weaponEnabled ?? false) && (
                      <>
                        <Typography variant="body2" color="text.secondary">×</Typography>
                        <NumberParam
                          value={paramValues[weaponParam.key]} label="Coefficient"
                          onChange={(v) => updateParam(weaponParam.key, v)}
                        />
                      </>
                    )}
                  </Box>
                </Paper>
              )}

              {/* Stat Block section */}
              {statParams.map((p) => (
                <Paper key={p.key} variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>{p.label}</Typography>
                  <StatBlockBuilder
                    rows={paramValues[p.key] || []}
                    onChange={(rows) => updateParam(p.key, rows)}
                  />
                </Paper>
              ))}

              {/* Castable Cost (DA Classic) */}
              {costParam && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>{costParam.label}</Typography>
                  <NumberParam
                    value={paramValues[costParam.key]} label="Mana Cost"
                    onChange={(v) => updateParam(costParam.key, v)}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Enter the castable's static MP cost. Percentage-based costs are not supported.
                  </Typography>
                </Paper>
              )}

              {/* Settings + Coefficient with per-formula overrides */}
              {(settingParams.length > 0 || coeffParam) && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Formula Constants & Coefficient</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {settingParams.map((p) => {
                      const overrideKey = `_override_${p.key}`;
                      const isOverridden = paramValues[overrideKey] != null;
                      const globalVal = settings?.customVariables?.[p.settingKey];
                      return (
                        <Box key={p.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FormControlLabel
                            control={
                              <Checkbox size="small" checked={isOverridden}
                                onChange={(e) => {
                                  markDirtyLocal();
                                  if (e.target.checked) {
                                    updateParam(overrideKey, globalVal ?? 0);
                                  } else {
                                    updateParam(overrideKey, null);
                                  }
                                }} />
                            }
                            label={<Typography variant="body2">{p.label}</Typography>}
                            sx={{ minWidth: 130 }}
                          />
                          {isOverridden ? (
                            <TextField size="small" type="number" label="Override" sx={{ width: 120 }}
                              value={paramValues[overrideKey] ?? ''}
                              onChange={(e) => updateParam(overrideKey, e.target.value === '' ? null : Number(e.target.value))} />
                          ) : (
                            <TextField size="small" label="Default" value={globalVal ?? '—'} disabled sx={{ width: 120 }}
                              inputProps={{ style: { fontFamily: 'monospace' } }} />
                          )}
                          {isOverridden && (
                            <Typography variant="caption" color="warning.main">
                              overrides global ({globalVal ?? '—'})
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                    {coeffParam && (() => {
                      const overrideKey = '_override_Coefficient';
                      const isOverridden = paramValues[overrideKey] != null;
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FormControlLabel
                            control={
                              <Checkbox size="small" checked={isOverridden}
                                onChange={(e) => {
                                  markDirtyLocal();
                                  if (e.target.checked) {
                                    updateParam(overrideKey, resolvedCoefficient ?? 0);
                                  } else {
                                    updateParam(overrideKey, null);
                                  }
                                }} />
                            }
                            label={<Typography variant="body2">Coefficient</Typography>}
                            sx={{ minWidth: 130 }}
                          />
                          {isOverridden ? (
                            <TextField size="small" type="number" label="Override" sx={{ width: 120 }}
                              inputProps={{ step: 0.01 }}
                              value={paramValues[overrideKey] ?? ''}
                              onChange={(e) => updateParam(overrideKey, e.target.value === '' ? null : Number(e.target.value))} />
                          ) : (
                            <TextField size="small" label="Calculated" value={resolvedCoefficient ?? '—'} disabled sx={{ width: 120 }}
                              inputProps={{ style: { fontFamily: 'monospace' } }} />
                          )}
                          {isOverridden && (
                            <Typography variant="caption" color="warning.main">
                              overrides calculated ({resolvedCoefficient ?? '—'})
                            </Typography>
                          )}
                          <Chip label={coeffKey} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
                        </Box>
                      );
                    })()}
                  </Box>
                </Paper>
              )}

              {/* Any remaining params */}
              {otherParams.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Other Parameters</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {otherParams.map((p) => (
                      <Box key={p.key}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{p.label}</Typography>
                        <NumberParam
                          value={paramValues[p.key]} label={p.label} optional={p.optional}
                          onChange={(v) => updateParam(p.key, v)}
                        />
                      </Box>
                    ))}
                  </Box>
                </Paper>
              )}
            </>
          );
        })()}

        {/* Assembled Formula */}
        {selectedPattern && assembledFormula && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Assembled Formula</Typography>
            <Box sx={{
              bgcolor: 'action.hover', borderRadius: 1, p: 1.5,
              fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'pre-wrap',
              wordBreak: 'break-all', lineHeight: 1.6,
            }}>
              {assembledFormula}
            </Box>
          </Paper>
        )}

        {/* Hand-edit toggle + textarea */}
        <Box>
          <FormControlLabel
            control={
              <Checkbox size="small" checked={handEdit}
                onChange={(e) => { markDirtyLocal(); setHandEdit(e.target.checked); }} />
            }
            label={
              <Typography variant="body2">
                Hand-edit formula {selectedPattern ? '(overrides assembled formula)' : ''}
              </Typography>
            }
          />
          {(handEdit || !selectedPattern) && (
            <TextField
              label="Formula" size="small" fullWidth multiline minRows={3}
              value={data.formula || ''}
              onChange={set('formula')}
              inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
              helperText="NCalc expression string — this value is written to castable/status XML"
              sx={{ mt: 1 }}
            />
          )}
        </Box>
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
