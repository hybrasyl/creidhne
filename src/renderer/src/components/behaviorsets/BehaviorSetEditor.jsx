import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRecoilValue } from 'recoil'
import { libraryIndexState } from '../../recoil/atoms'
import {
  Box,
  Button,
  Typography,
  Divider,
  TextField,
  Tooltip,
  IconButton,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Collapse,
  Autocomplete,
  Checkbox,
  FormControlLabel,
  Chip,
  Snackbar,
  Alert
} from '@mui/material'
import ConstantAutocomplete from '../shared/ConstantAutocomplete'
import EditorHeader from '../shared/EditorHeader'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined'
import {
  IMMUNITY_TYPES,
  MESSAGE_TYPES,
  ROTATION_TYPES,
  TARGET_PRIORITY_TYPES,
  DEFAULT_CASTING_SET,
  DEFAULT_CASTING_SET_CASTABLE,
  DEFAULT_COOKIE,
  computeBehaviorSetFilename
} from '../../data/behaviorSetConstants'
import CommentField from '../shared/CommentField'
import StatsTab from '../shared/StatsTab'

const DEFAULT_PREFIX = 'bvs'

function deriveBehaviorSetPrefix(fileName, name) {
  if (!fileName) return DEFAULT_PREFIX
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '')
  const base = fileName.replace(/\.xml$/i, '')
  if (safe && base.endsWith(`_${safe}`)) {
    const p = base.slice(0, base.length - safe.length - 1)
    return p || DEFAULT_PREFIX
  }
  return DEFAULT_PREFIX
}

// ── Section accordion wrapper ─────────────────────────────────────────────────

function Section({ title, open, onToggle, children }) {
  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1,
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onClick={onToggle}
      >
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {title}
        </Typography>
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>
      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2 }}>{children}</Box>
      </Collapse>
    </Paper>
  )
}

// ── Single immunity row ───────────────────────────────────────────────────────

