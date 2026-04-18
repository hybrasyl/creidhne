import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box,
  Button,
  Typography,
  Divider,
  TextField,
  Tooltip,
  IconButton,
  Paper,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import ArchiveIcon from '@mui/icons-material/Archive'
import UnarchiveIcon from '@mui/icons-material/Unarchive'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import CloseIcon from '@mui/icons-material/Close'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import CommentField from '../shared/CommentField'

// TODO: Fill in variable descriptions for each $ variable
const KNOWN_VARIABLES = [
  { name: '$COINS', desc: '(TODO)' },
  { name: '$DESC', desc: '(TODO)' },
  { name: '$FEE', desc: '(TODO)' },
  { name: '$GOLD', desc: '(TODO)' },
  { name: '$ITEM', desc: '(TODO)' },
  { name: '$LEVEL', desc: '(TODO)' },
  { name: '$NAME', desc: '(TODO)' },
  { name: '$PREREQ', desc: '(TODO)' },
  { name: '$QUANTITY', desc: '(TODO)' },
  { name: '$REF', desc: '(TODO)' },
  { name: '$REPAIRAMT', desc: '(TODO)' },
  { name: '$REQS', desc: '(TODO)' },
  { name: '$SENDER', desc: '(TODO)' },
  { name: '$STATS', desc: '(TODO)' }
]

function deriveLocalizationPrefix(fileName, locale) {
  if (!fileName) return 'str'
  const safe = (locale || '').toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  const base = fileName.replace(/\.xml$/i, '')
  if (safe && base.endsWith(`_${safe}`)) {
    const p = base.slice(0, base.length - safe.length - 1)
    return p || 'str'
  }
  return 'str'
}

function computeFileName(prefix, locale) {
  const safe = (locale || '').toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  return safe ? `${prefix || 'str'}_${safe}.xml` : ''
}

