import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Box,
  Button,
  Typography,
  Divider,
  TextField,
  IconButton,
  Paper,
  Autocomplete,
  Collapse,
  FormControlLabel,
  Checkbox,
  Snackbar,
  Alert
} from '@mui/material'
import ConstantAutocomplete from '../shared/ConstantAutocomplete'
import EditorHeader from '../shared/EditorHeader'
import SoundPicker from '../shared/SoundPicker'
import WeaponPicker from '../shared/WeaponPicker'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { useRecoilValue } from 'recoil'
import { libraryIndexState } from '../../recoil/atoms'
import CommentField from '../shared/CommentField'
import spriteMeta, { keyFromSprite, spriteUrl, frameDisplay } from '../../data/creatureSpriteData'
import SpritePickerDialog from '../shared/SpritePickerDialog'
import GridViewIcon from '@mui/icons-material/GridView'
import OpenScriptByNameButton from '../shared/OpenScriptByNameButton'

function computeCreatureFilename(prefix, name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '')
  if (!safe) return ''
  const p = (prefix || '').trim().toLowerCase().replace(/\s+/g, '_')
  return p ? `${p}_${safe}.xml` : `${safe}.xml`
}

const DEFAULT_HOSTILITY = {
  players: false,
  playerExceptCookie: '',
  playerOnlyCookie: '',
  monsters: false,
  monsterExceptCookie: '',
  monsterOnlyCookie: ''
}

const makeDefaultSubtype = () => ({
  name: '',
  sprite: '',
  behaviorSet: '',
  minDmg: '',
  maxDmg: '',
  assailSound: '',
  description: '',
  loot: [],
  hostility: { ...DEFAULT_HOSTILITY },
  cookies: [],
  meta: { weapon: '' }
})

// ── Collapsible section wrapper ───────────────────────────────────────────────
function Section({ title, open, onToggle, onDelete, children }) {
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
        {onDelete !== undefined && (
          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            sx={{ mr: 0.5 }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>
      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2 }}>{children}</Box>
      </Collapse>
    </Paper>
  )
}

// ── BehaviorSet autocomplete ──────────────────────────────────────────────────
function BehaviorSetPicker({ value, onChange, sx }) {
  const libraryIndex = useRecoilValue(libraryIndexState)
  const options = libraryIndex.creaturebehaviorsets || []
  return (
    <Autocomplete
      freeSolo
      options={options}
      value={value}
      onInputChange={(_, val, reason) => {
        if (reason === 'input') onChange(val)
      }}
      onChange={(_, val) => onChange(val ?? '')}
      size="small"
      sx={sx}
      renderInput={(params) => <TextField {...params} label="Behavior Set" />}
    />
  )
}

// ── LootSet autocomplete ──────────────────────────────────────────────────────
function LootSetPicker({ value, onChange, sx }) {
  const libraryIndex = useRecoilValue(libraryIndexState)
  const options = libraryIndex.lootsets || []
  return (
    <Autocomplete
      freeSolo
      options={options}
      value={value}
      onInputChange={(_, val, reason) => {
        if (reason === 'input') onChange(val)
      }}
      onChange={(_, val) => onChange(val ?? '')}
      size="small"
      sx={sx}
      renderInput={(params) => <TextField {...params} label="Loot Set" />}
    />
  )
}

