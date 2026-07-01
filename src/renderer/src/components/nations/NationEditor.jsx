import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Box,
  Button,
  Typography,
  Divider,
  TextField,
  Tooltip,
  IconButton,
  Paper,
  Autocomplete,
  Collapse,
  Switch,
  Snackbar,
  Alert,
  Checkbox,
  FormControlLabel
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import GridViewIcon from '@mui/icons-material/GridView'
import { useRecoilValue } from 'recoil'
import { libraryIndexState } from '../../recoil/atoms'
import CommentField from '../shared/CommentField'
import EditorHeader from '../shared/EditorHeader'
import NationCrestCanvas from '../shared/NationCrestCanvas'
import NationCrestPickerDialog from '../shared/NationCrestPickerDialog'

const FLAG_PREVIEW = 80

function computeNationFilename(prefix, name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '')
  if (!safe) return ''
  const p = (prefix || '').trim().toLowerCase().replace(/\s+/g, '_')
  return p ? `${p}_${safe}.xml` : `${safe}.xml`
}

function deriveNationPrefix(fileName, name) {
  if (!fileName) return 'nation'
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '')
  const base = fileName.replace(/\.xml$/i, '')
  if (safe && base.endsWith(`_${safe}`)) {
    const p = base.slice(0, base.length - safe.length - 1)
    return p || 'nation'
  }
  return 'nation'
}