function ImmunityRow({ row, index, libraryIndex, onChangeField, onChangeType, onRemove }) {
  const { type, value, messageType, message } = row

  const valueOptions = (() => {
    switch (type) {
      case 'Element':
        return libraryIndex.elementnames || []
      case 'Castable':
        return libraryIndex.castables || []
      case 'Status':
        return libraryIndex.statuses || []
      default:
        return []
    }
  })()

  const isCategory = type === 'StatusCategory' || type === 'CastableCategory'

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Type</InputLabel>
        <Select value={type} label="Type" onChange={(e) => onChangeType(index, e.target.value)}>
          {IMMUNITY_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {isCategory ? (
        <TextField
          label="Category"
          size="small"
          sx={{ flex: 1, minWidth: 160 }}
          value={value}
          onChange={(e) => onChangeField(index, 'value', e.target.value)}
          placeholder="Category (index not yet built)"
        />
      ) : (
        <Autocomplete
          freeSolo
          options={valueOptions}
          value={value}
          onInputChange={(_, val, reason) => {
            if (reason === 'input') onChangeField(index, 'value', val)
          }}
          onChange={(_, val) => onChangeField(index, 'value', val ?? '')}
          size="small"
          sx={{ flex: 1, minWidth: 160 }}
          renderInput={(params) => <TextField {...params} label={type || 'Value'} />}
        />
      )}

      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Message Type</InputLabel>
        <Select
          value={messageType}
          label="Message Type"
          onChange={(e) => onChangeField(index, 'messageType', e.target.value)}
        >
          {MESSAGE_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Message"
        size="small"
        sx={{ flex: 1, minWidth: 140 }}
        value={message}
        onChange={(e) => onChangeField(index, 'message', e.target.value)}
        inputProps={{ maxLength: 50 }}
      />

      <IconButton size="small" color="error" onClick={() => onRemove(index)}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

// ── Casting set accordion ─────────────────────────────────────────────────────

function CastingSetAccordion({ cs, index, castableOptions, onChange, onRemove }) {
  const libraryIndex = useRecoilValue(libraryIndexState)
  const [open, setOpen] = useState(true)
  const title = `Casting Set ${index + 1} — ${cs.type || 'Unset'}`

  const setField = (field, val) => onChange({ ...cs, [field]: val })

  const addCastable = () =>
    onChange({ ...cs, castables: [...cs.castables, { ...DEFAULT_CASTING_SET_CASTABLE }] })

  const changeCastableField = (i, field, val) =>
    onChange({
      ...cs,
      castables: cs.castables.map((c, idx) => (idx === i ? { ...c, [field]: val } : c))
    })

  const removeCastable = (i) =>
    onChange({ ...cs, castables: cs.castables.filter((_, idx) => idx !== i) })

  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, userSelect: 'none' }}>
        <Box
          sx={{ display: 'flex', flex: 1, alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setOpen((v) => !v)}
        >
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            {title}
          </Typography>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </Box>
        <IconButton size="small" color="error" sx={{ ml: 1 }} onClick={onRemove}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Row 1: Type, Interval, TargetPriority, HealthPercentage, Random */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={cs.type}
                label="Type"
                onChange={(e) => setField('type', e.target.value)}
              >
                {ROTATION_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Interval"
              size="small"
              sx={{ width: 100 }}
              value={cs.interval}
              onChange={(e) => setField('interval', e.target.value.replace(/\D/g, ''))}
              inputProps={{ inputMode: 'numeric' }}
              placeholder="15"
            />

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Target Priority</InputLabel>
              <Select
                value={cs.targetPriority}
                label="Target Priority"
                onChange={(e) => setField('targetPriority', e.target.value)}
              >
                <MenuItem value="">
                  <em>Default (HighThreat)</em>
                </MenuItem>
                {TARGET_PRIORITY_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Health %"
              size="small"
              sx={{ width: 100 }}
              value={cs.healthPercentage}
              onChange={(e) =>
                setField(
                  'healthPercentage',
                  e.target.value.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '')
                )
              }
              inputProps={{ inputMode: 'numeric' }}
              placeholder="0"
            />

            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={cs.random}
                  onChange={(e) => setField('random', e.target.checked)}
                />
              }
              label={<Typography variant="body2">Random</Typography>}
              sx={{ m: 0 }}
            />
          </Box>

          {/* Row 2: Categories multiselect */}
          <ConstantAutocomplete
            multiple
            indexKey="castableCategories"
            label="Categories"
            size="small"
            fullWidth
            value={cs.categories ? cs.categories.trim().split(/\s+/).filter(Boolean) : []}
            onChange={(newValue) => setField('categories', newValue.join(' '))}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip key={option} label={option} size="small" {...getTagProps({ index })} />
              ))
            }
          />

          <Divider />

          {/* Castables */}
          {cs.castables.map((c, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Autocomplete
                freeSolo
                options={castableOptions}
                value={c.name}
                onInputChange={(_, val, reason) => {
                  if (reason === 'input') changeCastableField(i, 'name', val)
                }}
                onChange={(_, val) => changeCastableField(i, 'name', val ?? '')}
                size="small"
                sx={{ flex: 1, minWidth: 180 }}
                renderInput={(params) => <TextField {...params} label="Castable" />}
              />
              <TextField
                label="Health %"
                size="small"
                sx={{ width: 100 }}
                value={c.healthPercentage}
                onChange={(e) =>
                  changeCastableField(
                    i,
                    'healthPercentage',
                    e.target.value.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '')
                  )
                }
                inputProps={{ inputMode: 'numeric' }}
              />
              <TextField
                label="Interval"
                size="small"
                sx={{ width: 100 }}
                value={c.interval}
                onChange={(e) =>
                  changeCastableField(i, 'interval', e.target.value.replace(/\D/g, ''))
                }
                inputProps={{ inputMode: 'numeric' }}
              />
              <IconButton size="small" color="error" onClick={() => removeCastable(i)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}

          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={addCastable}
            sx={{ alignSelf: 'flex-start' }}
          >
            Add Castable
          </Button>
        </Box>
      </Collapse>
    </Paper>
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────

function BehaviorSetEditor({
  behaviorSet,
  initialFileName,
  isArchived,
  isExisting,
  onSave,
  onArchive,
  onUnarchive,
  onDirtyChange,
  saveRef
}) {
  const [data, setData] = useState(behaviorSet)
  const [prefix, setPrefix] = useState(() =>
    deriveBehaviorSetPrefix(initialFileName, behaviorSet.name)
  )
  const [prefixEdited, setPrefixEdited] = useState(false)
  const [fileName, setFileName] = useState(
    () => initialFileName || computeBehaviorSetFilename(DEFAULT_PREFIX, behaviorSet.name)
  )
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName)

  const [openCastables, setOpenCastables] = useState(true)
  const [openImmunities, setOpenImmunities] = useState(true)
  const [openStatModifiers, setOpenStatModifiers] = useState(true)
  const [openCastingSets, setOpenCastingSets] = useState(true)
  const [openHostility, setOpenHostility] = useState(true)
  const [openCookies, setOpenCookies] = useState(true)

  const libraryIndex = useRecoilValue(libraryIndexState)
  const isDirtyRef = useRef(false)

  // ── Duplicate detection ────────────────────────────────────────────────────
  const dupStatus = useMemo(() => {
    const name = (data.name || '').trim()
    if (!name) return null
    const originalName = isExisting ? behaviorSet.name || '' : ''
    if (originalName && name.toLowerCase() === originalName.toLowerCase()) return null

    const activeNames = libraryIndex?.creaturebehaviorsets || []
    if (activeNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'active'

    const archivedNames = libraryIndex?.archivedCreaturebehaviorsets || []
    if (archivedNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'archived'

    return null
  }, [data.name, libraryIndex, isExisting, behaviorSet.name])

  const [dupSnack, setDupSnack] = useState(null)
  const handleNameBlur = () => {
    if (dupStatus) setDupSnack(dupStatus)
  }

  useEffect(() => {
    const p = deriveBehaviorSetPrefix(initialFileName, behaviorSet.name)
    setData(behaviorSet)
    setPrefix(p)
    setPrefixEdited(false)
    setFileName(initialFileName || computeBehaviorSetFilename(p, behaviorSet.name))
    setFileNameEdited(!!initialFileName)
    isDirtyRef.current = false
    onDirtyChange?.(false)
    setDupSnack(null)
    setOpenCastables(true)
    setOpenCastingSets(true)
    setOpenHostility(true)
    setOpenCookies(true)
  }, [behaviorSet, initialFileName]) // eslint-disable-line react-hooks/exhaustive-deps

  const markDirty = useCallback(() => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true
      onDirtyChange?.(true)
    }
  }, [onDirtyChange])

  const updateData = useCallback(
    (updater) => {
      markDirty()
      setData((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (!fileNameEdited) setFileName(computeBehaviorSetFilename(prefix, next.name))
        return next
      })
    },
    [fileNameEdited, prefix, markDirty]
  )

  const set = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.value }))

  const handlePrefixChange = (e) => {
    markDirty()
    setPrefix(e.target.value)
    setPrefixEdited(true)
    if (!fileNameEdited) setFileName(computeBehaviorSetFilename(e.target.value, data.name))
  }

  const handleRegenerate = () => {
    markDirty()
    setFileName(computeBehaviorSetFilename(prefix, data.name))
    setFileNameEdited(false)
  }

  const handleSave = () => onSave(data, fileName)
  if (saveRef) saveRef.current = handleSave

  // ── Immunities ──────────────────────────────────────────────────────────────

  const addImmunity = () =>
    updateData((d) => ({
      ...d,
      immunities: [...d.immunities, { type: 'Element', value: '', messageType: 'Say', message: '' }]
    }))

  const changeImmunityField = (i, field, val) =>
    updateData((d) => ({
      ...d,
      immunities: d.immunities.map((imm, idx) => (idx === i ? { ...imm, [field]: val } : imm))
    }))

  const changeImmunityType = (i, newType) =>
    updateData((d) => ({
      ...d,
      immunities: d.immunities.map((imm, idx) =>
        idx === i ? { ...imm, type: newType, value: '' } : imm
      )
    }))

  const removeImmunity = (i) =>
    updateData((d) => ({ ...d, immunities: d.immunities.filter((_, idx) => idx !== i) }))

  // ── Castables (learn list) ───────────────────────────────────────────────────

  const setCastablesField = (field, val) =>
    updateData((d) => ({ ...d, castables: { ...d.castables, [field]: val } }))

  const addCastableName = () =>
    updateData((d) => ({
      ...d,
      castables: { ...d.castables, names: [...(d.castables?.names || []), ''] }
    }))

  const changeCastableName = (i, val) =>
    updateData((d) => ({
      ...d,
      castables: { ...d.castables, names: d.castables.names.map((n, idx) => (idx === i ? val : n)) }
    }))

  const removeCastableName = (i) =>
    updateData((d) => ({
      ...d,
      castables: { ...d.castables, names: d.castables.names.filter((_, idx) => idx !== i) }
    }))

  // ── Casting sets ─────────────────────────────────────────────────────────────

  const addCastingSet = () =>
    updateData((d) => ({
      ...d,
      castingSets: [...(d.castingSets || []), { ...DEFAULT_CASTING_SET, castables: [] }]
    }))

  const changeCastingSet = (i, updated) =>
    updateData((d) => ({
      ...d,
      castingSets: d.castingSets.map((cs, idx) => (idx === i ? updated : cs))
    }))

  const removeCastingSet = (i) =>
    updateData((d) => ({ ...d, castingSets: d.castingSets.filter((_, idx) => idx !== i) }))

  const castableOptions = libraryIndex.castables || []

  // ── Hostility ────────────────────────────────────────────────────────────────

  const setHostilityEntry = (side, field, val) =>
    updateData((d) => ({
      ...d,
      hostility: { ...d.hostility, [side]: { ...d.hostility[side], [field]: val } }
    }))

  // ── Cookies ──────────────────────────────────────────────────────────────────

  const addCookie = () =>
    updateData((d) => ({ ...d, cookies: [...(d.cookies || []), { ...DEFAULT_COOKIE }] }))

  const changeCookieField = (i, field, val) =>
    updateData((d) => ({
      ...d,
      cookies: d.cookies.map((c, idx) => (idx === i ? { ...c, [field]: val } : c))
    }))

  const removeCookie = (i) =>
    updateData((d) => ({ ...d, cookies: d.cookies.filter((_, idx) => idx !== i) }))

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <EditorHeader
        title={data.name || '(unnamed behavior set)'}
        entityLabel="behavior set"
        fileName={fileName}
        initialFileName={initialFileName}
        computedFileName={computeBehaviorSetFilename(prefix, data.name)}
        isExisting={isExisting}
        isArchived={isArchived}
        onFileNameChange={(val) => {
          markDirty()
          setFileName(val)
          setFileNameEdited(true)
        }}
        onRegenerate={handleRegenerate}
        onSave={handleSave}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />

      <Divider sx={{ mb: 1, flexShrink: 0 }} />

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* ── Basic fields (headerless) ── */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Line 1: Set Name, Prefix, Import */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <TextField
                label="Set Name"
                required
                size="small"
                sx={{
                  flex: 1,
                  minWidth: 160,
                  ...(dupStatus === 'archived' && {
                    '& .MuiOutlinedInput-root fieldset': { borderColor: 'warning.main' },
                    '& .MuiInputLabel-root:not(.Mui-focused)': { color: 'warning.main' },
                    '& .MuiFormHelperText-root': { color: 'warning.main' }
                  })
                }}
                error={dupStatus === 'active'}
                helperText={
                  dupStatus === 'active'
                    ? `"${data.name}" already exists`
                    : dupStatus === 'archived'
                      ? `"${data.name}" exists in archive`
                      : undefined
                }
                value={data.name}
                onChange={set('name')}
                onBlur={handleNameBlur}
              />
              <TextField
                label="Prefix"
                size="small"
                sx={{ width: 120 }}
                value={prefix}
                onChange={handlePrefixChange}
                inputProps={{ maxLength: 64, spellCheck: false }}
              />
              <Autocomplete
                freeSolo
                options={libraryIndex.creaturebehaviorsets || []}
                value={data.import || ''}
                onInputChange={(_, val, reason) => {
                  if (reason === 'input') updateData((d) => ({ ...d, import: val }))
                }}
                onChange={(_, val) => updateData((d) => ({ ...d, import: val ?? '' }))}
                size="small"
                sx={{ flex: 1, minWidth: 200 }}
                renderInput={(params) => <TextField {...params} label="Import" />}
              />
            </Box>

            {/* Line 2: Stat Allocation with help tip */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                label="Stat Allocation"
                size="small"
                sx={{ flex: 1 }}
                value={data.statAlloc}
                onChange={set('statAlloc')}
                inputProps={{ spellCheck: false }}
                placeholder="e.g. Str Int Wis Con Dex"
              />
              <Tooltip title="Stats are applied in order: Str Int Wis Con Dex (space delimited)">
                <HelpOutlineIcon
                  fontSize="small"
                  color="action"
                  sx={{ cursor: 'help', flexShrink: 0 }}
                />
              </Tooltip>
            </Box>

            <CommentField value={data.comment} onChange={set('comment')} />
          </Box>
        </Paper>

        {/* ── Castables (learn list) ── */}
        <Section
          title="Castables"
          open={openCastables}
          onToggle={() => setOpenCastables((v) => !v)}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={data.castables?.auto ?? true}
                    onChange={(e) => setCastablesField('auto', e.target.checked)}
                  />
                }
                label={<Typography variant="body2">Auto</Typography>}
                sx={{ m: 0 }}
              />
              <ConstantAutocomplete
                multiple
                indexKey="castableCategories"
                label="Skill Categories"
                size="small"
                sx={{ flex: 1, minWidth: 200 }}
                value={(data.castables?.skillCategories || '').trim().split(/\s+/).filter(Boolean)}
                onChange={(val) => setCastablesField('skillCategories', val.join(' '))}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip key={option} label={option} size="small" {...getTagProps({ index })} />
                  ))
                }
              />
              <ConstantAutocomplete
                multiple
                indexKey="castableCategories"
                label="Spell Categories"
                size="small"
                sx={{ flex: 1, minWidth: 200 }}
                value={(data.castables?.spellCategories || '').trim().split(/\s+/).filter(Boolean)}
                onChange={(val) => setCastablesField('spellCategories', val.join(' '))}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip key={option} label={option} size="small" {...getTagProps({ index })} />
                  ))
                }
              />
            </Box>
            {(data.castables?.names || []).map((name, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Autocomplete
                  freeSolo
                  size="small"
                  sx={{ flex: 1 }}
                  options={castableOptions}
                  value={name}
                  onInputChange={(_, val, reason) => {
                    if (reason === 'input') changeCastableName(i, val)
                  }}
                  onChange={(_, val) => changeCastableName(i, val ?? '')}
                  renderInput={(params) => <TextField {...params} label="Castable" />}
                />
                <IconButton size="small" color="error" onClick={() => removeCastableName(i)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={addCastableName}>
              Add Castable
            </Button>
          </Box>
        </Section>

        {/* ── Immunities ── */}
        <Section
          title="Immunities"
          open={openImmunities}
          onToggle={() => setOpenImmunities((v) => !v)}
        >
          {data.immunities.map((row, i) => (
            <ImmunityRow
              key={i}
              row={row}
              index={i}
              libraryIndex={libraryIndex}
              onChangeField={changeImmunityField}
              onChangeType={changeImmunityType}
              onRemove={removeImmunity}
            />
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addImmunity}>
            Add Immunity
          </Button>
        </Section>

        {/* ── Stat Modifiers ── */}
        <Section
          title="Stat Modifiers"
          open={openStatModifiers}
          onToggle={() => setOpenStatModifiers((v) => !v)}
        >
          <StatsTab
            data={data.statModifiers}
            onChange={(val) => updateData((d) => ({ ...d, statModifiers: val }))}
            elementOptions={libraryIndex.elementnames || []}
          />
        </Section>

        {/* ── Casting Sets ── */}
        <Section
          title="Casting Sets"
          open={openCastingSets}
          onToggle={() => setOpenCastingSets((v) => !v)}
        >
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={addCastingSet}
            sx={{ mb: (data.castingSets || []).length ? 2 : 0 }}
          >
            Add Casting Set
          </Button>
          {(data.castingSets || []).map((cs, i) => (
            <CastingSetAccordion
              key={i}
              cs={cs}
              index={i}
              castableOptions={castableOptions}
              onChange={(updated) => changeCastingSet(i, updated)}
              onRemove={() => removeCastingSet(i)}
            />
          ))}
        </Section>

        {/* ── Hostility ── */}
        <Section
          title="Hostility"
          open={openHostility}
          onToggle={() => setOpenHostility((v) => !v)}
        >
          {['monsters', 'players'].map((side) => {
            const entry = data.hostility?.[side] || {
              enabled: false,
              exceptCookie: '',
              onlyCookie: ''
            }
            const label = side === 'monsters' ? 'Monsters' : 'Players'
            return (
              <Box
                key={side}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={entry.enabled}
                      onChange={(e) => setHostilityEntry(side, 'enabled', e.target.checked)}
                    />
                  }
                  label={<Typography variant="body2">{label}</Typography>}
                  sx={{ m: 0, minWidth: 100 }}
                />
                {entry.enabled && (
                  <>
                    <TextField
                      label="Except Cookie"
                      size="small"
                      sx={{ flex: 1, minWidth: 140 }}
                      value={entry.exceptCookie}
                      onChange={(e) => setHostilityEntry(side, 'exceptCookie', e.target.value)}
                    />
                    <TextField
                      label="Only Cookie"
                      size="small"
                      sx={{ flex: 1, minWidth: 140 }}
                      value={entry.onlyCookie}
                      onChange={(e) => setHostilityEntry(side, 'onlyCookie', e.target.value)}
                    />
                  </>
                )}
              </Box>
            )
          })}
        </Section>

        {/* ── Set Cookies ── */}
        <Section title="Set Cookies" open={openCookies} onToggle={() => setOpenCookies((v) => !v)}>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={addCookie}
            sx={{ mb: (data.cookies || []).length ? 2 : 0 }}
          >
            Add Cookie
          </Button>
          {(data.cookies || []).map((c, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <ConstantAutocomplete
                indexKey="cookieNames"
                label="Cookie Name"
                sx={{ flex: 1 }}
                value={c.name}
                onChange={(val) => changeCookieField(i, 'name', val)}
              />
              <TextField
                label="Cookie Value"
                size="small"
                sx={{ flex: 1 }}
                value={c.value}
                onChange={(e) => changeCookieField(i, 'value', e.target.value)}
              />
              <IconButton size="small" color="error" onClick={() => removeCookie(i)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Section>
      </Box>

      <Snackbar
        open={!!dupSnack}
        autoHideDuration={5000}
        onClose={() => setDupSnack(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={dupSnack === 'archived' ? 'warning' : 'error'}
          onClose={() => setDupSnack(null)}
          sx={{ width: '100%' }}
        >
          {dupSnack === 'active'
            ? `"${data.name}" already exists!`
            : `"${data.name}" exists in archive`}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default BehaviorSetEditor
