import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Divider, TextField, IconButton, Tooltip, List, ListItem,
  ListItemButton, ListItemText, Autocomplete, Alert, Paper, Table, TableBody,
  TableCell, TableHead, TableRow, Stack, Checkbox, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, Accordion, AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useRecoilValue } from 'recoil';
import { activeLibraryState } from '../recoil/atoms';
import {
  compile, UnknownVariableError, UnknownFunctionError,
} from '../utils/formulaEval';
import {
  RAND_VARIABLES, WEAPON_VARIABLES, STATIC_VARIABLES, AUTHORING_VARIABLES,
  getStatsForPrefix,
} from '../data/formulaVariables';

// ── Known variable universe ─────────────────────────────────────────────────
const KNOWN_VARIABLES = new Set([
  ...getStatsForPrefix('SOURCE').map((s) => s.key),
  ...getStatsForPrefix('TARGET').map((s) => s.key),
  ...getStatsForPrefix('MAP').map((s) => s.key),
  ...RAND_VARIABLES.map((r) => r.key),
  ...WEAPON_VARIABLES.map((w) => w.key),
  ...STATIC_VARIABLES.map((s) => s.key),
  ...AUTHORING_VARIABLES.map((a) => a.key),
]);

const DEFAULT_STATS = { str: 10, int: 10, wis: 10, con: 10, dex: 10 };
const DEFAULT_PLAYER = () => ({
  id: crypto.randomUUID(),
  name: 'New Player',
  level: 50,
  stats: { ...DEFAULT_STATS },
  hp: 1000, mp: 500,
});

// ── Variable context builders ───────────────────────────────────────────────

function buildBaseVars(player) {
  const v = {};
  for (const name of KNOWN_VARIABLES) v[name] = 0;
  if (!player) return v;
  Object.assign(v, {
    SOURCESTR: player.stats.str, SOURCEINT: player.stats.int, SOURCEWIS: player.stats.wis,
    SOURCECON: player.stats.con, SOURCEDEX: player.stats.dex,
    SOURCELEVEL: player.level,
    SOURCEHP: player.hp, SOURCEMP: player.mp,
    SOURCEMAXIMUMHP: player.hp, SOURCEMAXIMUMMP: player.mp,
    SOURCEBASEHP: player.hp, SOURCEBASEMP: player.mp,
    SOURCEBASESTR: player.stats.str, SOURCEBASEINT: player.stats.int,
    SOURCEBASEWIS: player.stats.wis, SOURCEBASECON: player.stats.con,
    SOURCEBASEDEX: player.stats.dex,
    TARGETLEVEL: player.level,
  });
  return v;
}

function explicitKeys(player, weapon, castableCtx) {
  const keys = new Set();
  if (player) {
    ['SOURCESTR', 'SOURCEINT', 'SOURCEWIS', 'SOURCECON', 'SOURCEDEX',
     'SOURCELEVEL', 'SOURCEHP', 'SOURCEMP',
     'SOURCEMAXIMUMHP', 'SOURCEMAXIMUMMP', 'SOURCEBASEHP', 'SOURCEBASEMP',
     'SOURCEBASESTR', 'SOURCEBASEINT', 'SOURCEBASEWIS', 'SOURCEBASECON', 'SOURCEBASEDEX',
     'TARGETLEVEL'].forEach((k) => keys.add(k));
  }
  if (weapon?.smallSet) keys.add('SOURCEWEAPONSMALLDAMAGE');
  if (weapon?.largeSet) keys.add('SOURCEWEAPONLARGEDAMAGE');
  if (castableCtx?.acquiredLevelSet) keys.add('ACQUIREDLEVEL');
  RAND_VARIABLES.forEach((r) => keys.add(r.key));
  return keys;
}

function withRandAndWeapon(baseVars, weapon, mode) {
  const out = { ...baseVars };
  for (const { key, max } of RAND_VARIABLES) {
    if (mode === 'low') out[key] = 0;
    else if (mode === 'high') out[key] = max;
    else out[key] = max / 2;
  }
  if (weapon?.smallSet) {
    if (mode === 'low')  out.SOURCEWEAPONSMALLDAMAGE = weapon.smallMin;
    else if (mode === 'high') out.SOURCEWEAPONSMALLDAMAGE = weapon.smallMax;
    else out.SOURCEWEAPONSMALLDAMAGE = (weapon.smallMin + weapon.smallMax) / 2;
  }
  if (weapon?.largeSet) {
    if (mode === 'low')  out.SOURCEWEAPONLARGEDAMAGE = weapon.largeMin;
    else if (mode === 'high') out.SOURCEWEAPONLARGEDAMAGE = weapon.largeMax;
    else out.SOURCEWEAPONLARGEDAMAGE = (weapon.largeMin + weapon.largeMax) / 2;
  }
  return out;
}