// ── Collapsible section wrapper ───────────────────────────────────────────────
function Section({ title, open, onToggle, enabled, onEnable, children }) {
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
        {onEnable !== undefined && (
          <Switch
            size="small"
            checked={enabled}
            onChange={(e) => {
              e.stopPropagation()
              onEnable(e.target.checked)
            }}
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
  )
}

// ── Map autocomplete ──────────────────────────────────────────────────────────
function MapPicker({ label, value, onChange, sx }) {
  const libraryIndex = useRecoilValue(libraryIndexState)
  const mapNames = libraryIndex.maps || []
  return (
    <Autocomplete
      freeSolo
      options={mapNames}
      value={value}
      onInputChange={(_, val, reason) => {
        if (reason === 'input') onChange(val)
      }}
      onChange={(_, val) => onChange(val ?? '')}
      size="small"
      sx={sx}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────
function NationEditor({
  nation,
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
  const [data, setData] = useState(nation)
  const [prefix, setPrefix] = useState(() => deriveNationPrefix(initialFileName, nation.name))
  const [fileName, setFileName] = useState(
    initialFileName || computeNationFilename('nation', nation.name)
  )
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName)
  const [flagPickerOpen, setFlagPickerOpen] = useState(false)

  const [openSpawnPoints, setOpenSpawnPoints] = useState(nation.spawnPoints.length > 0)
  const [openTerritory, setOpenTerritory] = useState(nation.territory !== null)

  const isDirtyRef = useRef(false)

  // ── Duplicate detection ────────────────────────────────────────────────────
  const dupStatus = useMemo(() => {
    const name = (data.name || '').trim()
    if (!name) return null
    const originalName = isExisting ? nation.name || '' : ''
    if (originalName && name.toLowerCase() === originalName.toLowerCase()) return null

    const activeNames = libraryIndex?.nations || []
    if (activeNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'active'

    const archivedNames = libraryIndex?.archivedNations || []
    if (archivedNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'archived'

    return null
  }, [data.name, libraryIndex, isExisting, nation.name])

  const [dupSnack, setDupSnack] = useState(null)
  const handleNameBlur = () => {
    if (dupStatus) setDupSnack(dupStatus)
  }

  useEffect(() => {
    const p = deriveNationPrefix(initialFileName, nation.name)
    setData(nation)
    setPrefix(p)
    setFileName(initialFileName || computeNationFilename(p, nation.name))
    setFileNameEdited(!!initialFileName)
    setOpenSpawnPoints(nation.spawnPoints.length > 0)
    setOpenTerritory(nation.territory !== null)
    isDirtyRef.current = false
    onDirtyChange?.(false)
    setDupSnack(null)
  }, [nation, initialFileName]) // eslint-disable-line react-hooks/exhaustive-deps

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
        if (!fileNameEdited) setFileName(computeNationFilename(prefix, next.name))
        return next
      })
    },
    [fileNameEdited, prefix, markDirtyLocal]
  )

  const set = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.value }))

  const handlePrefixChange = (e) => {
    markDirtyLocal()
    setPrefix(e.target.value)
    if (!fileNameEdited) setFileName(computeNationFilename(e.target.value, data.name))
  }

  const handleRegenerate = () => {
    markDirtyLocal()
    setFileName(computeNationFilename(prefix, data.name))
    setFileNameEdited(false)
  }

  if (saveRef) saveRef.current = () => onSave(data, fileName)

  // ── Spawn points ──────────────────────────────────────────────────────────
  const addSpawnPoint = () =>
    updateData((d) => ({ ...d, spawnPoints: [...d.spawnPoints, { mapName: '', x: '', y: '' }] }))
  const setSpawnPoint = (i, field, val) =>
    updateData((d) => ({
      ...d,
      spawnPoints: d.spawnPoints.map((sp, idx) => (idx === i ? { ...sp, [field]: val } : sp))
    }))
  const removeSpawnPoint = (i) =>
    updateData((d) => ({ ...d, spawnPoints: d.spawnPoints.filter((_, idx) => idx !== i) }))

  // ── Territory ─────────────────────────────────────────────────────────────
  const enableTerritory = (checked) => {
    updateData((d) => ({ ...d, territory: checked ? [] : null }))
    setOpenTerritory(checked)
  }
  const addTerritoryMap = () =>
    updateData((d) => ({ ...d, territory: [...(d.territory || []), ''] }))
  const setTerritoryMap = (i, val) =>
    updateData((d) => ({
      ...d,
      territory: d.territory.map((m, idx) => (idx === i ? val : m))
    }))
  const removeTerritoryMap = (i) =>
    updateData((d) => ({ ...d, territory: d.territory.filter((_, idx) => idx !== i) }))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <EditorHeader
        title={data.name || '(unnamed nation)'}
        entityLabel="nation"
        fileName={fileName}
        initialFileName={initialFileName}
        computedFileName={computeNationFilename(prefix, data.name)}
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
        {/* Basic info */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {/* Left: flag preview + browse button */}
            <Box
              sx={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.8
              }}
            >
              <NationCrestCanvas flagNum={data.flag} size={FLAG_PREVIEW} />
              <Button
                size="small"
                startIcon={<GridViewIcon />}
                onClick={() => setFlagPickerOpen(true)}
              >
                Browse
              </Button>
            </Box>

            {/* Right: field rows */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Row 1: Prefix | Name | Flag # | Default */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <TextField
                  label="Prefix"
                  size="small"
                  sx={{ width: 120 }}
                  value={prefix}
                  onChange={handlePrefixChange}
                  slotProps={{
                    htmlInput: { maxLength: 64, spellCheck: false }
                  }}
                />
                <TextField
                  label="Name"
                  size="small"
                  required
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
                  slotProps={{
                    htmlInput: { maxLength: 255 }
                  }}
                />
                <TextField
                  label="Flag"
                  required
                  size="small"
                  sx={{ width: 72 }}
                  value={data.flag}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '')
                    if (v === '' || parseInt(v, 10) <= 99) updateData((d) => ({ ...d, flag: v }))
                  }}
                  placeholder="1–99"
                  slotProps={{
                    htmlInput: { inputMode: 'numeric', maxLength: 2 }
                  }}
                />
                <Tooltip title="Only one nation across the library should be marked as default">
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={!!data.isDefault}
                        onChange={(e) => updateData((d) => ({ ...d, isDefault: e.target.checked }))}
                      />
                    }
                    label={<Typography variant="body2">Default</Typography>}
                    sx={{ m: 0, alignSelf: 'center' }}
                  />
                </Tooltip>
              </Box>
              {/* Row 2: Description */}
              <TextField
                label="Description"
                value={data.description}
                onChange={set('description')}
                size="small"
                multiline
                minRows={2}
                slotProps={{
                  htmlInput: { maxLength: 1000 }
                }}
              />
            </Box>
          </Box>
          <CommentField value={data.comment} onChange={set('comment')} fullWidth sx={{ mt: 2 }} />
        </Paper>

        {/* ── Spawn Points ── */}
        <Section
          title="Spawn Points"
          open={openSpawnPoints}
          onToggle={() => setOpenSpawnPoints((v) => !v)}
        >
          {data.spawnPoints.map((sp, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <MapPicker
                label="Map"
                value={sp.mapName}
                sx={{ flex: 1 }}
                onChange={(val) => setSpawnPoint(i, 'mapName', val)}
              />
              <TextField
                label="X"
                value={sp.x}
                onChange={(e) => setSpawnPoint(i, 'x', e.target.value)}
                size="small"
                sx={{ width: 80 }}
                slotProps={{
                  htmlInput: { maxLength: 10 }
                }}
              />
              <TextField
                label="Y"
                value={sp.y}
                onChange={(e) => setSpawnPoint(i, 'y', e.target.value)}
                size="small"
                sx={{ width: 80 }}
                slotProps={{
                  htmlInput: { maxLength: 10 }
                }}
              />
              <IconButton size="small" color="error" onClick={() => removeSpawnPoint(i)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addSpawnPoint}>
            Add Spawn Point
          </Button>
        </Section>

        {/* ── Territory ── */}
        <Section
          title="Territory"
          open={openTerritory}
          onToggle={() => setOpenTerritory((v) => !v)}
          enabled={data.territory !== null}
          onEnable={enableTerritory}
        >
          {data.territory !== null && (
            <>
              {data.territory.map((m, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                  <MapPicker
                    label="Map"
                    value={m}
                    sx={{ flex: 1 }}
                    onChange={(val) => setTerritoryMap(i, val)}
                  />
                  <IconButton size="small" color="error" onClick={() => removeTerritoryMap(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={addTerritoryMap}>
                Add Map
              </Button>
            </>
          )}
        </Section>

        <Box sx={{ height: 32 }} />
      </Box>
      <NationCrestPickerDialog
        open={flagPickerOpen}
        value={data.flag}
        onClose={() => setFlagPickerOpen(false)}
        onChange={(val) => {
          updateData((d) => ({ ...d, flag: String(val) }))
          setFlagPickerOpen(false)
        }}
      />
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

export default NationEditor
