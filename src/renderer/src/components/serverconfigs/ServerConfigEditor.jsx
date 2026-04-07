import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Typography, Divider, TextField, IconButton,
  Paper, Collapse, Switch, Tabs, Tab, Select, MenuItem, FormControl,
  InputLabel, FormControlLabel, Checkbox,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditorHeader from '../shared/EditorHeader';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

// ── Enums ─────────────────────────────────────────────────────────────────────
const LOG_LEVELS = ['All', 'Debug', 'Info', 'Warn', 'Error', 'Fatal', 'None'];
const LOG_TYPES = ['General', 'Scripting', 'GmActivity', 'UserActivity', 'Spawn', 'Packet', 'WorldData'];
const MESSAGE_TYPES = ['Mail', 'BoardMessage', 'Say', 'Shout', 'Whisper', 'GuildChat', 'GroupChat', 'RegionalChat', 'GMChat'];

const DEFAULT_DEATH = {
  active: true, perishable: true, groupNotify: true,
  map: { x: '', y: '', value: '' },
  coma: { timeout: '30', effect: '24', value: '' },
  penalty: { xp: '0.05', hp: '0.05' },
  legendMark: { prefix: 'deaths', increment: true, value: '' },
};

const DEFAULT_LOG = { type: 'General', destination: '', level: 'Info' };
const DEFAULT_AGE = { name: '', startDate: '', endDate: '', startYear: '' };
const DEFAULT_BOARD = { name: '', displayName: '', accessList: { read: [], write: [], moderate: [] } };
const DEFAULT_PLUGIN = { type: 'Mail', passthrough: false, name: '', configuration: [], targets: [] };
const DEFAULT_CLIENT_SETTING = { number: '', key: '', default: false, value: '' };

const CONSTANT_FIELDS = [
  ['MerchantBuybackPercentage', 'Merchant Buyback %'],
  ['PlayerMaxLevel', 'Player Max Level'],
  ['ViewportSize', 'Viewport Size'],
  ['PlayerMaxBookSize', 'Max Book Size'],
  ['PlayerMaxDropDistance', 'Max Drop Distance'],
  ['PlayerPickupDistance', 'Pickup Distance'],
  ['PlayerExchangeDistance', 'Exchange Distance'],
  ['PlayerMaxCastDistance', 'Max Cast Distance'],
  ['PlayerMaxGold', 'Max Gold'],
  ['ItemVariantIdStart', 'Item Variant ID Start'],
  ['LogDefaultLevels', 'Log Default Levels'],
  ['PlayerGroupSharingDistance', 'Group Sharing Distance'],
  ['PlayerAsyncDialogDistance', 'Async Dialog Distance'],
  ['LagMap', 'Lag Map ID'],
  ['NationalSpawnTimeout', 'National Spawn Timeout'],
  ['DeathpileGroupTimeout', 'Deathpile Group Timeout'],
  ['DeathpileOtherTimeout', 'Deathpile Other Timeout'],
  ['MonsterLootDropTimeout', 'Monster Loot Drop Timeout'],
  ['MonsterTaggingTimeout', 'Monster Tagging Timeout'],
  ['ByteHeartbeatInterval', 'Byte Heartbeat Interval'],
  ['TickHeartbeatInterval', 'Tick Heartbeat Interval'],
  ['HeartbeatReaperInterval', 'Heartbeat Reaper Interval'],
  ['CheckpointInterval', 'Checkpoint Interval'],
  ['RegenInterval', 'Regen Interval'],
  ['SnoreInterval', 'Snore Interval'],
  ['IdleDetectionInterval', 'Idle Detection Interval'],
  ['MailboxCleanupInterval', 'Mailbox Cleanup Interval'],
  ['MerchantInventoryRefreshInterval', 'Merchant Inventory Refresh'],
  ['PlayerIdleCheck', 'Player Idle Check'],
  ['DialogSequenceShared', 'Dialog Sequence (Shared)'],
  ['DialogSequencePursuits', 'Dialog Sequence (Pursuits)'],
  ['DialogSequenceAsync', 'Dialog Sequence (Async)'],
  ['DialogSequenceHardcoded', 'Dialog Sequence (Hardcoded)'],
  ['BoardMessageResponseSize', 'Board Message Response Size'],
  ['BoardMessageCooldown', 'Board Message Cooldown'],
  ['MailMessageCooldown', 'Mail Message Cooldown'],
  ['PlayerMinStat', 'Player Min Stat'],
  ['PlayerMaxStat', 'Player Max Stat'],
  ['PlayerMinBaseHpMp', 'Player Min Base HP/MP'],
  ['PlayerMaxBaseHpMp', 'Player Max Base HP/MP'],
  ['PlayerMinDmg', 'Player Min Dmg'],
  ['PlayerMaxDmg', 'Player Max Dmg'],
  ['PlayerMinHit', 'Player Min Hit'],
  ['PlayerMaxHit', 'Player Max Hit'],
  ['PlayerMinMr', 'Player Min MR'],
  ['PlayerMaxMr', 'Player Max MR'],
  ['PlayerMinAc', 'Player Min AC'],
  ['PlayerMaxAc', 'Player Max AC'],
  ['PlayerMinRegen', 'Player Min Regen'],
  ['PlayerMaxRegen', 'Player Max Regen'],
  ['ClassName0', 'Class 0 Name (Peasant)'],
  ['ClassName1', 'Class 1 Name (Warrior)'],
  ['ClassName2', 'Class 2 Name (Rogue)'],
  ['ClassName3', 'Class 3 Name (Wizard)'],
  ['ClassName4', 'Class 4 Name (Priest)'],
  ['ClassName5', 'Class 5 Name (Monk)'],
  ['LevelCircle1', 'Level Circle 1'],
  ['LevelCircle2', 'Level Circle 2'],
  ['LevelCircle3', 'Level Circle 3'],
  ['LevelCircle4', 'Level Circle 4'],
];