// ── Loot section content ──────────────────────────────────────────────────────
function LootContent({ loot, onChange }) {
  const add = () => onChange([...loot, { name: '', rolls: '', chance: '' }])
  const set = (i, field, val) =>
    onChange(loot.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)))
  const remove = (i) => onChange(loot.filter((_, idx) => idx !== i))

  return (
    <>
      {loot.map((entry, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
          <LootSetPicker
            value={entry.name}
            onChange={(val) => set(i, 'name', val)}
            sx={{ flex: 2, minWidth: 160 }}
          />
          <TextField
            label="Rolls"
            size="small"
            sx={{ width: 80 }}
            value={entry.rolls}
            onChange={(e) => set(i, 'rolls', e.target.value)}
            slotProps={{
              htmlInput: { maxLength: 16 }
            }}
          />
          <TextField
            label="Chance"
            size="small"
            sx={{ width: 100 }}
            value={entry.chance}
            onChange={(e) => set(i, 'chance', e.target.value)}
            slotProps={{
              htmlInput: { maxLength: 16 }
            }}
          />
          <IconButton size="small" color="error" onClick={() => remove(i)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={add}>
        Add Loot Set
      </Button>
    </>
  );
}

// ── Hostility section content ─────────────────────────────────────────────────
function HostilityContent({ hostility, onChange }) {
  const set = (field, val) => onChange({ ...hostility, [field]: val })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Players row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={hostility.players}
              onChange={(e) => set('players', e.target.checked)}
            />
          }
          label={<Typography variant="body2">Players</Typography>}
          sx={{ minWidth: 100, m: 0 }}
        />
        {hostility.players && (
          <>
            <ConstantAutocomplete
              indexKey="cookieNames"
              label="Except Cookie"
              sx={{ flex: 1, minWidth: 140 }}
              value={hostility.playerExceptCookie}
              onChange={(val) => set('playerExceptCookie', val)}
              inputProps={{ maxLength: 128 }}
            />
            <ConstantAutocomplete
              indexKey="cookieNames"
              label="Only Cookie"
              sx={{ flex: 1, minWidth: 140 }}
              value={hostility.playerOnlyCookie}
              onChange={(val) => set('playerOnlyCookie', val)}
              inputProps={{ maxLength: 128 }}
            />
          </>
        )}
      </Box>
      {/* Monsters row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={hostility.monsters}
              onChange={(e) => set('monsters', e.target.checked)}
            />
          }
          label={<Typography variant="body2">Monsters</Typography>}
          sx={{ minWidth: 100, m: 0 }}
        />
        {hostility.monsters && (
          <>
            <ConstantAutocomplete
              indexKey="cookieNames"
              label="Except Cookie"
              sx={{ flex: 1, minWidth: 140 }}
              value={hostility.monsterExceptCookie}
              onChange={(val) => set('monsterExceptCookie', val)}
              inputProps={{ maxLength: 128 }}
            />
            <ConstantAutocomplete
              indexKey="cookieNames"
              label="Only Cookie"
              sx={{ flex: 1, minWidth: 140 }}
              value={hostility.monsterOnlyCookie}
              onChange={(val) => set('monsterOnlyCookie', val)}
              inputProps={{ maxLength: 128 }}
            />
          </>
        )}
      </Box>
    </Box>
  )
}

// ── Cookies section content ───────────────────────────────────────────────────
function CookiesContent({ cookies, onChange }) {
  const add = () => onChange([...cookies, { name: '', value: '' }])
  const set = (i, field, val) =>
    onChange(cookies.map((c, idx) => (idx === i ? { ...c, [field]: val } : c)))
  const remove = (i) => onChange(cookies.filter((_, idx) => idx !== i))

  return (
    <>
      {cookies.map((cookie, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
          <ConstantAutocomplete
            indexKey="cookieNames"
            label="Cookie Name"
            sx={{ flex: 1 }}
            value={cookie.name}
            onChange={(val) => set(i, 'name', val)}
            inputProps={{ maxLength: 128 }}
          />
          <TextField
            label="Cookie Value"
            size="small"
            sx={{ flex: 1 }}
            value={cookie.value}
            onChange={(e) => set(i, 'value', e.target.value)}
            slotProps={{
              htmlInput: { maxLength: 128 }
            }}
          />
          <IconButton size="small" color="error" onClick={() => remove(i)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={add}>
        Add Cookie
      </Button>
    </>
  );
}

// ── Subtype accordion ─────────────────────────────────────────────────────────
function SubtypeAccordion({ data, index, onChange, onRemove }) {
  const [open, setOpen] = useState(true)
  const [openLoot, setOpenLoot] = useState(false)
  const [openHostility, setOpenHostility] = useState(false)
  const [openCookies, setOpenCookies] = useState(false)
  const [spritePickerOpen, setSpritePickerOpen] = useState(false)

  const set = (field, val) => onChange({ ...data, [field]: val })

  const SPRITE_PREVIEW = 96
  const spritePreviewKey = keyFromSprite(data.sprite)
  const spritePreviewMeta = spritePreviewKey ? spriteMeta[spritePreviewKey] : null
  const spritePreviewFrame = spritePreviewMeta
    ? frameDisplay(spritePreviewMeta, spritePreviewMeta.still, SPRITE_PREVIEW)
    : null

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
        onClick={() => setOpen((v) => !v)}
      >
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {data.name || `Subtype ${index + 1}`}
        </Typography>
        <IconButton
          size="small"
          color="error"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          sx={{ mr: 0.5 }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>
      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2 }}>
          {/* Core fields */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* Left: sprite preview + browse */}
              <Box
                sx={{
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <Box
                  sx={{
                    width: SPRITE_PREVIEW,
                    height: SPRITE_PREVIEW,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'action.hover'
                  }}
                >
                  {spritePreviewFrame && (
                    <Box
                      sx={{
                        width: spritePreviewFrame.clipW,
                        height: spritePreviewFrame.clipH,
                        overflow: 'hidden',
                        flexShrink: 0
                      }}
                    >
                      <img
                        src={spriteUrl(spritePreviewKey)}
                        alt={spritePreviewKey}
                        draggable={false}
                        style={spritePreviewFrame.imgStyle}
                      />
                    </Box>
                  )}
                </Box>
                <Button
                  size="small"
                  startIcon={<GridViewIcon />}
                  onClick={() => setSpritePickerOpen(true)}
                >
                  Browse
                </Button>
              </Box>
              {/* Right: 3 rows */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Row 1: Name | Behavior Set */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="Name"
                    required
                    size="small"
                    sx={{ flex: 1 }}
                    value={data.name}
                    onChange={(e) => set('name', e.target.value)}
                    slotProps={{
                      input: {
                        endAdornment: <OpenScriptByNameButton name={data.name} tooltipPrefix="Open subtype script" />,
                      },

                      htmlInput: { maxLength: 255 }
                    }} />
                  <BehaviorSetPicker
                    value={data.behaviorSet}
                    onChange={(val) => set('behaviorSet', val)}
                    sx={{ flex: 1 }}
                  />
                </Box>
                {/* Row 2: Sprite # | Assail Sound | Weapon (preset + Min/Max) */}
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <TextField
                    label="Sprite"
                    type="number"
                    size="small"
                    sx={{ width: 100 }}
                    value={data.sprite}
                    onChange={(e) => set('sprite', e.target.value)}
                    slotProps={{
                      htmlInput: { min: 1, max: 9999 }
                    }}
                  />
                  <SoundPicker
                    label="Assail Sound"
                    width={140}
                    value={data.assailSound}
                    onChange={(val) => set('assailSound', val)}
                  />
                  <WeaponPicker
                    weaponName={data.meta?.weapon || ''}
                    minDmg={data.minDmg}
                    maxDmg={data.maxDmg}
                    onWeaponNameChange={(name) =>
                      set('meta', { ...(data.meta || {}), weapon: name })
                    }
                    onMinDmgChange={(v) => set('minDmg', v)}
                    onMaxDmgChange={(v) => set('maxDmg', v)}
                  />
                </Box>
                {/* Row 3: Description */}
                <TextField
                  label="Description"
                  size="small"
                  multiline
                  minRows={2}
                  value={data.description}
                  onChange={(e) => set('description', e.target.value)}
                  slotProps={{
                    htmlInput: { maxLength: 1024 }
                  }}
                />
              </Box>
            </Box>
          </Box>
          <SpritePickerDialog
            open={spritePickerOpen}
            value={data.sprite}
            onClose={() => setSpritePickerOpen(false)}
            onChange={(key) => {
              set('sprite', String(parseInt(key.replace('monster', ''), 10)))
              setSpritePickerOpen(false)
            }}
          />

          {/* Nested sections */}
          <Section title="Loot" open={openLoot} onToggle={() => setOpenLoot((v) => !v)}>
            <LootContent loot={data.loot} onChange={(val) => set('loot', val)} />
          </Section>
          <Section
            title="Hostility"
            open={openHostility}
            onToggle={() => setOpenHostility((v) => !v)}
          >
            <HostilityContent
              hostility={data.hostility}
              onChange={(val) => set('hostility', val)}
            />
          </Section>
          <Section title="Cookies" open={openCookies} onToggle={() => setOpenCookies((v) => !v)}>
            <CookiesContent cookies={data.cookies} onChange={(val) => set('cookies', val)} />
          </Section>
        </Box>
      </Collapse>
    </Paper>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────
function CreatureEditor({
  creature,
  initialFileName,
  isArchived,
  isExisting,
  onSave,
  onArchive,
  onUnarchive,
  onDirtyChange,
  saveRef
}) {
  const libraryIndex = useRecoilValue(libraryIndexState)
  const [data, setData] = useState(creature)
  const [fileName, setFileName] = useState(
    initialFileName || computeCreatureFilename(creature.meta?.family || '', creature.name)
  )
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName)

  const [openLoot, setOpenLoot] = useState(false)
  const [openHostility, setOpenHostility] = useState(false)
  const [openCookies, setOpenCookies] = useState(false)
  const [spritePickerOpen, setSpritePickerOpen] = useState(false)

  const isDirtyRef = useRef(false)

  // ── Duplicate detection ────────────────────────────────────────────────────
  const dupStatus = useMemo(() => {
    const name = (data.name || '').trim()
    if (!name) return null
    const originalName = isExisting ? creature.name || '' : ''
    if (originalName && name.toLowerCase() === originalName.toLowerCase()) return null

    const activeNames = libraryIndex?.creatures || []
    if (activeNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'active'

    const archivedNames = libraryIndex?.archivedCreatures || []
    if (archivedNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'archived'

    return null
  }, [data.name, libraryIndex, isExisting, creature.name])

  const [dupSnack, setDupSnack] = useState(null)
  const handleNameBlur = () => {
    if (dupStatus) setDupSnack(dupStatus)
  }

  useEffect(() => {
    setData(creature)
    setFileName(
      initialFileName || computeCreatureFilename(creature.meta?.family || '', creature.name)
    )
    setFileNameEdited(!!initialFileName)
    setOpenLoot(false)
    setOpenHostility(false)
    setOpenCookies(false)
    setSpritePickerOpen(false)
    isDirtyRef.current = false
    onDirtyChange?.(false)
    setDupSnack(null)
  }, [creature, initialFileName]) // eslint-disable-line react-hooks/exhaustive-deps

  const markDirtyLocal = useCallback(() => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true
      onDirtyChange?.(true)
    }
  }, [onDirtyChange])

  const updateData = useCallback(
    (updater) => {
      markDirtyLocal()
      setData((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (!fileNameEdited)
          setFileName(computeCreatureFilename(next.meta?.family || '', next.name))
        return next
      })
    },
    [fileNameEdited, markDirtyLocal]
  )

  const set = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.value }))

  const handleRegenerate = () => {
    markDirtyLocal()
    setFileName(computeCreatureFilename(data.meta?.family || '', data.name))
    setFileNameEdited(false)
  }

  // Subtype helpers
  const addSubtype = () =>
    updateData((d) => ({
      ...d,
      subtypes: [...d.subtypes, makeDefaultSubtype()]
    }))

  const updateSubtype = (i, updated) =>
    updateData((d) => ({
      ...d,
      subtypes: d.subtypes.map((s, idx) => (idx === i ? updated : s))
    }))

  const removeSubtype = (i) =>
    updateData((d) => ({
      ...d,
      subtypes: d.subtypes.filter((_, idx) => idx !== i)
    }))

  if (saveRef) saveRef.current = () => onSave(data, fileName)

  const SPRITE_PREVIEW = 96
  const spritePreviewKey = keyFromSprite(data.sprite)
  const spritePreviewMeta = spritePreviewKey ? spriteMeta[spritePreviewKey] : null
  const spritePreviewFrame = spritePreviewMeta
    ? frameDisplay(spritePreviewMeta, spritePreviewMeta.still, SPRITE_PREVIEW)
    : null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <EditorHeader
        title={data.name || '(unnamed creature)'}
        entityLabel="creature"
        fileName={fileName}
        initialFileName={initialFileName}
        computedFileName={computeCreatureFilename(data.meta?.family || '', data.name)}
        isExisting={isExisting}
        isArchived={isArchived}
        onFileNameChange={(val) => {
          markDirtyLocal()
          setFileName(val)
          setFileNameEdited(true)
        }}
        onRegenerate={handleRegenerate}
        onSave={() => onSave(data, fileName)}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />
      <Divider sx={{ mb: 1, flexShrink: 0 }} />
      {/* ── Form ── */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Root creature fields (headerless) */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* Left: big sprite preview + browse button */}
              <Box
                sx={{
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <Box
                  sx={{
                    width: SPRITE_PREVIEW,
                    height: SPRITE_PREVIEW,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'action.hover'
                  }}
                >
                  {spritePreviewFrame && (
                    <Box
                      sx={{
                        width: spritePreviewFrame.clipW,
                        height: spritePreviewFrame.clipH,
                        overflow: 'hidden',
                        flexShrink: 0
                      }}
                    >
                      <img
                        src={spriteUrl(spritePreviewKey)}
                        alt={spritePreviewKey}
                        draggable={false}
                        style={spritePreviewFrame.imgStyle}
                      />
                    </Box>
                  )}
                </Box>
                <Button
                  size="small"
                  startIcon={<GridViewIcon />}
                  onClick={() => setSpritePickerOpen(true)}
                >
                  Browse
                </Button>
              </Box>
              {/* Right: 3 rows */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Row 1: Family | Name | Behavior Set */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <ConstantAutocomplete
                    indexKey="creatureFamilies"
                    label="Family"
                    sx={{ width: 160 }}
                    value={data.meta?.family || ''}
                    onChange={(val) =>
                      updateData((d) => ({ ...d, meta: { ...d.meta, family: val } }))
                    }
                    inputProps={{ maxLength: 64, spellCheck: false }}
                  />
                  <TextField
                    label="Name"
                    required
                    size="small"
                    sx={{
                      flex: 1,
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
                    slotProps={{
                      input: {
                        endAdornment: <OpenScriptByNameButton name={data.name} tooltipPrefix="Open creature script" />,
                      },

                      htmlInput: { maxLength: 255 }
                    }} />
                  <BehaviorSetPicker
                    value={data.behaviorSet}
                    onChange={(val) => updateData((d) => ({ ...d, behaviorSet: val }))}
                    sx={{ flex: 1 }}
                  />
                </Box>
                {/* Row 2: Sprite # | Assail Sound | Weapon (preset + Min/Max) */}
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <TextField
                    label="Sprite"
                    type="number"
                    size="small"
                    sx={{ width: 100 }}
                    value={data.sprite}
                    onChange={(e) => updateData((d) => ({ ...d, sprite: e.target.value }))}
                    slotProps={{
                      htmlInput: { min: 1, max: 9999 }
                    }}
                  />
                  <SoundPicker
                    label="Assail Sound"
                    width={140}
                    value={data.assailSound}
                    onChange={(val) => set('assailSound')({ target: { value: val } })}
                  />
                  <WeaponPicker
                    weaponName={data.meta?.weapon || ''}
                    minDmg={data.minDmg}
                    maxDmg={data.maxDmg}
                    onWeaponNameChange={(name) =>
                      updateData((d) => ({ ...d, meta: { ...d.meta, weapon: name } }))
                    }
                    onMinDmgChange={(v) => updateData((d) => ({ ...d, minDmg: v }))}
                    onMaxDmgChange={(v) => updateData((d) => ({ ...d, maxDmg: v }))}
                  />
                </Box>
                {/* Row 3: Description */}
                <TextField
                  label="Description"
                  size="small"
                  multiline
                  minRows={2}
                  value={data.description}
                  onChange={set('description')}
                  slotProps={{
                    htmlInput: { maxLength: 1024 }
                  }}
                />
              </Box>
            </Box>
            <CommentField value={data.comment} onChange={set('comment')} fullWidth />
          </Box>
        </Paper>
        <SpritePickerDialog
          open={spritePickerOpen}
          value={data.sprite}
          onClose={() => setSpritePickerOpen(false)}
          onChange={(key) => {
            updateData((d) => ({ ...d, sprite: String(parseInt(key.replace('monster', ''), 10)) }))
            setSpritePickerOpen(false)
          }}
        />

        {/* Loot */}
        <Section title="Loot" open={openLoot} onToggle={() => setOpenLoot((v) => !v)}>
          <LootContent
            loot={data.loot}
            onChange={(val) => updateData((d) => ({ ...d, loot: val }))}
          />
        </Section>

        {/* Hostility */}
        <Section
          title="Hostility"
          open={openHostility}
          onToggle={() => setOpenHostility((v) => !v)}
        >
          <HostilityContent
            hostility={data.hostility}
            onChange={(val) => updateData((d) => ({ ...d, hostility: val }))}
          />
        </Section>

        {/* Cookies */}
        <Section title="Cookies" open={openCookies} onToggle={() => setOpenCookies((v) => !v)}>
          <CookiesContent
            cookies={data.cookies}
            onChange={(val) => updateData((d) => ({ ...d, cookies: val }))}
          />
        </Section>

        {/* Subtypes */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2" sx={{ flexShrink: 0 }}>
            Subtypes
          </Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>
        {data.subtypes.map((sub, i) => (
          <SubtypeAccordion
            key={i}
            data={sub}
            index={i}
            onChange={(updated) => updateSubtype(i, updated)}
            onRemove={() => removeSubtype(i)}
          />
        ))}

        <Box sx={{ mb: 2 }}>
          <Button startIcon={<AddIcon />} onClick={addSubtype}>
            Add Subtype
          </Button>
        </Box>
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
  );
}

export default CreatureEditor
