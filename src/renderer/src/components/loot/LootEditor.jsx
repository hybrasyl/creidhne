import { useState, useEffect, useCallback, useRef } from 'react'
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
import { useStoreValue, libraryIndexState } from '../../store/appStore'
import { useDuplicateName } from '../../hooks/useDuplicateName'
import CommentField from '../shared/CommentField'
import EditorHeader from '../shared/EditorHeader'
import { normalizeFolder } from '../../utils/fileTree'
import { emptyItemsList, emptyLootEntry, emptyLootTable } from '@shared/lootModel.js'

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
function Section({ title, open, onToggle, action, children }) {
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
        {action}
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>
      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: 2 }}>{children}</Box>
      </Collapse>
    </Paper>
  )
}

// ── One item in an Items list ─────────────────────────────────────────────────
function LootEntry({ entry, itemNames, variantNames, onChange, onRemove }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
        <Autocomplete
          freeSolo
          options={itemNames}
          value={entry.name}
          onInputChange={(_, val, reason) => {
            if (reason === 'input') onChange('name', val)
          }}
          onChange={(_, val) => {
            if (val !== null) onChange('name', val)
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
          onChange={(e) => onChange('max', e.target.value)}
        />
        <IconButton size="small" color="error" onClick={onRemove}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Autocomplete
          multiple
          options={variantNames}
          value={entry.variants}
          onChange={(_, val) => onChange('variants', val)}
          size="small"
          sx={{ flex: 1 }}
          renderInput={(params) => <TextField {...params} label="Variants" />}
        />
        {[
          ['unique', 'Unique'],
          ['always', 'Always'],
          ['inInventory', 'In Inventory']
        ].map(([field, label]) => (
          <FormControlLabel
            key={field}
            label={label}
            sx={{ ml: 0.5, mr: 0 }}
            control={
              <Checkbox
                size="small"
                checked={entry[field]}
                onChange={(e) => onChange(field, e.target.checked)}
              />
            }
          />
        ))}
      </Box>
    </Paper>
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────
function LootEditor({
  loot,
  initialFileName,
  initialFolder = '',
  folderOptions,
  isArchived,
  isExisting,
  onSave,
  onArchive,
  onUnarchive,
  onDirtyChange,
  saveRef
}) {
  const libraryIndex = useStoreValue(libraryIndexState)
  const itemNames = libraryIndex.items || []
  const variantNames = libraryIndex.variantgroups || []

  const [data, setData] = useState(loot)
  const [prefix, setPrefix] = useState(deriveLootPrefix(initialFileName, loot.name))
  const [fileName, setFileName] = useState(
    initialFileName || computeLootFilename(deriveLootPrefix(initialFileName, loot.name), loot.name)
  )
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName)
  const [folder, setFolder] = useState(initialFolder)
  // The tables the author has collapsed, by index. All start open.
  const [collapsed, setCollapsed] = useState(() => new Set())
  const toggleTable = (ti) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(ti)) next.delete(ti)
      else next.add(ti)
      return next
    })

  const isDirtyRef = useRef(false)

  useEffect(() => {
    const derivedPrefix = deriveLootPrefix(initialFileName, loot.name)
    setData(loot)
    setPrefix(derivedPrefix)
    setFileName(initialFileName || computeLootFilename(derivedPrefix, loot.name))
    setFileNameEdited(!!initialFileName)
    setFolder(initialFolder)
    isDirtyRef.current = false
    setDupSnack(null)
    onDirtyChange?.(false)
  }, [loot, initialFileName, initialFolder]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleFolderChange = (val) => {
    markDirtyLocal()
    setFolder(val)
  }

  const handleRegenerate = () => {
    markDirtyLocal()
    setFileName(computeLootFilename(prefix, data.name))
    setFileNameEdited(false)
  }

  // ── Duplicate detection ──────────────────────────────────────────────────────

  const dupStatus = useDuplicateName({
    type: 'lootsets',
    name: data.name,
    originalName: loot.name,
    isExisting
  })

  const [dupSnack, setDupSnack] = useState(null)
  const handleNameBlur = () => {
    if (dupStatus) setDupSnack(dupStatus)
  }

  if (saveRef) saveRef.current = () => onSave(data, fileName, normalizeFolder(folder))

  // A loot set holds one or more tables, and a table any number of Items
  // lists (HTOO-522). The editor showed the first of each before, and a save
  // deleted the rest.
  const updateTable = (ti, fn) =>
    updateData((d) => ({ ...d, tables: d.tables.map((t, i) => (i === ti ? fn(t) : t)) }))
  const setTable = (ti, field, val) => updateTable(ti, (t) => ({ ...t, [field]: val }))
  const setGold = (ti, field, val) =>
    updateTable(ti, (t) => ({ ...t, gold: { ...t.gold, [field]: val } }))
  const setXp = (ti, field, val) =>
    updateTable(ti, (t) => ({ ...t, xp: { ...t.xp, [field]: val } }))
  const addTable = () => updateData((d) => ({ ...d, tables: [...d.tables, emptyLootTable()] }))
  const removeTable = (ti) => {
    updateData((d) => ({ ...d, tables: d.tables.filter((_, i) => i !== ti) }))
    setCollapsed(new Set())
  }

  const updateList = (ti, li, fn) =>
    updateTable(ti, (t) => ({ ...t, lists: t.lists.map((l, i) => (i === li ? fn(l) : l)) }))
  const setListField = (ti, li, field, val) => updateList(ti, li, (l) => ({ ...l, [field]: val }))
  const addList = (ti) => updateTable(ti, (t) => ({ ...t, lists: [...t.lists, emptyItemsList()] }))
  const removeList = (ti, li) =>
    updateTable(ti, (t) => ({ ...t, lists: t.lists.filter((_, i) => i !== li) }))

  const addEntry = (ti, li) =>
    updateList(ti, li, (l) => ({ ...l, entries: [...l.entries, emptyLootEntry()] }))
  const setEntry = (ti, li, ei, field, val) =>
    updateList(ti, li, (l) => ({
      ...l,
      entries: l.entries.map((e, i) => (i === ei ? { ...e, [field]: val } : e))
    }))
  const removeEntry = (ti, li, ei) =>
    updateList(ti, li, (l) => ({ ...l, entries: l.entries.filter((_, i) => i !== ei) }))

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
        folder={folder}
        folderOptions={folderOptions}
        initialFolder={initialFolder}
        onFolderChange={handleFolderChange}
        onRegenerate={handleRegenerate}
        onSave={() => onSave(data, fileName, normalizeFolder(folder))}
        onRenameFile={() => onSave(data, fileName, normalizeFolder(folder), 'rename')}
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
                slotProps={{
                  htmlInput: { maxLength: 64, spellCheck: false }
                }}
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
                slotProps={{
                  htmlInput: { maxLength: 255 }
                }}
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

        {/* ── Tables ── */}
        {data.tables.map((table, ti) => (
          <Section
            key={ti}
            title={data.tables.length > 1 ? `Table ${ti + 1}` : 'Table'}
            open={!collapsed.has(ti)}
            onToggle={() => toggleTable(ti)}
            action={
              // The XSD requires one table, so the last one cannot be removed.
              data.tables.length > 1 && (
                <IconButton
                  size="small"
                  color="error"
                  aria-label={`Remove table ${ti + 1}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeTable(ti)
                  }}
                  sx={{ mr: 1 }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )
            }
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                  label="Number of Rolls"
                  value={table.rolls}
                  size="small"
                  sx={{ flex: 1 }}
                  onChange={(e) => setTable(ti, 'rolls', e.target.value)}
                />
                <TextField
                  label="Chance"
                  value={table.chance}
                  size="small"
                  sx={{ flex: 1 }}
                  onChange={(e) => setTable(ti, 'chance', e.target.value)}
                />
                <FormControlLabel
                  label="In Inventory"
                  sx={{ m: 0, flexShrink: 0 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={table.inInventory}
                      onChange={(e) => setTable(ti, 'inInventory', e.target.checked)}
                    />
                  }
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  label="Gold Min"
                  value={table.gold.min}
                  size="small"
                  sx={{ flex: 1 }}
                  onChange={(e) => setGold(ti, 'min', e.target.value)}
                />
                <TextField
                  label="Gold Max"
                  value={table.gold.max}
                  size="small"
                  sx={{ flex: 1 }}
                  onChange={(e) => setGold(ti, 'max', e.target.value)}
                />
                <TextField
                  label="XP Min"
                  value={table.xp.min}
                  size="small"
                  sx={{ flex: 1 }}
                  onChange={(e) => setXp(ti, 'min', e.target.value)}
                />
                <TextField
                  label="XP Max"
                  value={table.xp.max}
                  size="small"
                  sx={{ flex: 1 }}
                  onChange={(e) => setXp(ti, 'max', e.target.value)}
                />
              </Box>

              {table.lists.map((list, li) => (
                <Paper key={li} variant="outlined" sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ width: 64, flexShrink: 0 }}>
                      {table.lists.length > 1 ? `Items ${li + 1}` : 'Items'}
                    </Typography>
                    <TextField
                      label="Number of Rolls"
                      value={list.rolls}
                      size="small"
                      sx={{ flex: 1 }}
                      onChange={(e) => setListField(ti, li, 'rolls', e.target.value)}
                    />
                    <TextField
                      label="Chance"
                      value={list.chance}
                      size="small"
                      sx={{ flex: 1 }}
                      onChange={(e) => setListField(ti, li, 'chance', e.target.value)}
                    />
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={`Remove items list ${li + 1}`}
                      onClick={() => removeList(ti, li)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  {list.entries.map((entry, ei) => (
                    <LootEntry
                      key={ei}
                      entry={entry}
                      itemNames={itemNames}
                      variantNames={variantNames}
                      onChange={(field, val) => setEntry(ti, li, ei, field, val)}
                      onRemove={() => removeEntry(ti, li, ei)}
                    />
                  ))}

                  <Button size="small" startIcon={<AddIcon />} onClick={() => addEntry(ti, li)}>
                    Add Item
                  </Button>
                </Paper>
              ))}

              <Box>
                <Button size="small" startIcon={<AddIcon />} onClick={() => addList(ti)}>
                  Add Items List
                </Button>
              </Box>
            </Box>
          </Section>
        ))}

        <Button size="small" startIcon={<AddIcon />} onClick={addTable}>
          Add Table
        </Button>

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