const FORMULA_FIELDS = [
  ['XpToNextLevel', 'XP to Next Level'],
  ['HpGainPerLevel', 'HP Gain per Level'],
  ['MpGainPerLevel', 'MP Gain per Level'],
  ['AllowedCarryWeight', 'Allowed Carry Weight'],
  ['AllowedEquipmentWeight', 'Allowed Equipment Weight'],
  ['HpRegenPerTick', 'HP Regen per Tick'],
  ['MpRegenPerTick', 'MP Regen per Tick'],
  ['AcDamageMitigation', 'AC Damage Mitigation'],
  ['AcMagicDamageMitigation', 'AC Magic Damage Mitigation'],
  ['MonsterHpGainPerLevel', 'Monster HP Gain per Level'],
  ['MonsterMpGainPerLevel', 'Monster MP Gain per Level'],
];

// ── Shared components ─────────────────────────────────────────────────────────
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
            size="small" checked={!!enabled}
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

function LevelSelect({ label, value, onChange, options, sx }) {
  return (
    <FormControl size="small" sx={sx}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value || ''} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

// ── Network field group (Lobby / Login / World) ────────────────────────────────
function NetworkInfoRow({ label, value, onChange }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1.5 }}>
      <Typography variant="body2" sx={{ width: 60, mt: 1, flexShrink: 0 }}>{label}</Typography>
      <TextField size="small" label="Bind Address" value={value?.bindAddress ?? ''} onChange={set('bindAddress')} sx={{ flex: 1 }} inputProps={{ spellCheck: false }} />
      <TextField size="small" label="External Address" value={value?.externalAddress ?? ''} onChange={set('externalAddress')} sx={{ flex: 1 }} inputProps={{ spellCheck: false }} />
      <TextField size="small" label="Port" value={value?.port ?? ''} onChange={set('port')} sx={{ width: 90 }} />
    </Box>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function GeneralTab({ data, updateData }) {
  const setField = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.value }));
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField size="small" label="Name" value={data.name} onChange={setField('name')} sx={{ flex: 1 }} />
          <TextField size="small" label="Locale" value={data.locale} onChange={setField('locale')} sx={{ width: 120 }} inputProps={{ spellCheck: false }} />
          <TextField size="small" label="Environment" value={data.environment} onChange={setField('environment')} sx={{ width: 120 }} inputProps={{ spellCheck: false }} />
          <TextField size="small" label="Element Table" value={data.elementTable} onChange={setField('elementTable')} sx={{ width: 140 }} inputProps={{ spellCheck: false }} />
        </Box>
        <TextField
          size="small" label="MOTD" value={data.motd} onChange={setField('motd')}
          multiline minRows={3} inputProps={{ maxLength: 65534 }}
        />
        <TextField
          size="small" label="World Data Directory" value={data.worldDataDir} onChange={setField('worldDataDir')}
          helperText="Server-side path to the world data folder (not in schema, but read by the server)"
          inputProps={{ spellCheck: false }}
        />
      </Box>
    </Paper>
  );
}

