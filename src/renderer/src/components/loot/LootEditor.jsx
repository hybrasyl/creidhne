import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Box,
  Typography,
  Divider,
  TextField,
  IconButton,
  Paper,
  Autocomplete,
  Collapse,
  Checkbox,
  FormControlLabel,
  Snackbar,
  Alert,
  Button
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { useRecoilValue } from 'recoil'
import { libraryIndexState } from '../../recoil/atoms'
import CommentField from '../shared/CommentField'
import EditorHeader from '../shared/EditorHeader'

function deriveLootPrefix(fileName, name) {
  if (!fileName) return 'lts'
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '')
  const base = fileName.replace(/\.xml$/i, '')
  if (safe && base.endsWith(`_${safe}`)) {
    const p = base.slice(0, base.length - safe.length - 1)
    return p || 'lts'
  }
  return 'lts'
}

function computeLootFilename(filePrefix, name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '')
  if (!safe) return ''
  return `${filePrefix || 'lts'}_${safe}.xml`
}

// ── Collapsible section wrapper ───────────────────────────────────────────────
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

// ── Main editor ───────────────────────────────────────────────────────────────
function LootEditor({
  loot,
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
  const itemNames = libraryIndex.items || []
  const variantNames = libraryIndex.variantgroups || []

  const [data, setData] = useState(loot)
  const [prefix, setPrefix] = useState(deriveLootPrefix(initialFileName, loot.name))
  const [fileName, setFileName] = useState(
    initialFileName || computeLootFilename(deriveLootPrefix(initialFileName, loot.name), loot.name)
  )
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName)
  const [openTable, setOpenTable] = useState(true)
  const [openItems, setOpenItems] = useState(true)

  const isDirtyRef = useRef(false)

  useEffect(() => {
    const derivedPrefix = deriveLootPrefix(initialFileName, loot.name)
    setData(loot)
    setPrefix(derivedPrefix)
    setFileName(initialFileName || computeLootFilename(derivedPrefix, loot.name))
    setFileNameEdited(!!initialFileName)
    isDirtyRef.current = false
    setDupSnack(null)
    onDirtyChange?.(false)
  }, [loot, initialFileName]) // eslint-disable-line react-hooks/exhaustive-deps

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
        if (!fileNameEdited) setFileName(computeLootFilename(prefix, next.name))
        return next
      })
    },
    [fileNameEdited, prefix, markDirtyLocal]
  )

  const handlePrefixChange = (e) => {
    markDirtyLocal()
    const p = e.target.value
    setPrefix(p)
    if (!fileNameEdited) setFileName(computeLootFilename(p, data.name))
  }

  const handleRegenerate = () => {
    markDirtyLocal()
    setFileName(computeLootFilename(prefix, data.name))
    setFileNameEdited(false)
  }

  // ── Duplicate detection ──────────────────────────────────────────────────────

  const dupStatus = useMemo(() => {
    const name = (data.name || '').trim()
    if (!name) return null
    const originalName = isExisting ? loot.name || '' : ''
    if (originalName && name.toLowerCase() === originalName.toLowerCase()) return null

    const activeNames = libraryIndex?.lootsets || []
    if (activeNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'active'

    const archivedNames = libraryIndex?.archivedLootsets || []
    if (archivedNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'archived'

    return null
  }, [data.name, libraryIndex, isExisting, loot.name])

  const [dupSnack, setDupSnack] = useState(null)
  const handleNameBlur = () => {
    if (dupStatus) setDupSnack(dupStatus)
  }

  if (saveRef) saveRef.current = () => onSave(data, fileName)

  const setTable = (field, val) =>
    updateData((d) => ({ ...d, table: { ...d.table, [field]: val } }))

  const setGold = (field, val) =>
    updateData((d) => ({ ...d, table: { ...d.table, gold: { ...d.table.gold, [field]: val } } }))

  const setXp = (field, val) =>
    updateData((d) => ({ ...d, table: { ...d.table, xp: { ...d.table.xp, [field]: val } } }))

  const setItemsField = (field, val) =>
    updateData((d) => ({ ...d, table: { ...d.table, items: { ...d.table.items, [field]: val } } }))

  const addEntry = () =>
    updateData((d) => ({
      ...d,
      table: {
        ...d.table,
        items: {
          ...d.table.items,
          entries: [
            ...d.table.items.entries,
            { name: '', variants: [], unique: false, always: false, inInventory: false, max: '' }
          ]
        }
      }
    }))

  const setEntry = useCallback(
    (i, field, val) =>
      updateData((d) => ({
        ...d,
        table: {
          ...d.table,
          items: {
            ...d.table.items,
            entries: d.table.items.entries.map((e, idx) => (idx === i ? { ...e, [field]: val } : e))
          }
        }
      })),
    [updateData]
  )

  const removeEntry = (i) =>
    updateData((d) => ({
      ...d,
      table: {
        ...d.table,
        items: {
          ...d.table.items,
          entries: d.table.items.entries.filter((_, idx) => idx !== i)
        }
      }
    }))

  const computedFileName = computeLootFilename(prefix, data.name)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <EditorHeader
        title={data.name || '(unnamed loot set)'}
        entityLabel="loot set"
        fileName={fileName}
        initialFileName={initialFileName}
        computedFileName={computedFileName}
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <TextField
                label="Prefix"
                value={prefix}
                size="small"
                sx={{ width: 140 }}
                onChange={handlePrefixChange}
                inputProps={{ maxLength: 64, spellCheck: false }}
              />
              <TextField
                label="Name"
                value={data.name}
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
                onChange={(e) => updateData((d) => ({ ...d, name: e.target.value }))}
                onBlur={handleNameBlur}
                inputProps={{ maxLength: 255 }}
              />
              <FormControlLabel
                label="In Inventory"
                sx={{ m: 0, alignSelf: 'center' }}
                control={
                  <Checkbox
                    size="small"
                    checked={data.inInventory}
                    onChange={(e) => updateData((d) => ({ ...d, inInventory: e.target.checked }))}
                  />
                }
              />
            </Box>
            <CommentField
              value={data.comment}
              onChange={(e) => updateData((d) => ({ ...d, comment: e.target.value }))}
            />
          </Box>
        </Paper>

        {/* ── Table ── */}
        <Section title="Table" open={openTable} onToggle={() => setOpenTable((v) => !v)}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                label="Number of Rolls"
                value={data.table.rolls}
                size="small"
                sx={{ flex: 1 }}
                onChange={(e) => setTable('rolls', e.target.value)}
              />
              <TextField
                label="Chance"
                value={data.table.chance}
                size="small"
                sx={{ flex: 1 }}
                onChange={(e) => setTable('chance', e.target.value)}
              />
              <FormControlLabel
                label="In Inventory"
                sx={{ m: 0, flexShrink: 0 }}
                control={
                  <Checkbox
                    size="small"
                    checked={data.table.inInventory}
                    onChange={(e) => setTable('inInventory', e.target.checked)}
                  />
                }
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Gold Min"
                value={data.table.gold.min}
                size="small"
                sx={{ flex: 1 }}
                onChange={(e) => setGold('min', e.target.value)}
              />
              <TextField
                label="Gold Max"
                value={data.table.gold.max}
                size="small"
                sx={{ flex: 1 }}
                onChange={(e) => setGold('max', e.target.value)}
              />
              <TextField
                label="XP Min"
                value={data.table.xp.min}
                size="small"
                sx={{ flex: 1 }}
                onChange={(e) => setXp('min', e.target.value)}
              />
              <TextField
                label="XP Max"
                value={data.table.xp.max}
                size="small"
                sx={{ flex: 1 }}
                onChange={(e) => setXp('max', e.target.value)}
              />
            </Box>
          </Box>
        </Section>

        {/* ── Items ── */}
        <Section title="Items" open={openItems} onToggle={() => setOpenItems((v) => !v)}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="Number of Rolls"
              value={data.table.items.rolls}
              size="small"
              sx={{ flex: 1 }}
              onChange={(e) => setItemsField('rolls', e.target.value)}
            />
            <TextField
              label="Chance"
              value={data.table.items.chance}
              size="small"
              sx={{ flex: 1 }}
              onChange={(e) => setItemsField('chance', e.target.value)}
            />
          </Box>

          {data.table.items.entries.map((entry, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                <Autocomplete
                  freeSolo
                  options={itemNames}
                  value={entry.name}
                  onInputChange={(_, val, reason) => {
                    if (reason === 'input') setEntry(i, 'name', val)
                  }}
                  onChange={(_, val) => {
                    if (val !== null) setEntry(i, 'name', val)
                  }}
                  size="small"
                  sx={{ flex: 1 }}
                  renderInput={(params) => <TextField {...params} label="Item" />}
                />
                <TextField
                  label="Maximum Drop"
                  value={entry.max}
                  size="small"
                  sx={{ width: 120 }}
                  onChange={(e) => setEntry(i, 'max', e.target.value)}
                />
                <IconButton size="small" color="error" onClick={() => removeEntry(i)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Autocomplete
                  multiple
                  options={variantNames}
                  value={entry.variants}
                  onChange={(_, val) => setEntry(i, 'variants', val)}
                  size="small"
                  sx={{ flex: 1 }}
                  renderInput={(params) => <TextField {...params} label="Variants" />}
                />
                <FormControlLabel
                  label="Unique"
                  sx={{ ml: 0.5, mr: 0 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={entry.unique}
                      onChange={(e) => setEntry(i, 'unique', e.target.checked)}
                    />
                  }
                />
                <FormControlLabel
                  label="Always"
                  sx={{ ml: 0.5, mr: 0 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={entry.always}
                      onChange={(e) => setEntry(i, 'always', e.target.checked)}
                    />
                  }
                />
                <FormControlLabel
                  label="In Inventory"
                  sx={{ ml: 0.5, mr: 0 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={entry.inInventory}
                      onChange={(e) => setEntry(i, 'inInventory', e.target.checked)}
                    />
                  }
                />
              </Box>
            </Paper>
          ))}

          <Button size="small" startIcon={<AddIcon />} onClick={addEntry}>
            Add Item
          </Button>
        </Section>

        <Box sx={{ height: 32 }} />
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

export default LootEditor
