import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Typography, Divider, TextField, Tooltip, IconButton,
  Paper, Autocomplete, Collapse, Switch, FormControlLabel, Checkbox,
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

function computeNpcFilename(prefix, name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '');
  if (!safe) return '';
  const p = (prefix || '').trim().toLowerCase().replace(/\s+/g, '_');
  return p ? `${p}_${safe}.xml` : `npc_${safe}.xml`;
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

// ── Nation autocomplete ───────────────────────────────────────────────────────
function NationPicker({ label, value, onChange, sx }) {
  const libraryIndex = useRecoilValue(libraryIndexState);
  const nationNames = libraryIndex.nations || [];
  return (
    <Autocomplete
      freeSolo options={nationNames} value={value}
      onInputChange={(_, val) => onChange(val)}
      size="small" sx={sx}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────
function NPCEditor({ npc, initialFileName, isArchived, isExisting, onSave, onArchive, onUnarchive, onDirtyChange, saveRef }) {
  const libraryIndex = useRecoilValue(libraryIndexState);
  const itemNames = libraryIndex.items || [];
  const castableNames = libraryIndex.castables || [];
  const castableClasses = libraryIndex.castableClasses || {};
  const npcResponseCalls = libraryIndex.npcResponseCalls || {};
  const npcCallOptions = Object.keys(npcResponseCalls).sort();
  const npcStringKeys = libraryIndex.npcStringKeys || [];

  const [data, setData] = useState(npc);
  const [prefix, setPrefix] = useState('');
  const [fileName, setFileName] = useState(initialFileName || computeNpcFilename('', npc.name));
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName);

  const [openResponses, setOpenResponses] = useState(false);
  const [openStrings, setOpenStrings] = useState(false);
  const [openBank, setOpenBank] = useState(npc.roles.bank !== null);
  const [openPost, setOpenPost] = useState(npc.roles.post !== null);
  const [openRepair, setOpenRepair] = useState(npc.roles.repair !== null);
  const [openVend, setOpenVend] = useState(npc.roles.vend !== null);
  const [openTrain, setOpenTrain] = useState(npc.roles.train !== null);

  const isDirtyRef = useRef(false);

  useEffect(() => {
    setData(npc);
    setPrefix('');
    setFileName(initialFileName || computeNpcFilename('', npc.name));
    setFileNameEdited(!!initialFileName);
    setOpenResponses(false);
    setOpenStrings(false);
    setOpenBank(npc.roles.bank !== null);
    setOpenPost(npc.roles.post !== null);
    setOpenRepair(npc.roles.repair !== null);
    setOpenVend(npc.roles.vend !== null);
    setOpenTrain(npc.roles.train !== null);
    isDirtyRef.current = false;
    onDirtyChange?.(false);
  }, [npc, initialFileName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Regenerate filename when prefix changes (if not manually edited)
  useEffect(() => {
    if (!fileNameEdited) setFileName(computeNpcFilename(prefix, data.name));
  }, [prefix]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirtyLocal = useCallback(() => {
    if (!isDirtyRef.current) { isDirtyRef.current = true; onDirtyChange?.(true); }
  }, [onDirtyChange]);

  const updateData = useCallback((updater) => {
    markDirtyLocal();
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!fileNameEdited) setFileName(computeNpcFilename(prefix, next.name));
      return next;
    });
  }, [fileNameEdited, prefix, markDirtyLocal]);

  const set = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.value }));
  const setRole = (field) => (e) => updateData((d) => ({ ...d, roles: { ...d.roles, [field]: e.target.value } }));

  const handleRegenerate = () => {
    markDirtyLocal();
    setFileName(computeNpcFilename(prefix, data.name));
    setFileNameEdited(false);
  };

  if (saveRef) saveRef.current = () => onSave(data, fileName);

  // ── Role enable/disable ───────────────────────────────────────────────────
  const enableRole = (roleKey, defaultVal) => (checked) => {
    updateData((d) => ({ ...d, roles: { ...d.roles, [roleKey]: checked ? defaultVal : null } }));
    if (roleKey === 'bank') setOpenBank(checked);
    if (roleKey === 'post') setOpenPost(checked);
    if (roleKey === 'repair') setOpenRepair(checked);
    if (roleKey === 'vend') setOpenVend(checked);
    if (roleKey === 'train') setOpenTrain(checked);
  };

  // ── Responses ─────────────────────────────────────────────────────────────
  const addResponse = () =>
    updateData((d) => ({ ...d, responses: [...d.responses, { call: '', response: '' }] }));
  const setResponse = (i, field, val) =>
    updateData((d) => ({
      ...d,
      responses: d.responses.map((r, idx) => idx === i ? { ...r, [field]: val } : r),
    }));
  const removeResponse = (i) =>
    updateData((d) => ({ ...d, responses: d.responses.filter((_, idx) => idx !== i) }));

  // ── Strings ───────────────────────────────────────────────────────────────
  const addString = () =>
    updateData((d) => ({ ...d, strings: [...d.strings, { key: '', message: '' }] }));
  const setString = (i, field, val) =>
    updateData((d) => ({
      ...d,
      strings: d.strings.map((s, idx) => idx === i ? { ...s, [field]: val } : s),
    }));
  const removeString = (i) =>
    updateData((d) => ({ ...d, strings: d.strings.filter((_, idx) => idx !== i) }));

  // ── Post surcharges ───────────────────────────────────────────────────────
  const addSurcharge = () =>
    updateData((d) => ({
      ...d,
      roles: { ...d.roles, post: { ...d.roles.post, surcharges: [...(d.roles.post?.surcharges || []), { nation: '', percent: '' }] } },
    }));
  const setSurcharge = (i, field, val) =>
    updateData((d) => ({
      ...d,
      roles: {
        ...d.roles,
        post: {
          ...d.roles.post,
          surcharges: d.roles.post.surcharges.map((s, idx) => idx === i ? { ...s, [field]: val } : s),
        },
      },
    }));
  const removeSurcharge = (i) =>
    updateData((d) => ({
      ...d,
      roles: { ...d.roles, post: { ...d.roles.post, surcharges: d.roles.post.surcharges.filter((_, idx) => idx !== i) } },
    }));

  // ── Vend items ────────────────────────────────────────────────────────────
  const addVendItem = () =>
    updateData((d) => ({
      ...d,
      roles: { ...d.roles, vend: { ...d.roles.vend, items: [...(d.roles.vend?.items || []), { name: '', quantity: '1', restock: '' }] } },
    }));
  const setVendItem = (i, field, val) =>
    updateData((d) => ({
      ...d,
      roles: {
        ...d.roles,
        vend: {
          ...d.roles.vend,
          items: d.roles.vend.items.map((item, idx) => idx === i ? { ...item, [field]: val } : item),
        },
      },
    }));
  const removeVendItem = (i) =>
    updateData((d) => ({
      ...d,
      roles: { ...d.roles, vend: { ...d.roles.vend, items: d.roles.vend.items.filter((_, idx) => idx !== i) } },
    }));

  // ── Train castables ───────────────────────────────────────────────────────
  const addTrainCastable = () =>
    updateData((d) => ({
      ...d,
      roles: { ...d.roles, train: { ...d.roles.train, castables: [...(d.roles.train?.castables || []), { name: '', type: '', class: '' }] } },
    }));
  const removeTrainCastable = (i) =>
    updateData((d) => ({
      ...d,
      roles: { ...d.roles, train: { ...d.roles.train, castables: d.roles.train.castables.filter((_, idx) => idx !== i) } },
    }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>
            {data.name || '(unnamed npc)'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {isExisting && !isArchived && (
              <Tooltip title="Archive NPC">
                <IconButton size="small" onClick={onArchive}><ArchiveIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
            {isExisting && isArchived && (
              <Tooltip title="Unarchive NPC">
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Prefix" value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                size="small" sx={{ width: 140 }} inputProps={{ maxLength: 64, spellCheck: false }}
              />
              <TextField
                label="Name" value={data.name} onChange={set('name')}
                size="small" required sx={{ flex: 1 }} inputProps={{ maxLength: 255 }}
              />
              <TextField
                label="Display Name" value={data.displayName} onChange={set('displayName')}
                size="small" sx={{ flex: 1 }} inputProps={{ maxLength: 255 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                label="Sprite" value={data.sprite} onChange={set('sprite')}
                size="small" sx={{ width: 120 }} inputProps={{ maxLength: 64 }}
              />
              <TextField
                label="Portrait" value={data.portrait} onChange={set('portrait')}
                size="small" sx={{ flex: 1 }} inputProps={{ maxLength: 255 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={data.allowDead}
                    onChange={(e) => updateData((d) => ({ ...d, allowDead: e.target.checked }))}
                    size="small"
                  />
                }
                label={<Typography variant="body2">Allow Dead</Typography>}
              />
            </Box>
            <TextField
              label="Comment" value={data.comment} onChange={set('comment')}
              size="small" multiline minRows={2} inputProps={{ maxLength: 500 }}
            />
          </Box>
        </Paper>

        {/* ── Responses ── */}
        <Section title="Responses" open={openResponses} onToggle={() => setOpenResponses((v) => !v)}>
          {data.responses.map((r, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
              <Autocomplete
                freeSolo options={npcCallOptions} value={r.call}
                onInputChange={(_, val) => {
                  const resolved = npcResponseCalls[val] ?? '';
                  updateData((d) => ({
                    ...d,
                    responses: d.responses.map((resp, idx) =>
                      idx === i ? { call: val, response: resolved || (val ? resp.response : '') } : resp
                    ),
                  }));
                }}
                size="small" sx={{ width: 220 }}
                renderInput={(params) => <TextField {...params} label="Call" inputProps={{ ...params.inputProps, maxLength: 128 }} />}
              />
              <TextField
                label="Response" size="small" sx={{ flex: 1 }}
                value={npcResponseCalls[r.call] ?? r.response}
                disabled
                inputProps={{ maxLength: 1024 }}
              />
              <IconButton size="small" color="error" onClick={() => removeResponse(i)} sx={{ mt: 0.5 }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addResponse}>Add Response</Button>
        </Section>

        {/* ── Strings ── */}
        <Section title="Strings" open={openStrings} onToggle={() => setOpenStrings((v) => !v)}>
          {data.strings.map((s, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
              <Autocomplete
                freeSolo
                options={npcStringKeys}
                groupBy={(opt) => opt.category}
                getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.key}
                value={s.key}
                onInputChange={(_, val) => {
                  const found = npcStringKeys.find((sk) => sk.key === val);
                  updateData((d) => ({
                    ...d,
                    strings: d.strings.map((str, idx) =>
                      idx === i ? { key: val, message: found ? found.message : (val ? str.message : '') } : str
                    ),
                  }));
                }}
                size="small" sx={{ width: 220 }}
                renderInput={(params) => (
                  <TextField {...params} label="Key" inputProps={{ ...params.inputProps, maxLength: 128 }} />
                )}
              />
              <TextField
                label="Message" size="small" sx={{ flex: 1 }}
                value={npcStringKeys.find((sk) => sk.key === s.key)?.message ?? s.message}
                disabled
              />
              <IconButton size="small" color="error" onClick={() => removeString(i)} sx={{ mt: 0.5 }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addString}>Add String</Button>
        </Section>

        {/* ── Bank ── */}
        <Section
          title="Bank"
          open={openBank}
          onToggle={() => setOpenBank((v) => !v)}
          enabled={data.roles.bank !== null}
          onEnable={enableRole('bank', { nation: '', discount: '' })}
        >
          {data.roles.bank !== null && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Bank Check (script)" value={data.roles.bankCheck}
                onChange={setRole('bankCheck')}
                size="small" inputProps={{ maxLength: 255 }}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <NationPicker
                  label="Nation" value={data.roles.bank.nation} sx={{ flex: 1 }}
                  onChange={(val) => updateData((d) => ({ ...d, roles: { ...d.roles, bank: { ...d.roles.bank, nation: val } } }))}
                />
                <TextField
                  label="Discount" value={data.roles.bank.discount}
                  onChange={(e) => updateData((d) => ({ ...d, roles: { ...d.roles, bank: { ...d.roles.bank, discount: e.target.value } } }))}
                  size="small" sx={{ width: 140 }} inputProps={{ maxLength: 64 }}
                />
              </Box>
            </Box>
          )}
        </Section>

        {/* ── Post ── */}
        <Section
          title="Post"
          open={openPost}
          onToggle={() => setOpenPost((v) => !v)}
          enabled={data.roles.post !== null}
          onEnable={enableRole('post', { nation: '', surcharges: [] })}
        >
          {data.roles.post !== null && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Post Check (script)" value={data.roles.postCheck}
                onChange={setRole('postCheck')}
                size="small" inputProps={{ maxLength: 255 }}
              />
              <NationPicker
                label="Nation" value={data.roles.post.nation}
                onChange={(val) => updateData((d) => ({ ...d, roles: { ...d.roles, post: { ...d.roles.post, nation: val } } }))}
              />
              <Typography variant="caption" color="text.secondary">Surcharges</Typography>
              {data.roles.post.surcharges.map((s, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <NationPicker
                    label="Nation" value={s.nation} sx={{ flex: 1 }}
                    onChange={(val) => setSurcharge(i, 'nation', val)}
                  />
                  <TextField
                    label="Percent" value={s.percent}
                    onChange={(e) => setSurcharge(i, 'percent', e.target.value)}
                    size="small" sx={{ width: 120 }} inputProps={{ maxLength: 32 }}
                  />
                  <IconButton size="small" color="error" onClick={() => removeSurcharge(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={addSurcharge}>Add Surcharge</Button>
            </Box>
          )}
        </Section>

        {/* ── Repair ── */}
        <Section
          title="Repair"
          open={openRepair}
          onToggle={() => setOpenRepair((v) => !v)}
          enabled={data.roles.repair !== null}
          onEnable={enableRole('repair', { nation: '', discount: '', type: '' })}
        >
          {data.roles.repair !== null && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Repair Check (script)" value={data.roles.repairCheck}
                onChange={setRole('repairCheck')}
                size="small" inputProps={{ maxLength: 255 }}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <NationPicker
                  label="Nation" value={data.roles.repair.nation} sx={{ flex: 1 }}
                  onChange={(val) => updateData((d) => ({ ...d, roles: { ...d.roles, repair: { ...d.roles.repair, nation: val } } }))}
                />
                <TextField
                  label="Discount" value={data.roles.repair.discount}
                  onChange={(e) => updateData((d) => ({ ...d, roles: { ...d.roles, repair: { ...d.roles.repair, discount: e.target.value } } }))}
                  size="small" sx={{ width: 140 }} inputProps={{ maxLength: 64 }}
                />
                <TextField
                  label="Type" value={data.roles.repair.type}
                  onChange={(e) => updateData((d) => ({ ...d, roles: { ...d.roles, repair: { ...d.roles.repair, type: e.target.value } } }))}
                  size="small" sx={{ width: 120 }} inputProps={{ maxLength: 64 }}
                />
              </Box>
            </Box>
          )}
        </Section>

        {/* ── Vendor ── */}
        <Section
          title="Vendor"
          open={openVend}
          onToggle={() => setOpenVend((v) => !v)}
          enabled={data.roles.vend !== null}
          onEnable={enableRole('vend', { items: [] })}
        >
          {data.roles.vend !== null && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Vend Check (script)" value={data.roles.vendCheck}
                onChange={setRole('vendCheck')}
                size="small" inputProps={{ maxLength: 255 }}
              />
              {data.roles.vend.items.map((item, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Autocomplete
                    freeSolo options={itemNames} value={item.name}
                    onInputChange={(_, val) => setVendItem(i, 'name', val)}
                    size="small" sx={{ flex: 1 }}
                    renderInput={(params) => <TextField {...params} label="Item" />}
                  />
                  <TextField
                    label="Qty" type="number" value={item.quantity}
                    onChange={(e) => setVendItem(i, 'quantity', e.target.value)}
                    size="small" sx={{ width: 80 }} inputProps={{ min: 1 }}
                  />
                  <TextField
                    label="Restock" type="number" value={item.restock}
                    onChange={(e) => setVendItem(i, 'restock', e.target.value)}
                    size="small" sx={{ width: 90 }} inputProps={{ min: 0 }}
                  />
                  <IconButton size="small" color="error" onClick={() => removeVendItem(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={addVendItem}>Add Item</Button>
            </Box>
          )}
        </Section>

        {/* ── Trainer ── */}
        <Section
          title="Trainer"
          open={openTrain}
          onToggle={() => setOpenTrain((v) => !v)}
          enabled={data.roles.train !== null}
          onEnable={enableRole('train', { castables: [] })}
        >
          {data.roles.train !== null && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Train Check (script)" value={data.roles.trainCheck}
                onChange={setRole('trainCheck')}
                size="small" inputProps={{ maxLength: 255 }}
              />
              {data.roles.train.castables.map((c, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Autocomplete
                    freeSolo options={castableNames} value={c.name}
                    onInputChange={(_, val) => {
                      const autoClass = castableClasses[val] || '';
                      updateData((d) => ({
                        ...d,
                        roles: {
                          ...d.roles,
                          train: {
                            ...d.roles.train,
                            castables: d.roles.train.castables.map((entry, idx) =>
                              idx === i ? { ...entry, name: val, class: autoClass || (val ? entry.class : '') } : entry
                            ),
                          },
                        },
                      }));
                    }}
                    size="small" sx={{ flex: 1 }}
                    renderInput={(params) => <TextField {...params} label="Castable" />}
                  />
                  <TextField
                    label="Class" value={castableClasses[c.name] || c.class || ''}
                    size="small" sx={{ flex: 1 }} disabled
                  />
                  <IconButton size="small" color="error" onClick={() => removeTrainCastable(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={addTrainCastable}>Add Castable</Button>
            </Box>
          )}
        </Section>

        <Box sx={{ height: 32 }} />
      </Box>
    </Box>
  );
}

export default NPCEditor;