function NetworkTab({ data, updateData }) {
  const [openDs, setOpenDs] = useState(true);
  const [openNetwork, setOpenNetwork] = useState(true);
  const [openGrpc, setOpenGrpc] = useState(!!data.network?.grpc);

  const setNet = (server) => (val) =>
    updateData((d) => ({ ...d, network: { ...d.network, [server]: val } }));
  const setDs = (field) => (e) =>
    updateData((d) => ({ ...d, dataStore: { ...d.dataStore, [field]: e.target.value } }));
  const setDsBool = (field) => (e) =>
    updateData((d) => ({ ...d, dataStore: { ...d.dataStore, [field]: e.target.checked } }));

  const enableGrpc = (checked) => {
    updateData((d) => ({
      ...d,
      network: {
        ...d.network,
        grpc: checked ? { bindAddress: '127.0.0.1', externalAddress: '', port: '2613', chainCertFile: '', serverCertFile: '', serverKeyFile: '' } : null,
      },
    }));
    setOpenGrpc(checked);
  };

  const setGrpc = (field) => (e) =>
    updateData((d) => ({ ...d, network: { ...d.network, grpc: { ...d.network.grpc, [field]: e.target.value } } }));

  const ds = data.dataStore;

  return (
    <Box>
      <Section title="Data Store" open={openDs} onToggle={() => setOpenDs((v) => !v)}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
          <TextField size="small" label="Host" value={ds.host} onChange={setDs('host')} sx={{ flex: 1, minWidth: 140 }} inputProps={{ spellCheck: false }} />
          <TextField size="small" label="Port" value={ds.port} onChange={setDs('port')} placeholder="6379" sx={{ width: 100 }} />
          <TextField size="small" label="Database" value={ds.database} onChange={setDs('database')} placeholder="0" sx={{ width: 100 }} />
          <TextField size="small" label="Type" value={ds.type} onChange={setDs('type')} placeholder="redis" sx={{ width: 120 }} inputProps={{ spellCheck: false }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControlLabel
            control={<Checkbox size="small" checked={!!ds.hasCredentials} onChange={setDsBool('hasCredentials')} />}
            label={<Typography variant="body2">Credentials</Typography>}
          />
          {ds.hasCredentials && (
            <>
              <TextField size="small" label="Username" value={ds.username} onChange={setDs('username')} sx={{ flex: 1 }} inputProps={{ spellCheck: false }} />
              <TextField size="small" label="Password" type="password" value={ds.password} onChange={setDs('password')} sx={{ flex: 1 }} />
            </>
          )}
        </Box>
      </Section>

      <Section title="Game Servers" open={openNetwork} onToggle={() => setOpenNetwork((v) => !v)}>
        <NetworkInfoRow label="Lobby" value={data.network?.lobby} onChange={setNet('lobby')} />
        <NetworkInfoRow label="Login" value={data.network?.login} onChange={setNet('login')} />
        <NetworkInfoRow label="World" value={data.network?.world} onChange={setNet('world')} />
      </Section>

      <Section
        title="gRPC (SSL)"
        open={openGrpc}
        onToggle={() => setOpenGrpc((v) => !v)}
        enabled={!!data.network?.grpc}
        onEnable={enableGrpc}
      >
        {data.network?.grpc && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField size="small" label="Bind Address" value={data.network.grpc.bindAddress} onChange={setGrpc('bindAddress')} sx={{ flex: 1 }} inputProps={{ spellCheck: false }} />
              <TextField size="small" label="External Address" value={data.network.grpc.externalAddress} onChange={setGrpc('externalAddress')} sx={{ flex: 1 }} inputProps={{ spellCheck: false }} />
              <TextField size="small" label="Port" value={data.network.grpc.port} onChange={setGrpc('port')} sx={{ width: 90 }} />
            </Box>
            <TextField size="small" label="Chain Certificate File" value={data.network.grpc.chainCertFile} onChange={setGrpc('chainCertFile')} inputProps={{ spellCheck: false }} />
            <TextField size="small" label="Server Certificate File" value={data.network.grpc.serverCertFile} onChange={setGrpc('serverCertFile')} inputProps={{ spellCheck: false }} />
            <TextField size="small" label="Server Key File" value={data.network.grpc.serverKeyFile} onChange={setGrpc('serverKeyFile')} inputProps={{ spellCheck: false }} />
          </Box>
        )}
      </Section>
    </Box>
  );
}

