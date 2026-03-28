import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Typography, Divider, TextField, Tooltip, IconButton, Alert, Collapse, Paper,
  Switch, Select, MenuItem, FormControl, InputLabel, FormControlLabel, Checkbox, Autocomplete, Chip,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useRecoilValue } from 'recoil';
import { libraryIndexState } from '../../recoil/atoms';
import StatsTab from './tabs/StatsTab';
import RestrictionsTab from './tabs/RestrictionsTab';
import UseTab from './tabs/UseTab';
import {
  computeItemFilename,
  ITEM_TAGS, ITEM_BODY_STYLES, ITEM_COLORS,
  EQUIPMENT_SLOTS, WEAPON_TYPES, ITEM_FLAGS,
} from '../../data/itemConstants';

const DEFAULT_EQUIPMENT = { slot: 'None', weaponType: 'None' };
const DEFAULT_DAMAGE = { smallMin: '0', smallMax: '0', largeMin: '0', largeMax: '0' };
const DEFAULT_USE = { script: '', teleport: null, effect: null, sound: null, statuses: { add: [], remove: [] } };
const DEFAULT_CAST_MODIFIER = { group: '', castable: '', all: false, add: [], subtract: [], replace: [] };
const DEFAULT_OP = { match: '-1', amount: '0', min: '-1', max: '255' };

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

function deriveFilename(data) {
  return computeItemFilename(
    data.name,
    data.properties.equipment?.slot,
    data.properties.vendor?.shopTab,
  );
}