function evalSafe(compiled, vars) {
  try {
    return { value: compiled(vars), error: null };
  } catch (e) {
    if (e instanceof UnknownVariableError) return { value: null, error: `Unknown variable: ${e.variable}` };
    if (e instanceof UnknownFunctionError) return { value: null, error: `Unknown function: ${e.function}` };
    return { value: null, error: e?.message || String(e) };
  }
}

function formatNum(n) {
  if (n == null || Number.isNaN(n)) return '—';
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

// ── Test player dialog (new / edit) ─────────────────────────────────────────

function TestPlayerDialog({ open, initialPlayer, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(null);
  useEffect(() => { setDraft(initialPlayer ? { ...initialPlayer, stats: { ...initialPlayer.stats } } : null); }, [initialPlayer, open]);
  if (!draft) return null;
  const isNew = !initialPlayer?.persisted;

  const setField = (field, value) => setDraft((d) => ({ ...d, [field]: value }));
  const setStat = (stat, value) => setDraft((d) => ({ ...d, stats: { ...d.stats, [stat]: Number(value) || 0 } }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isNew ? 'New Test Player' : `Edit: ${initialPlayer.name}`}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField size="small" label="Name" value={draft.name} fullWidth
            onChange={(e) => setField('name', e.target.value)} />
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="Level" type="number" sx={{ width: 120 }}
              value={draft.level}
              onChange={(e) => setField('level', Number(e.target.value) || 0)} />
            <TextField size="small" label="HP" type="number" sx={{ width: 120 }}
              value={draft.hp}
              onChange={(e) => setField('hp', Number(e.target.value) || 0)} />
            <TextField size="small" label="MP" type="number" sx={{ width: 120 }}
              value={draft.mp}
              onChange={(e) => setField('mp', Number(e.target.value) || 0)} />
          </Stack>
          <Typography variant="caption" color="text.secondary">Core stats</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1 }}>
            {['str', 'int', 'wis', 'con', 'dex'].map((stat) => (
              <TextField
                key={stat} size="small" label={stat.toUpperCase()} type="number"
                value={draft.stats[stat]}
                onChange={(e) => setStat(stat, e.target.value)}
              />
            ))}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        {!isNew && (
          <Button color="error" onClick={() => { onDelete(draft.id); onClose(); }} startIcon={<DeleteIcon />}>
            Delete
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { onSave(draft); onClose(); }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Result block for one player ─────────────────────────────────────────────

function PlayerResultRow({ player, low, avg, high }) {
  const cell = (r) => (r?.error ? `err: ${r.error}` : formatNum(r?.value));
  return (
    <TableRow>
      <TableCell>{player.name} <Typography component="span" variant="caption" color="text.secondary">(L{player.level})</Typography></TableCell>
      <TableCell align="right">{cell(low)}</TableCell>
      <TableCell align="right">{cell(avg)}</TableCell>
      <TableCell align="right">{cell(high)}</TableCell>
    </TableRow>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function DamageCalculatorPage() {
  const activeLibrary = useRecoilValue(activeLibraryState);

  const [testPlayers, setTestPlayers] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [dialogState, setDialogState] = useState({ open: false, initial: null });

  const [selectedFormula, setSelectedFormula] = useState(null);
  const [customFormula, setCustomFormula] = useState('');
  const [duration, setDuration] = useState('');
  const [tick, setTick] = useState('');
  const [weapon, setWeapon] = useState({ smallMin: '', smallMax: '', largeMin: '', largeMax: '' });
  const [castableContext, setCastableContext] = useState({ acquiredLevel: '' });
  const [overrides, setOverrides] = useState([
    { name: '', value: '' }, { name: '', value: '' }, { name: '', value: '' },
  ]);

  useEffect(() => {
    if (!activeLibrary) { setTestPlayers([]); setFormulas([]); return; }
    (async () => {
      const c = await window.electronAPI.loadUserConstants(activeLibrary);
      setTestPlayers(Array.isArray(c?.testPlayers) ? c.testPlayers : []);
      const f = await window.electronAPI.loadFormulas(activeLibrary);
      setFormulas(Array.isArray(f?.formulas) ? f.formulas : []);
    })();
  }, [activeLibrary]);

  const persistTestPlayers = async (next) => {
    setTestPlayers(next);
    if (!activeLibrary) return;
    const current = (await window.electronAPI.loadUserConstants(activeLibrary)) || {};
    await window.electronAPI.saveUserConstants(activeLibrary, { ...current, testPlayers: next });
  };

  const handleOpenNew = () => setDialogState({ open: true, initial: DEFAULT_PLAYER() });
  const handleOpenEdit = (player) => setDialogState({ open: true, initial: { ...player, persisted: true } });
  const handleCloseDialog = () => setDialogState({ open: false, initial: null });

  const handleSavePlayer = (draft) => {
    const exists = testPlayers.some((p) => p.id === draft.id);
    const next = exists
      ? testPlayers.map((p) => (p.id === draft.id ? draft : p))
      : [...testPlayers, draft];
    persistTestPlayers(next);
  };

  const handleDeletePlayer = (id) => {
    persistTestPlayers(testPlayers.filter((p) => p.id !== id));
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const selectedPlayers = useMemo(
    () => testPlayers.filter((p) => selectedIds.has(p.id)),
    [testPlayers, selectedIds],
  );

  const formulaText = customFormula.trim() || selectedFormula?.formula || '';

  const overrideMap = useMemo(() => {
    const map = {};
    for (const row of overrides) {
      const name = (row.name || '').trim();
      if (!name) continue;
      const v = Number(row.value);
      if (row.value === '' || Number.isNaN(v)) continue;
      map[name] = v;
    }
    return map;
  }, [overrides]);

  const castableContextConfig = useMemo(() => {
    const n = Number(castableContext.acquiredLevel);
    const acquiredLevelSet = castableContext.acquiredLevel !== '' && !Number.isNaN(n);
    return { acquiredLevelSet, acquiredLevel: acquiredLevelSet ? n : 0 };
  }, [castableContext]);

  const weaponConfig = useMemo(() => {
    const smMin = Number(weapon.smallMin), smMax = Number(weapon.smallMax);
    const lgMin = Number(weapon.largeMin), lgMax = Number(weapon.largeMax);
    const smallSet = weapon.smallMin !== '' && weapon.smallMax !== '' && !Number.isNaN(smMin) && !Number.isNaN(smMax);
    const largeSet = weapon.largeMin !== '' && weapon.largeMax !== '' && !Number.isNaN(lgMin) && !Number.isNaN(lgMax);
    return {
      smallSet, largeSet,
      smallMin: smallSet ? smMin : 0, smallMax: smallSet ? smMax : 0,
      largeMin: largeSet ? lgMin : 0, largeMax: largeSet ? lgMax : 0,
    };
  }, [weapon]);

  // Evaluator: produces per-player rows.
  const evalState = useMemo(() => {
    if (!selectedPlayers.length || !formulaText.trim()) return null;
    let compiled;
    try { compiled = compile(formulaText); }
    catch (e) { return { parseError: e?.message || String(e) }; }

    const referenced = [...compiled.variables];
    const unknown = referenced.filter((v) => !KNOWN_VARIABLES.has(v));
    if (unknown.length) return { parseError: null, unknown, assumedZero: [], perPlayer: [] };

    // assumedZero is computed per-player context (weapon/override/context are shared)
    const sharedExplicit = explicitKeys(null, weaponConfig, castableContextConfig);
    for (const name of Object.keys(overrideMap)) sharedExplicit.add(name);

    const perPlayer = selectedPlayers.map((player) => {
      const explicit = new Set(sharedExplicit);
      explicitKeys(player, null, null).forEach((k) => explicit.add(k));
      const base = buildBaseVars(player);
      if (castableContextConfig.acquiredLevelSet) base.ACQUIREDLEVEL = castableContextConfig.acquiredLevel;
      const applyOverrides = (v) => ({ ...v, ...overrideMap });
      const low  = evalSafe(compiled, applyOverrides(withRandAndWeapon(base, weaponConfig, 'low')));
      const avg  = evalSafe(compiled, applyOverrides(withRandAndWeapon(base, weaponConfig, 'avg')));
      const high = evalSafe(compiled, applyOverrides(withRandAndWeapon(base, weaponConfig, 'high')));
      const assumedZero = referenced.filter((v) => KNOWN_VARIABLES.has(v) && !explicit.has(v));
      return { player, low, avg, high, assumedZero };
    });

    // Warnings aggregate: if every player has the same assumedZero set, show it once.
    const globalAssumed = perPlayer.length
      ? [...new Set(perPlayer.flatMap((p) => p.assumedZero))].sort()
      : [];

    return { parseError: null, unknown: [], assumedZero: globalAssumed, perPlayer };
  }, [selectedPlayers, formulaText, weaponConfig, castableContextConfig, overrideMap]);

  const dotTicks = useMemo(() => {
    const d = Number(duration), t = Number(tick);
    if (!d || !t || t <= 0) return null;
    return Math.ceil(d / t);
  }, [duration, tick]);

  return (
    <Box sx={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
      {/* Left: test players */}
      <Box sx={{ width: 300, flexShrink: 0, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ p: 1, display: 'flex', alignItems: 'center' }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            Test Players {selectedIds.size > 0 && <Typography component="span" variant="caption" color="text.secondary">({selectedIds.size} selected)</Typography>}
          </Typography>
          <Tooltip title="New test player">
            <IconButton size="small" onClick={handleOpenNew} disabled={!activeLibrary}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Divider />
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <List dense disablePadding>
            {testPlayers.map((p) => (
              <ListItem
                key={p.id}
                disablePadding
                secondaryAction={
                  <Stack direction="row">
                    <Tooltip title="Edit">
                      <IconButton size="small" edge="end" onClick={() => handleOpenEdit(p)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                }
              >
                <ListItemButton onClick={() => toggleSelected(p.id)} dense>
                  <Checkbox edge="start" checked={selectedIds.has(p.id)} tabIndex={-1} disableRipple size="small" />
                  <ListItemText
                    primary={p.name}
                    secondary={`Lv ${p.level}`}
                    primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
            {testPlayers.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                {activeLibrary ? 'No test players yet — click + to add one.' : 'Select a library first.'}
              </Typography>
            )}
          </List>
        </Box>
      </Box>

      {/* Right: calculator */}
      <Box sx={{ flex: 1, p: 2, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h5" fontWeight="bold">Damage Calculator</Typography>
        <Typography variant="caption" color="text.secondary">
          Local preview only — not authoritative. Final values come from the server's NCalc evaluator.
        </Typography>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Autocomplete
              size="small"
              options={formulas}
              getOptionLabel={(f) => f?.name || ''}
              value={selectedFormula}
              onChange={(_, v) => { setSelectedFormula(v); setCustomFormula(''); }}
              renderInput={(params) => <TextField {...params} label="Formula (from library)" />}
            />
            <TextField
              size="small" label="…or paste a formula" fullWidth multiline maxRows={4}
              value={customFormula}
              onChange={(e) => { setCustomFormula(e.target.value); setSelectedFormula(null); }}
              placeholder='e.g. SOURCESTR * 3 + floor(SOURCELEVEL / 10) + RAND_10'
            />
            {formulaText && (
              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                Evaluating: {formulaText}
              </Typography>
            )}
          </Stack>
        </Paper>

        <Accordion variant="outlined" defaultExpanded disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Optional inputs — castable context · weapon · overrides · DOT</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2} divider={<Divider flexItem />}>
              {/* Castable context */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>Castable context</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Authoring-time variables substituted to a literal number at XML save time. Future: auto-populate from a referenced castable.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small" label="ACQUIREDLEVEL" type="number" sx={{ width: 160 }}
                    value={castableContext.acquiredLevel}
                    onChange={(e) => setCastableContext((c) => ({ ...c, acquiredLevel: e.target.value }))}
                  />
                </Stack>
              </Box>

              {/* Weapon */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>Weapon</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Sets SOURCEWEAPONSMALLDAMAGE / SOURCEWEAPONLARGEDAMAGE. Min/max participates in Low/Avg/High. Future: auto-populate from a referenced weapon item.
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <TextField size="small" label="Small dmg min" type="number" sx={{ width: 130 }}
                    value={weapon.smallMin} onChange={(e) => setWeapon((w) => ({ ...w, smallMin: e.target.value }))} />
                  <TextField size="small" label="Small dmg max" type="number" sx={{ width: 130 }}
                    value={weapon.smallMax} onChange={(e) => setWeapon((w) => ({ ...w, smallMax: e.target.value }))} />
                  <TextField size="small" label="Large dmg min" type="number" sx={{ width: 130 }}
                    value={weapon.largeMin} onChange={(e) => setWeapon((w) => ({ ...w, largeMin: e.target.value }))} />
                  <TextField size="small" label="Large dmg max" type="number" sx={{ width: 130 }}
                    value={weapon.largeMax} onChange={(e) => setWeapon((w) => ({ ...w, largeMax: e.target.value }))} />
                </Stack>
              </Box>

              {/* Variable overrides */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>Variable overrides</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Three slots for ad-hoc values. Overrides win over all other sources (player, weapon, RAND, context).
                </Typography>
                <Stack spacing={1}>
                  {overrides.map((row, i) => (
                    <Stack key={i} direction="row" spacing={1}>
                      <Autocomplete
                        size="small" freeSolo
                        options={[...KNOWN_VARIABLES].sort()}
                        value={row.name}
                        onChange={(_, v) => setOverrides((prev) => prev.map((r, idx) => (idx === i ? { ...r, name: v || '' } : r)))}
                        onInputChange={(_, v) => setOverrides((prev) => prev.map((r, idx) => (idx === i ? { ...r, name: v || '' } : r)))}
                        renderInput={(params) => <TextField {...params} label={`Override #${i + 1} — variable`} />}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size="small" type="number" label="Value" sx={{ width: 130 }}
                        value={row.value}
                        onChange={(e) => setOverrides((prev) => prev.map((r, idx) => (idx === i ? { ...r, value: e.target.value } : r)))}
                      />
                    </Stack>
                  ))}
                </Stack>
              </Box>

              {/* DOT */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>DOT</Typography>
                <Stack direction="row" spacing={1}>
                  <TextField size="small" label="Duration" type="number"
                    value={duration} onChange={(e) => setDuration(e.target.value)} sx={{ width: 130 }} />
                  <TextField size="small" label="Tick" type="number"
                    value={tick} onChange={(e) => setTick(e.target.value)} sx={{ width: 130 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                    {dotTicks ? `→ ${dotTicks} ticks` : 'leave blank for non-DOT formulas'}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </AccordionDetails>
        </Accordion>

        {selectedPlayers.length === 0 && (
          <Alert severity="info">Check one or more test players on the left to evaluate the formula against them.</Alert>
        )}

        {evalState?.parseError && <Alert severity="error">Parse error: {evalState.parseError}</Alert>}

        {evalState?.unknown?.length > 0 && (
          <Alert severity="error">
            Unknown variable{evalState.unknown.length > 1 ? 's' : ''}: {evalState.unknown.join(', ')}
            {' '}— not in the Hybrasyl variable spec. Check the formula for typos.
          </Alert>
        )}

        {evalState?.assumedZero?.length > 0 && (
          <Alert severity="warning">
            Assuming <strong>0</strong> for {evalState.assumedZero.length} unset variable{evalState.assumedZero.length > 1 ? 's' : ''}:{' '}
            {evalState.assumedZero.join(', ')}. Use an override slot above to set any of these explicitly.
          </Alert>
        )}

        {evalState && !evalState.parseError && !evalState.unknown?.length && selectedPlayers.length > 0 && (
          <>
            <Paper variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Per hit</TableCell>
                    <TableCell align="right">Low</TableCell>
                    <TableCell align="right">Avg</TableCell>
                    <TableCell align="right">High</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {evalState.perPlayer.map((row) => (
                    <PlayerResultRow key={row.player.id} player={row.player} low={row.low} avg={row.avg} high={row.high} />
                  ))}
                </TableBody>
              </Table>
            </Paper>

            {dotTicks && (
              <Paper variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>DOT total ({dotTicks} ticks)</TableCell>
                      <TableCell align="right">Low</TableCell>
                      <TableCell align="right">Avg</TableCell>
                      <TableCell align="right">High</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {evalState.perPlayer.map((row) => {
                      const mult = (r) => (r?.value == null ? null : { ...r, value: r.value * dotTicks });
                      return (
                        <PlayerResultRow
                          key={row.player.id}
                          player={row.player}
                          low={mult(row.low)} avg={mult(row.avg)} high={mult(row.high)}
                        />
                      );
                    })}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </>
        )}
      </Box>

      <TestPlayerDialog
        open={dialogState.open}
        initialPlayer={dialogState.initial}
        onClose={handleCloseDialog}
        onSave={handleSavePlayer}
        onDelete={handleDeletePlayer}
      />
    </Box>
  );
}