function AccessBoardsTab({ data, updateData }) {
  const [openBoards, setOpenBoards] = useState(data.boards !== null);

  const setAccess = (field) => (e) =>
    updateData((d) => ({ ...d, access: { ...d.access, [field]: e.target.value } }));

  const enableBoards = (checked) => {
    updateData((d) => ({ ...d, boards: checked ? [] : null }));
    setOpenBoards(checked);
  };

  const addBoard = () =>
    updateData((d) => ({ ...d, boards: [...(d.boards || []), { ...DEFAULT_BOARD, accessList: { read: [], write: [], moderate: [] } }] }));
  const removeBoard = (i) =>
    updateData((d) => ({ ...d, boards: d.boards.filter((_, idx) => idx !== i) }));
  const setBoard = (i, field, val) =>
    updateData((d) => ({ ...d, boards: d.boards.map((b, idx) => idx === i ? { ...b, [field]: val } : b) }));

  const setBoardAl = (i, field, val) =>
    updateData((d) => ({
      ...d,
      boards: d.boards.map((b, idx) => idx === i ? { ...b, accessList: { ...b.accessList, [field]: val } } : b),
    }));

  const addModerate = (i) =>
    updateData((d) => ({
      ...d,
      boards: d.boards.map((b, idx) => idx === i
        ? { ...b, accessList: { ...b.accessList, moderate: [...b.accessList.moderate, ''] } }
        : b),
    }));
  const setModerate = (i, mi, val) =>
    updateData((d) => ({
      ...d,
      boards: d.boards.map((b, idx) => idx === i
        ? { ...b, accessList: { ...b.accessList, moderate: b.accessList.moderate.map((m, midx) => midx === mi ? val : m) } }
        : b),
    }));
  const removeModerate = (i, mi) =>
    updateData((d) => ({
      ...d,
      boards: d.boards.map((b, idx) => idx === i
        ? { ...b, accessList: { ...b.accessList, moderate: b.accessList.moderate.filter((_, midx) => midx !== mi) } }
        : b),
    }));

  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            size="small" label="Privileged"
            value={data.access?.privileged ?? ''}
            onChange={setAccess('privileged')}
            helperText="Space-separated names; use * to grant all"
            inputProps={{ spellCheck: false }}
          />
          <TextField
            size="small" label="Reserved"
            value={data.access?.reserved ?? ''}
            onChange={setAccess('reserved')}
            helperText="Space-separated names; these names cannot be registered by players"
            inputProps={{ spellCheck: false }}
          />
        </Box>
      </Paper>

      <Section
        title="Global Boards"
        open={openBoards}
        onToggle={() => setOpenBoards((v) => !v)}
        enabled={data.boards !== null}
        onEnable={enableBoards}
      >
        {(data.boards || []).map((board, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              <TextField size="small" label="Name" value={board.name} onChange={(e) => setBoard(i, 'name', e.target.value)} sx={{ flex: 1 }} inputProps={{ spellCheck: false }} />
              <TextField size="small" label="Display Name" value={board.displayName} onChange={(e) => setBoard(i, 'displayName', e.target.value)} sx={{ flex: 1 }} inputProps={{ maxLength: 255 }} />
              <IconButton size="small" color="error" onClick={() => removeBoard(i)} sx={{ alignSelf: 'center' }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Access List</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                size="small" label="Read" sx={{ flex: 1 }} inputProps={{ spellCheck: false }}
                value={(board.accessList.read || []).join(' ')}
                onChange={(e) => setBoardAl(i, 'read', e.target.value ? e.target.value.split(/\s+/) : [])}
                helperText="Space-separated names or *"
              />
              <TextField
                size="small" label="Write" sx={{ flex: 1 }} inputProps={{ spellCheck: false }}
                value={(board.accessList.write || []).join(' ')}
                onChange={(e) => setBoardAl(i, 'write', e.target.value ? e.target.value.split(/\s+/) : [])}
                helperText="Space-separated names or *"
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Moderators</Typography>
            {(board.accessList.moderate || []).map((m, mi) => (
              <Box key={mi} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                <TextField size="small" value={m} onChange={(e) => setModerate(i, mi, e.target.value)} sx={{ flex: 1 }} inputProps={{ spellCheck: false }} />
                <IconButton size="small" color="error" onClick={() => removeModerate(i, mi)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() => addModerate(i)}>Add Moderator</Button>
          </Paper>
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={addBoard}>Add Board</Button>
      </Section>
    </Box>
  );
}

function TimeTab({ data, updateData }) {
  const [openAges, setOpenAges] = useState(data.time?.ages?.length > 0);
  const [openStart, setOpenStart] = useState(!!data.time?.serverStart?.value);

  const setAge = (i, field, val) =>
    updateData((d) => ({ ...d, time: { ...d.time, ages: d.time.ages.map((a, idx) => idx === i ? { ...a, [field]: val } : a) } }));
  const addAge = () =>
    updateData((d) => ({ ...d, time: { ...d.time, ages: [...(d.time.ages || []), { ...DEFAULT_AGE }] } }));
  const removeAge = (i) =>
    updateData((d) => ({ ...d, time: { ...d.time, ages: d.time.ages.filter((_, idx) => idx !== i) } }));
  const setSs = (field) => (e) =>
    updateData((d) => ({ ...d, time: { ...d.time, serverStart: { ...d.time.serverStart, [field]: e.target.value } } }));

  return (
    <Box>
      <Section title="Ages" open={openAges} onToggle={() => setOpenAges((v) => !v)}>
        {(data.time?.ages || []).map((age, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
            <TextField size="small" label="Name" value={age.name} onChange={(e) => setAge(i, 'name', e.target.value)} sx={{ width: 120 }} inputProps={{ maxLength: 32 }} />
            <TextField size="small" label="Start Date" value={age.startDate} onChange={(e) => setAge(i, 'startDate', e.target.value)} sx={{ flex: 1 }} placeholder="2020-01-01T00:00:00Z" inputProps={{ spellCheck: false }} />
            <TextField size="small" label="End Date" value={age.endDate} onChange={(e) => setAge(i, 'endDate', e.target.value)} sx={{ flex: 1 }} placeholder="optional" inputProps={{ spellCheck: false }} />
            <TextField size="small" label="Start Year" value={age.startYear} onChange={(e) => setAge(i, 'startYear', e.target.value)} sx={{ width: 90 }} placeholder="1" />
            <IconButton size="small" color="error" onClick={() => removeAge(i)} sx={{ mt: 0.5 }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={addAge}>Add Age</Button>
      </Section>

      <Section title="Server Start" open={openStart} onToggle={() => setOpenStart((v) => !v)}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small" label="Date/Time" sx={{ flex: 1, minWidth: 200 }}
            value={data.time?.serverStart?.value ?? ''} onChange={setSs('value')}
            placeholder="2020-01-01T00:00:00Z" inputProps={{ spellCheck: false }}
          />
          <TextField
            size="small" label="Default Age" sx={{ width: 140 }}
            value={data.time?.serverStart?.defaultAge ?? ''} onChange={setSs('defaultAge')}
            inputProps={{ maxLength: 32 }}
          />
          <TextField
            size="small" label="Default Year" sx={{ width: 110 }}
            value={data.time?.serverStart?.defaultYear ?? ''} onChange={setSs('defaultYear')}
          />
        </Box>
      </Section>
    </Box>
  );
}

function HandlersTab({ data, updateData }) {
  const [openDeath, setOpenDeath] = useState(!!data.handlers?.death);
  const [openNewPlayer, setOpenNewPlayer] = useState(true);
  const [openChat, setOpenChat] = useState(!!data.handlers?.chat);

  const enableDeath = (checked) => {
    updateData((d) => ({ ...d, handlers: { ...d.handlers, death: checked ? { ...DEFAULT_DEATH } : null } }));
    setOpenDeath(checked);
  };
  const enableChat = (checked) => {
    updateData((d) => ({ ...d, handlers: { ...d.handlers, chat: checked ? { commandsEnabled: true, commandPrefix: '/' } : null } }));
    setOpenChat(checked);
  };

  const setDeath = (field) => (val) =>
    updateData((d) => ({ ...d, handlers: { ...d.handlers, death: { ...d.handlers.death, [field]: val } } }));
  const setDeathSub = (field, subField) => (e) =>
    updateData((d) => ({
      ...d,
      handlers: {
        ...d.handlers,
        death: { ...d.handlers.death, [field]: { ...d.handlers.death[field], [subField]: e.target.value } },
      },
    }));
  const setDeathBool = (field) => (e) =>
    updateData((d) => ({ ...d, handlers: { ...d.handlers, death: { ...d.handlers.death, [field]: e.target.checked } } }));

  const setChat = (field) => (val) =>
    updateData((d) => ({ ...d, handlers: { ...d.handlers, chat: { ...d.handlers.chat, [field]: val } } }));

  const addStartMap = () =>
    updateData((d) => ({
      ...d,
      handlers: { ...d.handlers, newPlayer: { ...d.handlers.newPlayer, startMaps: [...(d.handlers.newPlayer?.startMaps || []), { x: '', y: '', value: '' }] } },
    }));
  const setStartMap = (i, field, val) =>
    updateData((d) => ({
      ...d,
      handlers: {
        ...d.handlers,
        newPlayer: {
          ...d.handlers.newPlayer,
          startMaps: d.handlers.newPlayer.startMaps.map((sm, idx) => idx === i ? { ...sm, [field]: val } : sm),
        },
      },
    }));
  const removeStartMap = (i) =>
    updateData((d) => ({
      ...d,
      handlers: { ...d.handlers, newPlayer: { ...d.handlers.newPlayer, startMaps: d.handlers.newPlayer.startMaps.filter((_, idx) => idx !== i) } },
    }));

  const death = data.handlers?.death;
  const chat = data.handlers?.chat;
  const startMaps = data.handlers?.newPlayer?.startMaps || [];

  return (
    <Box>
      {/* Death */}
      <Section title="Death" open={openDeath} onToggle={() => setOpenDeath((v) => !v)} enabled={!!death} onEnable={enableDeath}>
        {death && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControlLabel control={<Checkbox size="small" checked={death.active} onChange={setDeathBool('active')} />} label={<Typography variant="body2">Active</Typography>} />
              <FormControlLabel control={<Checkbox size="small" checked={death.perishable} onChange={setDeathBool('perishable')} />} label={<Typography variant="body2">Perishable</Typography>} />
              <FormControlLabel control={<Checkbox size="small" checked={death.groupNotify} onChange={setDeathBool('groupNotify')} />} label={<Typography variant="body2">Group Notify</Typography>} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Death Map</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <TextField size="small" label="Map Name" value={death.map.value} onChange={setDeathSub('map', 'value')} sx={{ flex: 1 }} />
                <TextField size="small" label="X" value={death.map.x} onChange={setDeathSub('map', 'x')} sx={{ width: 80 }} />
                <TextField size="small" label="Y" value={death.map.y} onChange={setDeathSub('map', 'y')} sx={{ width: 80 }} />
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Coma</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <TextField size="small" label="Coma Text" value={death.coma.value} onChange={setDeathSub('coma', 'value')} sx={{ flex: 1 }} />
                <TextField size="small" label="Timeout (s)" value={death.coma.timeout} onChange={setDeathSub('coma', 'timeout')} sx={{ width: 110 }} />
                <TextField size="small" label="Effect ID" value={death.coma.effect} onChange={setDeathSub('coma', 'effect')} sx={{ width: 100 }} />
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Penalty</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <TextField size="small" label="XP Loss %" value={death.penalty.xp} onChange={setDeathSub('penalty', 'xp')} sx={{ width: 120 }} placeholder="0.05" />
                <TextField size="small" label="HP Loss %" value={death.penalty.hp} onChange={setDeathSub('penalty', 'hp')} sx={{ width: 120 }} placeholder="0.05" />
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Legend Mark</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
                <TextField size="small" label="Mark Text" value={death.legendMark.value} onChange={setDeathSub('legendMark', 'value')} sx={{ flex: 1 }} />
                <TextField size="small" label="Prefix" value={death.legendMark.prefix} onChange={setDeathSub('legendMark', 'prefix')} sx={{ width: 120 }} inputProps={{ maxLength: 255 }} />
                <FormControlLabel
                  control={<Checkbox size="small" checked={death.legendMark.increment} onChange={(e) => updateData((d) => ({ ...d, handlers: { ...d.handlers, death: { ...d.handlers.death, legendMark: { ...d.handlers.death.legendMark, increment: e.target.checked } } } }))} />}
                  label={<Typography variant="body2">Increment</Typography>}
                />
              </Box>
            </Box>
          </Box>
        )}
      </Section>

      {/* New Player */}
      <Section title="New Player Start Maps" open={openNewPlayer} onToggle={() => setOpenNewPlayer((v) => !v)}>
        {startMaps.map((sm, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.75 }}>
            <TextField size="small" label="Map Name" value={sm.value} onChange={(e) => setStartMap(i, 'value', e.target.value)} sx={{ flex: 1 }} />
            <TextField size="small" label="X" value={sm.x} onChange={(e) => setStartMap(i, 'x', e.target.value)} sx={{ width: 80 }} />
            <TextField size="small" label="Y" value={sm.y} onChange={(e) => setStartMap(i, 'y', e.target.value)} sx={{ width: 80 }} />
            <IconButton size="small" color="error" onClick={() => removeStartMap(i)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={addStartMap}>Add Start Map</Button>
      </Section>

      {/* Chat */}
      <Section title="Chat" open={openChat} onToggle={() => setOpenChat((v) => !v)} enabled={!!chat} onEnable={enableChat}>
        {chat && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControlLabel
              control={<Checkbox size="small" checked={chat.commandsEnabled} onChange={(e) => setChat('commandsEnabled')(e.target.checked)} />}
              label={<Typography variant="body2">Commands Enabled</Typography>}
            />
            <TextField size="small" label="Command Prefix" value={chat.commandPrefix} onChange={(e) => setChat('commandPrefix')(e.target.value)} sx={{ width: 140 }} inputProps={{ maxLength: 8 }} />
          </Box>
        )}
      </Section>
    </Box>
  );
}

function LoggingTab({ data, updateData }) {
  const [openDensity, setOpenDensity] = useState(true);
  const [openStreams, setOpenStreams] = useState(true);

  const setLogging = (field) => (val) =>
    updateData((d) => ({ ...d, logging: { ...d.logging, [field]: val } }));
  const setLog = (i, field, val) =>
    updateData((d) => ({ ...d, logging: { ...d.logging, logs: d.logging.logs.map((l, idx) => idx === i ? { ...l, [field]: val } : l) } }));
  const addLog = () =>
    updateData((d) => ({ ...d, logging: { ...d.logging, logs: [...(d.logging.logs || []), { ...DEFAULT_LOG }] } }));
  const removeLog = (i) =>
    updateData((d) => ({ ...d, logging: { ...d.logging, logs: d.logging.logs.filter((_, idx) => idx !== i) } }));

  const log = data.logging || {};
  return (
    <Box>
      <Section title="Logging Density" open={openDensity} onToggle={() => setOpenDensity((v) => !v)}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <LevelSelect label="Minimum Level" value={log.minimumLevel} onChange={setLogging('minimumLevel')} options={LOG_LEVELS} sx={{ width: 160 }} />
          <FormControlLabel
            control={<Checkbox size="small" checked={!!log.singleStreamEnabled} onChange={(e) => setLogging('singleStreamEnabled')(e.target.checked)} />}
            label={<Typography variant="body2">Single Stream</Typography>}
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={!!log.jsonOutputEnabled} onChange={(e) => setLogging('jsonOutputEnabled')(e.target.checked)} />}
            label={<Typography variant="body2">JSON Output</Typography>}
          />
        </Box>
      </Section>
      <Section title="Logging Streams" open={openStreams} onToggle={() => setOpenStreams((v) => !v)}>
        {(log.logs || []).map((l, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
            <LevelSelect label="Type" value={l.type} onChange={(val) => setLog(i, 'type', val)} options={LOG_TYPES} sx={{ width: 160 }} />
            <TextField size="small" label="Destination" value={l.destination} onChange={(e) => setLog(i, 'destination', e.target.value)} sx={{ flex: 1 }} inputProps={{ spellCheck: false }} />
            <LevelSelect label="Level" value={l.level} onChange={(val) => setLog(i, 'level', val)} options={LOG_LEVELS} sx={{ width: 130 }} />
            <IconButton size="small" color="error" onClick={() => removeLog(i)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={addLog}>Add Log Stream</Button>
      </Section>
    </Box>
  );
}

function AdvancedTab({ data, updateData }) {
  const [openApi, setOpenApi] = useState(false);
  const [openConst, setOpenConst] = useState(false);
  const [openFormulas, setOpenFormulas] = useState(false);
  const [openClient, setOpenClient] = useState(false);
  const [openPlugins, setOpenPlugins] = useState(false);

  const setEp = (field) => (e) =>
    updateData((d) => ({ ...d, apiEndpoints: { ...d.apiEndpoints, [field]: e.target.value } }));
  const enableMetrics = (checked) =>
    updateData((d) => ({ ...d, apiEndpoints: { ...d.apiEndpoints, metricsEndpoint: checked ? { url: '', apiKey: '' } : null } }));
  const setMetrics = (field) => (e) =>
    updateData((d) => ({ ...d, apiEndpoints: { ...d.apiEndpoints, metricsEndpoint: { ...d.apiEndpoints.metricsEndpoint, [field]: e.target.value } } }));

  const setConst = (key) => (e) =>
    updateData((d) => ({ ...d, constants: { ...d.constants, [key]: e.target.value } }));
  const setFormula = (key) => (e) =>
    updateData((d) => ({ ...d, formulas: { ...d.formulas, [key]: e.target.value } }));

  const addClientSetting = () =>
    updateData((d) => ({ ...d, clientSettings: [...(d.clientSettings || []), { ...DEFAULT_CLIENT_SETTING }] }));
  const removeClientSetting = (i) =>
    updateData((d) => ({ ...d, clientSettings: d.clientSettings.filter((_, idx) => idx !== i) }));
  const setCs = (i, field, val) =>
    updateData((d) => ({ ...d, clientSettings: d.clientSettings.map((s, idx) => idx === i ? { ...s, [field]: val } : s) }));

  const addPlugin = () =>
    updateData((d) => ({ ...d, plugins: { ...d.plugins, message: [...(d.plugins?.message || []), { ...DEFAULT_PLUGIN, configuration: [], targets: [] }] } }));
  const removePlugin = (i) =>
    updateData((d) => ({ ...d, plugins: { ...d.plugins, message: d.plugins.message.filter((_, idx) => idx !== i) } }));
  const setPlugin = (i, field, val) =>
    updateData((d) => ({ ...d, plugins: { ...d.plugins, message: d.plugins.message.map((p, idx) => idx === i ? { ...p, [field]: val } : p) } }));
  const addPluginConfig = (i) =>
    updateData((d) => ({ ...d, plugins: { ...d.plugins, message: d.plugins.message.map((p, idx) => idx === i ? { ...p, configuration: [...p.configuration, { key: '', value: '' }] } : p) } }));
  const setPluginConfig = (i, ci, field, val) =>
    updateData((d) => ({ ...d, plugins: { ...d.plugins, message: d.plugins.message.map((p, idx) => idx === i ? { ...p, configuration: p.configuration.map((c, cidx) => cidx === ci ? { ...c, [field]: val } : c) } : p) } }));
  const removePluginConfig = (i, ci) =>
    updateData((d) => ({ ...d, plugins: { ...d.plugins, message: d.plugins.message.map((p, idx) => idx === i ? { ...p, configuration: p.configuration.filter((_, cidx) => cidx !== ci) } : p) } }));
  const addPluginTarget = (i) =>
    updateData((d) => ({ ...d, plugins: { ...d.plugins, message: d.plugins.message.map((p, idx) => idx === i ? { ...p, targets: [...p.targets, ''] } : p) } }));
  const setPluginTarget = (i, ti, val) =>
    updateData((d) => ({ ...d, plugins: { ...d.plugins, message: d.plugins.message.map((p, idx) => idx === i ? { ...p, targets: p.targets.map((t, tidx) => tidx === ti ? val : t) } : p) } }));
  const removePluginTarget = (i, ti) =>
    updateData((d) => ({ ...d, plugins: { ...d.plugins, message: d.plugins.message.map((p, idx) => idx === i ? { ...p, targets: p.targets.filter((_, tidx) => tidx !== ti) } : p) } }));

  const ep = data.apiEndpoints || {};
  const consts = data.constants || {};
  const formulas = data.formulas || {};

  return (
    <Box>
      {/* API Endpoints */}
      <Section title="API Endpoints" open={openApi} onToggle={() => setOpenApi((v) => !v)}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField size="small" label="Sentry URL" value={ep.sentry ?? ''} onChange={setEp('sentry')} inputProps={{ spellCheck: false }} />
          <TextField size="small" label="Encryption Endpoint" value={ep.encryptionEndpoint ?? ''} onChange={setEp('encryptionEndpoint')} inputProps={{ spellCheck: false }} />
          <TextField size="small" label="Validation Endpoint" value={ep.validationEndpoint ?? ''} onChange={setEp('validationEndpoint')} inputProps={{ spellCheck: false }} />
          <TextField size="small" label="Telemetry Endpoint" value={ep.telemetryEndpoint ?? ''} onChange={setEp('telemetryEndpoint')} inputProps={{ spellCheck: false }} />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControlLabel
              control={<Checkbox size="small" checked={!!ep.metricsEndpoint} onChange={(e) => enableMetrics(e.target.checked)} />}
              label={<Typography variant="body2">Metrics Endpoint</Typography>}
            />
            {ep.metricsEndpoint && (
              <>
                <TextField size="small" label="Metrics URL" value={ep.metricsEndpoint.url ?? ''} onChange={setMetrics('url')} sx={{ flex: 1 }} inputProps={{ spellCheck: false }} />
                <TextField size="small" label="API Key" value={ep.metricsEndpoint.apiKey ?? ''} onChange={setMetrics('apiKey')} sx={{ flex: 1 }} inputProps={{ spellCheck: false }} />
              </>
            )}
          </Box>
        </Box>
      </Section>

      {/* Constants */}
      <Section title="Server Constants" open={openConst} onToggle={() => setOpenConst((v) => !v)}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          {CONSTANT_FIELDS.map(([key, label]) => (
            <TextField
              key={key} size="small" label={label}
              value={consts[key] ?? ''} onChange={setConst(key)}
              inputProps={{ spellCheck: false }}
            />
          ))}
        </Box>
      </Section>

      {/* Formulas */}
      <Section title="Server Formulas" open={openFormulas} onToggle={() => setOpenFormulas((v) => !v)}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {FORMULA_FIELDS.map(([key, label]) => (
            <TextField
              key={key} size="small" fullWidth label={label}
              value={formulas[key] ?? ''} onChange={setFormula(key)}
              inputProps={{ spellCheck: false, style: { fontFamily: 'monospace' } }}
            />
          ))}
        </Box>
      </Section>

      {/* Client Settings */}
      <Section title="Client Settings" open={openClient} onToggle={() => setOpenClient((v) => !v)}>
        {(data.clientSettings || []).map((s, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.75, alignItems: 'center' }}>
            <TextField size="small" label="#" value={s.number} onChange={(e) => setCs(i, 'number', e.target.value)} sx={{ width: 60 }} />
            <TextField size="small" label="Key" value={s.key} onChange={(e) => setCs(i, 'key', e.target.value)} sx={{ width: 140 }} inputProps={{ spellCheck: false }} />
            <TextField size="small" label="Label" value={s.value} onChange={(e) => setCs(i, 'value', e.target.value)} sx={{ flex: 1 }} />
            <FormControlLabel
              control={<Checkbox size="small" checked={!!s.default} onChange={(e) => setCs(i, 'default', e.target.checked)} />}
              label={<Typography variant="body2">Default</Typography>}
            />
            <IconButton size="small" color="error" onClick={() => removeClientSetting(i)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        {(data.clientSettings || []).length < 8 && (
          <Button size="small" startIcon={<AddIcon />} onClick={addClientSetting}>Add Setting</Button>
        )}
      </Section>

      {/* Message Plugins */}
      <Section title="Message Plugins" open={openPlugins} onToggle={() => setOpenPlugins((v) => !v)}>
        {(data.plugins?.message || []).map((p, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center' }}>
              <LevelSelect label="Type" value={p.type} onChange={(val) => setPlugin(i, 'type', val)} options={MESSAGE_TYPES} sx={{ width: 160 }} />
              <TextField size="small" label="Name" value={p.name} onChange={(e) => setPlugin(i, 'name', e.target.value)} sx={{ flex: 1 }} inputProps={{ spellCheck: false }} />
              <FormControlLabel
                control={<Checkbox size="small" checked={!!p.passthrough} onChange={(e) => setPlugin(i, 'passthrough', e.target.checked)} />}
                label={<Typography variant="body2">Passthrough</Typography>}
              />
              <IconButton size="small" color="error" onClick={() => removePlugin(i)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
            <Typography variant="caption" color="text.secondary">Configuration</Typography>
            {p.configuration.map((c, ci) => (
              <Box key={ci} sx={{ display: 'flex', gap: 1, mt: 0.5, mb: 0.5 }}>
                <TextField size="small" label="Key" value={c.key} onChange={(e) => setPluginConfig(i, ci, 'key', e.target.value)} sx={{ flex: 1 }} inputProps={{ spellCheck: false }} />
                <TextField size="small" label="Value" value={c.value} onChange={(e) => setPluginConfig(i, ci, 'value', e.target.value)} sx={{ flex: 1 }} inputProps={{ spellCheck: false }} />
                <IconButton size="small" color="error" onClick={() => removePluginConfig(i, ci)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() => addPluginConfig(i)}>Add Config</Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Targets</Typography>
            {p.targets.map((t, ti) => (
              <Box key={ti} sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <TextField size="small" value={t} onChange={(e) => setPluginTarget(i, ti, e.target.value)} sx={{ flex: 1 }} inputProps={{ spellCheck: false }} />
                <IconButton size="small" color="error" onClick={() => removePluginTarget(i, ti)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() => addPluginTarget(i)} sx={{ mt: 0.5 }}>Add Target</Button>
          </Paper>
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={addPlugin}>Add Plugin</Button>
      </Section>
    </Box>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────
function ServerConfigEditor({ config, initialFileName, isExisting, isArchived, onSave, onArchive, onUnarchive, onDirtyChange, saveRef }) {
  const [data, setData] = useState(config);
  const [fileName, setFileName] = useState(initialFileName || 'config.xml');
  const [activeTab, setActiveTab] = useState(0);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    setData(config);
    setFileName(initialFileName || 'config.xml');
    setActiveTab(0);
    isDirtyRef.current = false;
    onDirtyChange?.(false);
  }, [config, initialFileName]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirtyLocal = useCallback(() => {
    if (!isDirtyRef.current) { isDirtyRef.current = true; onDirtyChange?.(true); }
  }, [onDirtyChange]);

  const updateData = useCallback((updater) => {
    markDirtyLocal();
    setData((prev) => typeof updater === 'function' ? updater(prev) : updater);
  }, [markDirtyLocal]);

  if (saveRef) saveRef.current = () => onSave(data, fileName);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <EditorHeader
        title={data.name || fileName.replace(/\.xml$/i, '')}
        entityLabel="server config"
        fileName={fileName}
        initialFileName={initialFileName}
        computedFileName={fileName}
        isExisting={isExisting}
        isArchived={isArchived}
        onFileNameChange={(val) => { markDirtyLocal(); setFileName(val); }}
        onRegenerate={() => {}}
        onSave={() => onSave(data, fileName)}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />

      <Divider sx={{ flexShrink: 0 }} />

      <Tabs
        value={activeTab} onChange={(_, v) => setActiveTab(v)}
        sx={{ flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}
        variant="scrollable" scrollButtons="auto"
      >
        <Tab label="General" />
        <Tab label="Network" />
        <Tab label="Access & Boards" />
        <Tab label="Time" />
        <Tab label="Handlers" />
        <Tab label="Logging" />
        <Tab label="Advanced" />
      </Tabs>

      <Box sx={{ flex: 1, overflow: 'auto', pt: 2 }}>
        {activeTab === 0 && <GeneralTab data={data} updateData={updateData} />}
        {activeTab === 1 && <NetworkTab data={data} updateData={updateData} />}
        {activeTab === 2 && <AccessBoardsTab data={data} updateData={updateData} />}
        {activeTab === 3 && <TimeTab data={data} updateData={updateData} />}
        {activeTab === 4 && <HandlersTab data={data} updateData={updateData} />}
        {activeTab === 5 && <LoggingTab data={data} updateData={updateData} />}
        {activeTab === 6 && <AdvancedTab data={data} updateData={updateData} />}
        <Box sx={{ height: 32 }} />
      </Box>
    </Box>
  );
}

export default ServerConfigEditor;