function ItemEditor({ item, initialFileName, isArchived, isExisting, warnings = [], onSave, onArchive, onUnarchive, onDirtyChange, saveRef }) {
  const libraryIndex = useRecoilValue(libraryIndexState);
  const castableNames = libraryIndex.castables || [];
  const variantGroupNames = libraryIndex.variantgroups || [];

  const [data, setData] = useState(item);
  const [fileName, setFileName] = useState(initialFileName || deriveFilename(item));
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName);
  const [warningsDismissed, setWarningsDismissed] = useState(false);

  const [openAppearance, setOpenAppearance] = useState(true);
  const [openPhysical, setOpenPhysical] = useState(true);
  const [openRestrictions, setOpenRestrictions] = useState(true);
  const [openUse, setOpenUse] = useState(item.properties.use !== null);
  const [openVendor, setOpenVendor] = useState(true);

  const isDirtyRef = useRef(false);

  useEffect(() => {
    setData(item);
    setFileName(initialFileName || deriveFilename(item));
    setFileNameEdited(!!initialFileName);
    setWarningsDismissed(false);
    setOpenUse(item.properties.use !== null);
    isDirtyRef.current = false;
    onDirtyChange?.(false);
  }, [item, initialFileName]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirtyLocal = useCallback(() => {
    if (!isDirtyRef.current) { isDirtyRef.current = true; onDirtyChange?.(true); }
  }, [onDirtyChange]);

  const updateData = useCallback((updater) => {
    markDirtyLocal();
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!fileNameEdited) setFileName(deriveFilename(next));
      return next;
    });
  }, [fileNameEdited, markDirtyLocal]);

  const updateProperties = (slice) =>
    updateData((d) => ({ ...d, properties: { ...d.properties, ...slice } }));

  const setPropField = (key, field) => (e) =>
    updateData((d) => ({
      ...d,
      properties: { ...d.properties, [key]: { ...d.properties[key], [field]: e.target.value } },
    }));

  const handleRegenerate = () => {
    markDirtyLocal();
    setFileName(deriveFilename(data));
    setFileNameEdited(false);
  };

  if (saveRef) saveRef.current = () => onSave(data, fileName);

  const enableEquipment = (checked) =>
    updateProperties({ equipment: checked ? { ...DEFAULT_EQUIPMENT } : null });

  const enableDamage = (checked) =>
    updateProperties({ damage: checked ? { ...DEFAULT_DAMAGE } : null });

  const enableUse = (checked) => {
    updateProperties({ use: checked ? { ...DEFAULT_USE } : null });
    setOpenUse(checked);
  };

  // ── Flags ──────────────────────────────────────────────────────────────────
  const toggleFlag = (flag) => {
    const next = p.flags.includes(flag)
      ? p.flags.filter((f) => f !== flag)
      : [...p.flags, flag];
    updateProperties({ flags: next });
  };

  // ── Categories ─────────────────────────────────────────────────────────────
  const addCategory = () =>
    updateProperties({ categories: [...p.categories, { name: '', unique: false }] });
  const setCategory = (index, val) =>
    updateProperties({ categories: p.categories.map((c, i) => i === index ? { ...c, name: val } : c) });
  const removeCategory = (index) =>
    updateProperties({ categories: p.categories.filter((_, i) => i !== index) });

  // ── Variant Groups ─────────────────────────────────────────────────────────
  const addVariantGroup = () =>
    updateProperties({ variants: { ...p.variants, groups: [...p.variants.groups, ''] } });
  const setVariantGroup = (index, val) =>
    updateProperties({ variants: { ...p.variants, groups: p.variants.groups.map((g, i) => i === index ? val : g) } });
  const removeVariantGroup = (index) =>
    updateProperties({ variants: { ...p.variants, groups: p.variants.groups.filter((_, i) => i !== index) } });

  // ── Cast Modifiers ─────────────────────────────────────────────────────────
  const addCastModifier = () =>
    updateProperties({ castModifiers: [...p.castModifiers, { ...DEFAULT_CAST_MODIFIER }] });
  const setCastModifier = (index, field, val) =>
    updateProperties({ castModifiers: p.castModifiers.map((m, i) => i === index ? { ...m, [field]: val } : m) });
  const removeCastModifier = (index) =>
    updateProperties({ castModifiers: p.castModifiers.filter((_, i) => i !== index) });

  const p = data.properties;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>
            {data.name || '(unnamed item)'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {isExisting && !isArchived && (
              <Tooltip title="Archive item">
                <IconButton size="small" onClick={onArchive}><ArchiveIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
            {isExisting && isArchived && (
              <Tooltip title="Unarchive item">
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
          <Tooltip title="Regenerate from name / slot / vendor">
            <IconButton size="small" onClick={handleRegenerate}><AutorenewIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Divider sx={{ mb: 1, flexShrink: 0 }} />

      {/* Warnings */}
      <Collapse in={warnings.length > 0 && !warningsDismissed} sx={{ flexShrink: 0 }}>
        <Alert severity="warning" onClose={() => setWarningsDismissed(true)} sx={{ mb: 1 }}>
          {warnings.map((w, i) => <div key={i}>{w}</div>)}
        </Alert>
      </Collapse>

      {/* ── Form ── */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>

        {/* ── Basic — no accordion, always visible ── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
          <TextField label="Name" required value={data.name} size="small" inputProps={{ maxLength: 255 }}
            onChange={(e) => updateData((d) => ({ ...d, name: e.target.value }))} />
          <TextField label="Unidentified Name" value={data.unidentifiedName} size="small" inputProps={{ maxLength: 255 }}
            onChange={(e) => updateData((d) => ({ ...d, unidentifiedName: e.target.value }))} />
          <TextField label="Comment" value={data.comment} size="small" multiline minRows={2} inputProps={{ maxLength: 65534 }}
            onChange={(e) => updateData((d) => ({ ...d, comment: e.target.value }))} />
          <FormControlLabel
            control={
              <Checkbox size="small" checked={data.includeInMetafile}
                onChange={(e) => updateData((d) => ({ ...d, includeInMetafile: e.target.checked }))} />
            }
            label="Include in Metafile"
          />
          <Autocomplete
            multiple options={ITEM_TAGS} value={p.tags}
            onChange={(_, val) => updateProperties({ tags: val })}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => <Chip key={option} label={option} size="small" {...getTagProps({ index })} />)
            }
            renderInput={(params) => <TextField {...params} size="small" label="Tags" />}
          />

          {/* Flags */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Flags</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
              {ITEM_FLAGS.map((flag) => (
                <FormControlLabel
                  key={flag}
                  control={
                    <Checkbox checked={p.flags.includes(flag)} onChange={() => toggleFlag(flag)} size="small" />
                  }
                  label={<Typography variant="body2">{flag}</Typography>}
                  sx={{ width: '33%', m: 0 }}
                />
              ))}
            </Box>
          </Box>

          {/* Categories */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Categories</Typography>
            {p.categories.map((cat, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                <TextField label="Category" value={cat.name} size="small" sx={{ flex: 1 }}
                  onChange={(e) => setCategory(index, e.target.value)} inputProps={{ maxLength: 255 }} />
                <IconButton size="small" color="error" onClick={() => removeCategory(index)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button startIcon={<AddIcon />} size="small" onClick={addCategory}>
              Add Category
            </Button>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* ── Appearance ── */}
        <Section title="Appearance" open={openAppearance} onToggle={() => setOpenAppearance((v) => !v)}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField label="Sprite" required type="number" value={p.appearance.sprite} size="small" sx={{ width: 140 }}
                onChange={setPropField('appearance', 'sprite')} inputProps={{ min: 0, max: 65535 }} />
              <TextField label="Equip Sprite" type="number" value={p.appearance.equipSprite} size="small" sx={{ width: 140 }}
                onChange={setPropField('appearance', 'equipSprite')} inputProps={{ min: 0, max: 65535 }} />
              <TextField label="Display Sprite" type="number" value={p.appearance.displaySprite} size="small" sx={{ width: 140 }}
                onChange={setPropField('appearance', 'displaySprite')} inputProps={{ min: 0, max: 65535 }} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ flex: 1 }}>Style Override</Typography>
              <Switch
                size="small"
                checked={p.appearance.styleEnabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  updateData((d) => ({
                    ...d,
                    properties: {
                      ...d.properties,
                      appearance: {
                        ...d.properties.appearance,
                        styleEnabled: checked,
                        ...(checked ? {} : { bodyStyle: 'Transparent', color: 'None', hideBoots: false }),
                      },
                    },
                  }));
                }}
              />
            </Box>
            {p.appearance.styleEnabled && (
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Body Style</InputLabel>
                  <Select value={p.appearance.bodyStyle} label="Body Style" onChange={setPropField('appearance', 'bodyStyle')}>
                    {ITEM_BODY_STYLES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Color</InputLabel>
                  <Select value={p.appearance.color} label="Color" onChange={setPropField('appearance', 'color')}>
                    {ITEM_COLORS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Checkbox size="small" checked={p.appearance.hideBoots}
                      onChange={(e) => updateData((d) => ({
                        ...d,
                        properties: { ...d.properties, appearance: { ...d.properties.appearance, hideBoots: e.target.checked } },
                      }))} />
                  }
                  label="Hide Boots"
                />
              </Box>
            )}
          </Box>
        </Section>

        {/* ── Physical ── */}
        <Section title="Physical" open={openPhysical} onToggle={() => setOpenPhysical((v) => !v)}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Physical fields */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField label="Value" type="number" value={p.physical.value} size="small" sx={{ width: 130 }}
                onChange={setPropField('physical', 'value')} inputProps={{ min: 0, step: 0.01 }} />
              <TextField label="Weight" type="number" value={p.physical.weight} size="small" sx={{ width: 130 }}
                onChange={setPropField('physical', 'weight')} inputProps={{ min: 0, step: 0.01 }} />
              <TextField label="Durability" type="number" value={p.physical.durability} size="small" sx={{ width: 130 }}
                onChange={setPropField('physical', 'durability')} inputProps={{ min: 0, step: 0.01 }} />
              <TextField label="Stack Max" type="number" value={p.stackable.max} size="small" sx={{ width: 130 }}
                onChange={(e) => updateProperties({ stackable: { max: e.target.value } })}
                inputProps={{ min: 1, max: 255 }} />
            </Box>

            {/* Equipment sub-paper */}
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: p.equipment !== null ? 1.5 : 0 }}>
                <Typography variant="body2" sx={{ flex: 1 }}>Equipment</Typography>
                <Switch size="small" checked={p.equipment !== null} onChange={(e) => enableEquipment(e.target.checked)} />
              </Box>
              {p.equipment !== null && (
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Slot</InputLabel>
                    <Select value={p.equipment.slot} label="Slot" onChange={setPropField('equipment', 'slot')}>
                      {EQUIPMENT_SLOTS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Weapon Type</InputLabel>
                    <Select value={p.equipment.weaponType} label="Weapon Type" onChange={setPropField('equipment', 'weaponType')}>
                      {WEAPON_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Box>
              )}
            </Paper>

            {/* Stat Modifiers — only when equipment enabled and slot != None */}
            {p.equipment !== null && p.equipment.slot !== 'None' && (
              <StatsTab
                data={p.statModifiers}
                onChange={(updated) => updateProperties({ statModifiers: updated })}
              />
            )}

            {/* Damage — only when equipment enabled and weaponType != None */}
            {p.equipment !== null && p.equipment.weaponType !== 'None' && (
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: p.damage !== null ? 1.5 : 0 }}>
                  <Typography variant="body2" sx={{ flex: 1 }}>Damage</Typography>
                  <Switch size="small" checked={p.damage !== null} onChange={(e) => enableDamage(e.target.checked)} />
                </Box>
                {p.damage !== null && (
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <TextField label="Small Min" type="number" value={p.damage.smallMin} size="small" sx={{ width: 130 }}
                      onChange={setPropField('damage', 'smallMin')} inputProps={{ step: 0.01 }} />
                    <TextField label="Small Max" type="number" value={p.damage.smallMax} size="small" sx={{ width: 130 }}
                      onChange={setPropField('damage', 'smallMax')} inputProps={{ step: 0.01 }} />
                    <TextField label="Large Min" type="number" value={p.damage.largeMin} size="small" sx={{ width: 130 }}
                      onChange={setPropField('damage', 'largeMin')} inputProps={{ step: 0.01 }} />
                    <TextField label="Large Max" type="number" value={p.damage.largeMax} size="small" sx={{ width: 130 }}
                      onChange={setPropField('damage', 'largeMax')} inputProps={{ step: 0.01 }} />
                  </Box>
                )}
              </Paper>
            )}

            {/* Cast Modifiers — only when equipment enabled and weaponType != None */}
            {p.equipment !== null && p.equipment.weaponType !== 'None' && (
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" gutterBottom>Cast Modifiers</Typography>
                {p.castModifiers.map((cm, cmIdx) => {
                  const updateOps = (field, ops) => setCastModifier(cmIdx, field, ops);
                  const addOp = (field) => updateOps(field, [...cm[field], { ...DEFAULT_OP }]);
                  const setOp = (field, opIdx, key, val) =>
                    updateOps(field, cm[field].map((op, i) => i === opIdx ? { ...op, [key]: val } : op));
                  const removeOp = (field, opIdx) =>
                    updateOps(field, cm[field].filter((_, i) => i !== opIdx));

                  return (
                    <Box key={cmIdx} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, mb: 1 }}>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
                        <TextField label="Group" value={cm.group} size="small" sx={{ flex: 1, minWidth: 120 }}
                          onChange={(e) => setCastModifier(cmIdx, 'group', e.target.value)} inputProps={{ maxLength: 255 }} />
                        <Autocomplete
                          freeSolo options={castableNames} value={cm.castable}
                          onInputChange={(_, val) => setCastModifier(cmIdx, 'castable', val)}
                          size="small" sx={{ flex: 1, minWidth: 160 }}
                          renderInput={(params) => <TextField {...params} label="Castable" />}
                        />
                        <FormControlLabel control={<Checkbox checked={cm.all} size="small"
                          onChange={(e) => setCastModifier(cmIdx, 'all', e.target.checked)} />} label="All" />
                        <IconButton size="small" color="error" onClick={() => removeCastModifier(cmIdx)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      {['add', 'subtract', 'replace'].map((field) => (
                        <Box key={field} sx={{ pl: 1, mb: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                            {field}
                          </Typography>
                          {cm[field].map((op, opIdx) => (
                            <Box key={opIdx} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 0.5 }}>
                              <TextField label="Match" value={op.match} size="small" sx={{ width: 100 }}
                                onChange={(e) => setOp(field, opIdx, 'match', e.target.value)} />
                              <TextField label="Amount" value={op.amount} size="small" sx={{ width: 100 }}
                                onChange={(e) => setOp(field, opIdx, 'amount', e.target.value)} />
                              <TextField label="Min" value={op.min} size="small" sx={{ width: 90 }}
                                onChange={(e) => setOp(field, opIdx, 'min', e.target.value)} />
                              <TextField label="Max" value={op.max} size="small" sx={{ width: 90 }}
                                onChange={(e) => setOp(field, opIdx, 'max', e.target.value)} />
                              <IconButton size="small" color="error" onClick={() => removeOp(field, opIdx)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          ))}
                          <Button size="small" startIcon={<AddIcon />} onClick={() => addOp(field)} sx={{ mt: 0.5 }}>
                            Add {field}
                          </Button>
                        </Box>
                      ))}
                    </Box>
                  );
                })}
                <Button startIcon={<AddIcon />} size="small" onClick={addCastModifier}>
                  Add Match
                </Button>
              </Paper>
            )}
          </Box>
        </Section>

        {/* ── Restrictions ── */}
        <Section title="Restrictions" open={openRestrictions} onToggle={() => setOpenRestrictions((v) => !v)}>
          <RestrictionsTab
            data={{ restrictions: p.restrictions }}
            onChange={(updated) => updateProperties(updated)}
          />
        </Section>

        {/* ── Use Effect (optional) ── */}
        <Section
          title="Use Effect"
          open={openUse} onToggle={() => setOpenUse((v) => !v)}
          enabled={p.use !== null} onEnable={enableUse}
        >
          <UseTab
            data={{ use: p.use, motions: p.motions, procs: p.procs }}
            onChange={(updated) => updateProperties(updated)}
          />
        </Section>

        {/* ── Vendor ── */}
        <Section title="Vendor" open={openVendor} onToggle={() => setOpenVendor((v) => !v)}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Shop Tab" value={p.vendor?.shopTab ?? ''} size="small" inputProps={{ maxLength: 255 }}
              onChange={(e) => updateProperties({ vendor: { ...(p.vendor ?? {}), shopTab: e.target.value } })} />
            <TextField label="Description" value={p.vendor?.description ?? ''} size="small" multiline minRows={2}
              inputProps={{ maxLength: 255 }}
              onChange={(e) => updateProperties({ vendor: { ...(p.vendor ?? {}), description: e.target.value } })} />

            {/* Variant Groups */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>Variant Groups</Typography>
              {p.variants.groups.map((group, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                  <Autocomplete
                    options={variantGroupNames} value={group || null}
                    onChange={(_, val) => setVariantGroup(index, val || '')}
                    size="small" sx={{ flex: 1 }}
                    renderInput={(params) => <TextField {...params} label="Group Name" />}
                  />
                  <IconButton size="small" color="error" onClick={() => removeVariantGroup(index)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button startIcon={<AddIcon />} size="small" onClick={addVariantGroup}>
                Add Variant Group
              </Button>
            </Box>
          </Box>
        </Section>

        <Box sx={{ height: 32 }} />
      </Box>
    </Box>
  );
}

export default ItemEditor;