// ── Key + Message row ─────────────────────────────────────────────────────────
function StringRow({ keyVal, message, onChangeKey, onChangeMessage, onDelete }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
      <TextField
        label="Key"
        value={keyVal}
        onChange={(e) => onChangeKey(e.target.value)}
        size="small"
        sx={{ width: 200 }}
        slotProps={{
          htmlInput: { spellCheck: false }
        }}
      />
      <TextField
        label="Message"
        value={message}
        onChange={(e) => onChangeMessage(e.target.value)}
        size="small"
        sx={{ flex: 1 }}
        multiline
        maxRows={3}
      />
      <IconButton size="small" color="error" onClick={onDelete} sx={{ mt: 0.5 }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

// ── Call + Response row ───────────────────────────────────────────────────────
function ResponseRow({ call, response, onChangeCall, onChangeResponse, onDelete }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
      <TextField
        label="Call"
        value={call}
        onChange={(e) => onChangeCall(e.target.value)}
        size="small"
        sx={{ width: 220 }}
      />
      <TextField
        label="Response"
        value={response}
        onChange={(e) => onChangeResponse(e.target.value)}
        size="small"
        sx={{ flex: 1 }}
        multiline
        maxRows={3}
      />
      <IconButton size="small" color="error" onClick={onDelete} sx={{ mt: 0.5 }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

// ── Tab panel wrapper ─────────────────────────────────────────────────────────
function TabPanel({ active, children }) {
  if (!active) return null
  return <Box sx={{ p: 2 }}>{children}</Box>
}

// ── Main editor ───────────────────────────────────────────────────────────────
function LocalizationEditor({
  localization,
  initialFileName,
  isArchived,
  isExisting,
  onSave,
  onArchive,
  onUnarchive,
  onDirtyChange,
  saveRef
}) {
  const [data, setData] = useState(localization)
  const [prefix, setPrefix] = useState(
    deriveLocalizationPrefix(initialFileName, localization.locale)
  )
  const [fileName, setFileName] = useState(
    initialFileName ||
      computeFileName(
        deriveLocalizationPrefix(initialFileName, localization.locale),
        localization.locale
      )
  )
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName)
  const [varsOpen, setVarsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  const isDirtyRef = useRef(false)

  useEffect(() => {
    const derivedPrefix = deriveLocalizationPrefix(initialFileName, localization.locale)
    setData(localization)
    setPrefix(derivedPrefix)
    setFileName(initialFileName || computeFileName(derivedPrefix, localization.locale))
    setFileNameEdited(!!initialFileName)
    setActiveTab(0)
    isDirtyRef.current = false
    onDirtyChange?.(false)
  }, [localization, initialFileName]) // eslint-disable-line react-hooks/exhaustive-deps

  const markDirtyLocal = useCallback(() => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true
      onDirtyChange?.(true)
    }
  }, [onDirtyChange])

  const update = useCallback(
    (updater) => {
      markDirtyLocal()
      setData((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (!fileNameEdited) setFileName(computeFileName(prefix, next.locale))
        return next
      })
    },
    [fileNameEdited, prefix, markDirtyLocal]
  )

  const handlePrefixChange = (e) => {
    const p = e.target.value
    setPrefix(p)
    if (!fileNameEdited) setFileName(computeFileName(p, data.locale))
    markDirtyLocal()
  }

  const handleRegenerate = () => {
    setFileName(computeFileName(prefix, data.locale))
    setFileNameEdited(false)
    markDirtyLocal()
  }

  if (saveRef) saveRef.current = () => onSave(data, fileName)

  // ── Common ────────────────────────────────────────────────────────────────
  const addCommon = () => update((d) => ({ ...d, common: [...d.common, { key: '', message: '' }] }))
  const setCommon = (i, field, val) =>
    update((d) => ({
      ...d,
      common: d.common.map((s, idx) => (idx === i ? { ...s, [field]: val } : s))
    }))
  const removeCommon = (i) =>
    update((d) => ({ ...d, common: d.common.filter((_, idx) => idx !== i) }))

  // ── Merchant ──────────────────────────────────────────────────────────────
  const addMerchant = () =>
    update((d) => ({ ...d, merchant: [...d.merchant, { key: '', message: '' }] }))
  const setMerchant = (i, field, val) =>
    update((d) => ({
      ...d,
      merchant: d.merchant.map((s, idx) => (idx === i ? { ...s, [field]: val } : s))
    }))
  const removeMerchant = (i) =>
    update((d) => ({ ...d, merchant: d.merchant.filter((_, idx) => idx !== i) }))

  // ── NpcSpeak ──────────────────────────────────────────────────────────────
  const addNpcSpeak = () =>
    update((d) => ({ ...d, npcSpeak: [...d.npcSpeak, { key: '', message: '' }] }))
  const setNpcSpeak = (i, field, val) =>
    update((d) => ({
      ...d,
      npcSpeak: d.npcSpeak.map((s, idx) => (idx === i ? { ...s, [field]: val } : s))
    }))
  const removeNpcSpeak = (i) =>
    update((d) => ({ ...d, npcSpeak: d.npcSpeak.filter((_, idx) => idx !== i) }))

  // ── MonsterSpeak ──────────────────────────────────────────────────────────
  const addMonster = () =>
    update((d) => ({ ...d, monsterSpeak: [...d.monsterSpeak, { key: '', message: '' }] }))
  const setMonster = (i, field, val) =>
    update((d) => ({
      ...d,
      monsterSpeak: d.monsterSpeak.map((s, idx) => (idx === i ? { ...s, [field]: val } : s))
    }))
  const removeMonster = (i) =>
    update((d) => ({ ...d, monsterSpeak: d.monsterSpeak.filter((_, idx) => idx !== i) }))

  // ── NpcResponses ──────────────────────────────────────────────────────────
  const addNpc = () =>
    update((d) => ({ ...d, npcResponses: [...d.npcResponses, { call: '', response: '' }] }))
  const setNpc = (i, field, val) =>
    update((d) => ({
      ...d,
      npcResponses: d.npcResponses.map((r, idx) => (idx === i ? { ...r, [field]: val } : r))
    }))
  const removeNpc = (i) =>
    update((d) => ({ ...d, npcResponses: d.npcResponses.filter((_, idx) => idx !== i) }))

  const TABS = [
    {
      label: 'Common',
      count: data.common.length,
      add: addCommon,
      addLabel: 'Add String',
      content: data.common.map((s, i) => (
        <StringRow
          key={i}
          keyVal={s.key}
          message={s.message}
          onChangeKey={(v) => setCommon(i, 'key', v)}
          onChangeMessage={(v) => setCommon(i, 'message', v)}
          onDelete={() => removeCommon(i)}
        />
      ))
    },
    {
      label: 'Merchant',
      count: data.merchant.length,
      add: addMerchant,
      addLabel: 'Add String',
      content: data.merchant.map((s, i) => (
        <StringRow
          key={i}
          keyVal={s.key}
          message={s.message}
          onChangeKey={(v) => setMerchant(i, 'key', v)}
          onChangeMessage={(v) => setMerchant(i, 'message', v)}
          onDelete={() => removeMerchant(i)}
        />
      ))
    },
    {
      label: 'NPC Speak',
      count: data.npcSpeak.length,
      add: addNpcSpeak,
      addLabel: 'Add String',
      content: data.npcSpeak.map((s, i) => (
        <StringRow
          key={i}
          keyVal={s.key}
          message={s.message}
          onChangeKey={(v) => setNpcSpeak(i, 'key', v)}
          onChangeMessage={(v) => setNpcSpeak(i, 'message', v)}
          onDelete={() => removeNpcSpeak(i)}
        />
      ))
    },
    {
      label: 'Monster',
      count: data.monsterSpeak.length,
      add: addMonster,
      addLabel: 'Add String',
      content: data.monsterSpeak.map((s, i) => (
        <StringRow
          key={i}
          keyVal={s.key}
          message={s.message}
          onChangeKey={(v) => setMonster(i, 'key', v)}
          onChangeMessage={(v) => setMonster(i, 'message', v)}
          onDelete={() => removeMonster(i)}
        />
      ))
    },
    {
      label: 'NPC Response',
      count: data.npcResponses.length,
      add: addNpc,
      addLabel: 'Add Response',
      content: data.npcResponses.map((r, i) => (
        <ResponseRow
          key={i}
          call={r.call}
          response={r.response}
          onChangeCall={(v) => setNpc(i, 'call', v)}
          onChangeResponse={(v) => setNpc(i, 'response', v)}
          onDelete={() => removeNpc(i)}
        />
      ))
    }
  ]

  const tab = TABS[activeTab]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Title + actions ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          flexShrink: 0
        }}
      >
        <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>
          {data.locale || '(unnamed localization)'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {isExisting && !isArchived && (
            <Tooltip title="Archive localization">
              <IconButton size="small" onClick={onArchive}>
                <ArchiveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {isExisting && isArchived && (
            <Tooltip title="Unarchive localization">
              <IconButton size="small" onClick={onUnarchive}>
                <UnarchiveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Button
            variant="contained"
            size="small"
            startIcon={<SaveIcon />}
            onClick={() => onSave(data, fileName)}
          >
            Save
          </Button>
        </Box>
      </Box>
      {/* ── Filename row ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pb: 1, flexShrink: 0 }}>
        <TextField
          size="small"
          label="Filename"
          value={fileName}
          onChange={(e) => {
            markDirtyLocal()
            setFileName(e.target.value)
            setFileNameEdited(true)
          }}
          sx={{ flex: 1 }}
          slotProps={{
            htmlInput: { spellCheck: false }
          }}
        />
        <Tooltip title="Regenerate from prefix + locale">
          <IconButton size="small" onClick={handleRegenerate}>
            <AutorenewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      {/* ── Metadata on Paper ── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField
            label="Prefix"
            size="small"
            value={prefix}
            sx={{ width: 140 }}
            onChange={handlePrefixChange}
            slotProps={{
              htmlInput: { maxLength: 64, spellCheck: false }
            }}
          />
          <TextField
            label="Locale Name"
            value={data.locale}
            size="small"
            sx={{ flex: 1 }}
            onChange={(e) => update((d) => ({ ...d, locale: e.target.value }))}
            helperText="Format: en-us"
            slotProps={{
              htmlInput: { spellCheck: false }
            }}
          />
        </Box>
        <CommentField
          value={data.comment}
          onChange={(e) => update((d) => ({ ...d, comment: e.target.value }))}
          sx={{ mb: 1 }}
        />
        <Box>
          <Tooltip title="View $ variables">
            <Button size="small" startIcon={<InfoOutlinedIcon />} onClick={() => setVarsOpen(true)}>
              Variables
            </Button>
          </Tooltip>
        </Box>
      </Paper>
      {/* ── Tabs on Paper ── */}
      <Paper
        variant="outlined"
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}
          variant="scrollable"
          scrollButtons="auto"
        >
          {TABS.map((t, i) => (
            <Tab key={i} label={`${t.label}${t.count > 0 ? ` (${t.count})` : ''}`} />
          ))}
        </Tabs>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Box sx={{ p: 2 }}>
            <Box sx={{ mb: 1.5 }}>
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={tab.add}>
                {tab.addLabel}
              </Button>
            </Box>
            {tab.content}
          </Box>
        </Box>
      </Paper>
      {/* ── Variables Drawer ── */}
      <Drawer anchor="right" open={varsOpen} onClose={() => setVarsOpen(false)}>
        <Box sx={{ width: 300, p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" sx={{ flex: 1 }}>
              $ Variables
            </Typography>
            <IconButton size="small" onClick={() => setVarsOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              mb: 1,
              display: 'block'
            }}>
            TODO: fill in variable descriptions
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <List dense disablePadding>
            {KNOWN_VARIABLES.map((v) => (
              <ListItem key={v.name} disablePadding sx={{ py: 0.25 }}>
                <ListItemText
                  primary={v.name}
                  secondary={v.desc}
                  slotProps={{
                    primary: { variant: 'body2', fontFamily: 'monospace' },
                    secondary: { variant: 'caption' }
                  }} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </Box>
  );
}

export default LocalizationEditor
