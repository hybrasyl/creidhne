import {
  Box, TextField, Switch, Typography, Divider,
  IconButton, Button, FormControlLabel, Checkbox,
  Select, MenuItem, FormControl, InputLabel, Autocomplete,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useRecoilValue } from 'recoil';
import { libraryIndexState } from '../../../recoil/atoms';
import { PROC_EVENT_TYPES } from '../../../data/itemConstants';
import ScriptAutocomplete from '../../common/ScriptAutocomplete';
import { RemoveStatusRow } from '../../castables/StatusesSection';

const DEFAULT_TELEPORT = { map: '', x: 0, y: 0 };
const DEFAULT_EFFECT = { id: 0, speed: 100 };
const DEFAULT_SOUND = { id: 1 };
const DEFAULT_ADD_STATUS = { name: '', duration: 0, intensity: 1.0, tick: 0, removeChance: '', persistDeath: false };
const DEFAULT_REMOVE_STATUS = { name: '', isCategory: false, quantity: '' };
const DEFAULT_PROC = { type: 'OnUse', sourceType: '', castable: '', script: '', chance: '0' };

// data: { use, motions, procs }
// onChange: (updated) => void  — updated always includes all three keys
function UseTab({ data, onChange }) {
  const libraryIndex = useRecoilValue(libraryIndexState);
  const castableNames = libraryIndex.castables || [];
  const mapNames = libraryIndex.maps || [];
  const statusNames = libraryIndex.statuses || [];
  const statusCategories = libraryIndex.statusCategories || [];
  const motionOptions = libraryIndex.motions || [];

  const u = data.use;

  // ── Use effect helpers ──────────────────────────────────────────────────────
  const toggleSub = (key, def) => (e) =>
    onChange({ ...data, use: { ...u, [key]: e.target.checked ? { ...def } : null } });

  const setSubField = (key, field) => (e) =>
    onChange({ ...data, use: { ...u, [key]: { ...u[key], [field]: e.target.value } } });

  const setStatuses = (updated) =>
    onChange({ ...data, use: { ...u, statuses: updated } });

  const addAddStatus = () =>
    setStatuses({ ...u.statuses, add: [...u.statuses.add, { ...DEFAULT_ADD_STATUS }] });
  const setAddStatus = (index, field, val) =>
    setStatuses({ ...u.statuses, add: u.statuses.add.map((s, i) => i === index ? { ...s, [field]: val } : s) });
  const removeAddStatus = (index) =>
    setStatuses({ ...u.statuses, add: u.statuses.add.filter((_, i) => i !== index) });

  const addRemoveStatus = () =>
    setStatuses({ ...u.statuses, remove: [...u.statuses.remove, { ...DEFAULT_REMOVE_STATUS }] });
  const updateRemoveStatus = (index, val) =>
    setStatuses({ ...u.statuses, remove: u.statuses.remove.map((s, i) => i === index ? val : s) });
  const deleteRemoveStatus = (index) =>
    setStatuses({ ...u.statuses, remove: u.statuses.remove.filter((_, i) => i !== index) });

  // ── Motions helpers ─────────────────────────────────────────────────────────
  const addMotion = () =>
    onChange({ ...data, motions: [...data.motions, { id: '', speed: '' }] });
  const setMotion = (index, field, val) =>
    onChange({ ...data, motions: data.motions.map((m, i) => i === index ? { ...m, [field]: val } : m) });
  const removeMotion = (index) =>
    onChange({ ...data, motions: data.motions.filter((_, i) => i !== index) });

  // ── Procs helpers ───────────────────────────────────────────────────────────
  const addProc = () =>
    onChange({ ...data, procs: [...data.procs, { ...DEFAULT_PROC }] });
  const setProc = (index, field, val) =>
    onChange({ ...data, procs: data.procs.map((p, i) => i === index ? { ...p, [field]: val } : p) });
  const removeProc = (index) =>
    onChange({ ...data, procs: data.procs.filter((_, i) => i !== index) });

  return (
    <Box>
      {/* Use effect content — only when use is enabled */}
      {u !== null && (
        <>
          <ScriptAutocomplete
            label="Script" fullWidth sx={{ mb: 2 }}
            value={u.script || ''}
            onChange={(val) => onChange({ ...data, use: { ...u, script: val } })}
          />

          {/* Teleport */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: u.teleport !== null ? 1 : 2 }}>
            <Typography variant="body2" sx={{ flex: 1 }}>Teleport</Typography>
            <Switch size="small" checked={u.teleport !== null} onChange={toggleSub('teleport', DEFAULT_TELEPORT)} />
          </Box>
          {u.teleport !== null && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', pl: 2, mb: 2 }}>
              <Autocomplete
                options={mapNames} value={u.teleport.map || null}
                onChange={(_, val) => onChange({ ...data, use: { ...u, teleport: { ...u.teleport, map: val || '' } } })}
                size="small" sx={{ flex: 1, minWidth: 160 }}
                renderInput={(params) => <TextField {...params} label="Map" />}
              />
              <TextField label="X" type="number" value={u.teleport.x} onChange={setSubField('teleport', 'x')}
                inputProps={{ min: 0, max: 255 }} size="small" sx={{ width: 100 }} />
              <TextField label="Y" type="number" value={u.teleport.y} onChange={setSubField('teleport', 'y')}
                inputProps={{ min: 0, max: 255 }} size="small" sx={{ width: 100 }} />
            </Box>
          )}

          {/* Effect */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: u.effect !== null ? 1 : 2 }}>
            <Typography variant="body2" sx={{ flex: 1 }}>Effect</Typography>
            <Switch size="small" checked={u.effect !== null} onChange={toggleSub('effect', DEFAULT_EFFECT)} />
          </Box>
          {u.effect !== null && (
            <Box sx={{ display: 'flex', gap: 2, pl: 2, mb: 2 }}>
              <TextField label="Effect ID" type="number" value={u.effect.id} onChange={setSubField('effect', 'id')}
                inputProps={{ min: 0, max: 65535 }} size="small" sx={{ width: 130 }} />
              <TextField label="Speed" type="number" value={u.effect.speed} onChange={setSubField('effect', 'speed')}
                inputProps={{ min: 0, max: 255 }} size="small" sx={{ width: 110 }} />
            </Box>
          )}

          {/* Sound */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: u.sound !== null ? 1 : 2 }}>
            <Typography variant="body2" sx={{ flex: 1 }}>Sound</Typography>
            <Switch size="small" checked={u.sound !== null} onChange={toggleSub('sound', DEFAULT_SOUND)} />
          </Box>
          {u.sound !== null && (
            <Box sx={{ pl: 2, mb: 2 }}>
              <TextField label="Sound ID" type="number" value={u.sound.id} onChange={setSubField('sound', 'id')}
                inputProps={{ min: 0, max: 255 }} size="small" sx={{ width: 130 }} />
            </Box>
          )}

          <Divider sx={{ my: 1 }} />

          {/* Add Statuses */}
          <Typography variant="subtitle2" gutterBottom>Add Statuses</Typography>
          {u.statuses.add.map((s, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
              <Autocomplete
                options={statusNames} value={s.name || null}
                onChange={(_, val) => setAddStatus(index, 'name', val || '')}
                size="small" sx={{ flex: 1, minWidth: 140 }}
                renderInput={(params) => <TextField {...params} label="Status Name" />}
              />
              <TextField label="Duration" type="number" value={s.duration} size="small" sx={{ width: 100 }}
                onChange={(e) => setAddStatus(index, 'duration', e.target.value)} />
              <TextField label="Intensity" type="number" value={s.intensity} size="small" sx={{ width: 100 }}
                onChange={(e) => setAddStatus(index, 'intensity', e.target.value)} inputProps={{ step: 0.1 }} />
              <TextField label="Tick" type="number" value={s.tick} size="small" sx={{ width: 90 }}
                onChange={(e) => setAddStatus(index, 'tick', e.target.value)} />
              <TextField label="Remove Chance" value={s.removeChance} size="small" sx={{ width: 130 }}
                onChange={(e) => setAddStatus(index, 'removeChance', e.target.value)} />
              <FormControlLabel
                control={<Checkbox size="small" checked={s.persistDeath}
                  onChange={(e) => setAddStatus(index, 'persistDeath', e.target.checked)} />}
                label="Persist Death"
              />
              <IconButton size="small" color="error" onClick={() => removeAddStatus(index)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button startIcon={<AddIcon />} size="small" onClick={addAddStatus} sx={{ mb: 1 }}>
            Add Status
          </Button>

          {/* Remove Statuses — reuses castable RemoveStatusRow */}
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>Remove Statuses</Typography>
          {u.statuses.remove.map((s, index) => (
            <RemoveStatusRow
              key={index}
              entry={s}
              statusNames={statusNames}
              categoryNames={statusCategories}
              onChange={(val) => updateRemoveStatus(index, val)}
              onRemove={() => deleteRemoveStatus(index)}
            />
          ))}
          <Button startIcon={<AddIcon />} size="small" onClick={addRemoveStatus} sx={{ mb: 1 }}>
            Remove Status
          </Button>

          <Divider sx={{ my: 1 }} />
        </>
      )}

      {/* Motions — always shown */}
      <Typography variant="subtitle2" gutterBottom>Motions</Typography>
      {data.motions.map((motion, index) => {
        const matched = motionOptions.find((m) => String(m.id) === String(motion.id));
        return (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
            <Autocomplete
              options={motionOptions}
              value={matched || null}
              onChange={(_, val) => {
                if (val) {
                  onChange({ ...data, motions: data.motions.map((m, i) =>
                    i === index ? { id: String(val.id), speed: String(val.speed) } : m) });
                }
              }}
              getOptionLabel={(opt) => opt.name}
              size="small" sx={{ flex: 1, minWidth: 160 }}
              renderInput={(params) => <TextField {...params} label="Motion" />}
            />
            <TextField label="ID" type="number" value={motion.id} size="small" sx={{ width: 90 }}
              onChange={(e) => setMotion(index, 'id', e.target.value)} />
            <TextField label="Speed" type="number" value={motion.speed} size="small" sx={{ width: 90 }}
              onChange={(e) => setMotion(index, 'speed', e.target.value)} />
            <IconButton size="small" color="error" onClick={() => removeMotion(index)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      })}
      <Button startIcon={<AddIcon />} size="small" onClick={addMotion} sx={{ mb: 1 }}>
        Add Motion
      </Button>

      <Divider sx={{ my: 1 }} />

      {/* Procs — always shown */}
      <Typography variant="subtitle2" gutterBottom>Procs</Typography>
      {data.procs.map((proc, index) => {
        // For existing procs loaded from XML (no sourceType stored), derive it
        const sourceType = proc.sourceType || (proc.castable ? 'Castable' : proc.script ? 'Script' : '');
        const switchSource = (newType) => {
          onChange({ ...data, procs: data.procs.map((p, i) =>
            i === index ? { ...p, sourceType: newType, castable: '', script: '' } : p) });
        };
        return (
          <Box key={index} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Event Type</InputLabel>
              <Select value={proc.type} label="Event Type" onChange={(e) => setProc(index, 'type', e.target.value)}>
                {PROC_EVENT_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Source</InputLabel>
              <Select value={sourceType} label="Source" onChange={(e) => switchSource(e.target.value)}
                displayEmpty>
                <MenuItem value=""><em>—</em></MenuItem>
                <MenuItem value="Castable">Castable</MenuItem>
                <MenuItem value="Script">Script</MenuItem>
              </Select>
            </FormControl>
            {sourceType === 'Castable' && (
              <Autocomplete
                options={castableNames} value={proc.castable || null}
                onChange={(_, val) => setProc(index, 'castable', val ?? '')}
                size="small" sx={{ flex: 1, minWidth: 160 }}
                renderInput={(params) => <TextField {...params} label="Castable" />}
              />
            )}
            {sourceType === 'Script' && (
              <ScriptAutocomplete
                label="Script" sx={{ flex: 1, minWidth: 160 }}
                value={proc.script || ''}
                onChange={(val) => setProc(index, 'script', val)}
              />
            )}
            {sourceType && (
              <TextField label="Chance" type="number" value={proc.chance} size="small" sx={{ width: 100 }}
                onChange={(e) => setProc(index, 'chance', e.target.value)}
                inputProps={{ min: 0, max: 1, step: 0.01 }} />
            )}
            <IconButton size="small" color="error" onClick={() => removeProc(index)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      })}
      <Button startIcon={<AddIcon />} size="small" onClick={addProc}>
        Add Proc
      </Button>
    </Box>
  );
}

export default UseTab;
