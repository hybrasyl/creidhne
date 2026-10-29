import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Box,
  Divider,
  TextField,
  Paper,
  Autocomplete,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography
} from '@mui/material'
import { useStoreValue, libraryIndexState } from '../../store/appStore'
import { useDuplicateName } from '../../hooks/useDuplicateName'
import CommentField from '../shared/CommentField'
import EditorHeader from '../shared/EditorHeader'
import IconPicker from '../shared/IconPicker'
import StatsTab from '../shared/StatsTab'
import { normalizeFolder } from '../../utils/fileTree'
import { EXCLUSIVE_POLICIES, ICON_SETS, validateTrait } from '@shared/traitValidate'

// The Trait editor (HXML-28, HTOO-617). A trait is a passive property of a
// character: a name, an icon, an optional exclusive group and conflicts, and
// stat modifiers.

function computeTraitFilename(prefix, name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '')
  if (!safe) return ''
  const p = (prefix || '').trim().toLowerCase().replace(/\s+/g, '_')
  return p ? `${p}_${safe}.xml` : `${safe}.xml`
}

function deriveTraitPrefix(fileName, name) {
  if (!fileName) return 'trait'
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '')
  const base = fileName.replace(/\.xml$/i, '')
  if (safe && base.endsWith(`_${safe}`)) {
    const p = base.slice(0, base.length - safe.length - 1)
    return p || 'trait'
  }
  return 'trait'
}

/** A free-text field with suggestions, for Category and ExclusiveGroup. */
function SuggestField({ label, value, options, onChange, sx, helperText }) {
  return (
    <Autocomplete
      freeSolo
      options={options}
      value={value}
      onInputChange={(_, val, reason) => {
        if (reason === 'input' || reason === 'clear') onChange(val)
      }}
      onChange={(_, val) => onChange(val ?? '')}
      size="small"
      sx={sx}
      renderInput={(params) => <TextField {...params} label={label} helperText={helperText} />}
    />
  )
}

function TraitEditor({
  trait,
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
  const [data, setData] = useState(trait)
  const [prefix, setPrefix] = useState(() => deriveTraitPrefix(initialFileName, trait.name))
  const [fileName, setFileName] = useState(
    initialFileName || computeTraitFilename('trait', trait.name)
  )
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName)
  const [folder, setFolder] = useState(initialFolder)

  const isDirtyRef = useRef(false)

  // ── Duplicate detection ────────────────────────────────────────────────────
  const dupStatus = useDuplicateName({
    type: 'traits',
    name: data.name,
    originalName: trait.name,
    isExisting
  })

  const [dupSnack, setDupSnack] = useState(null)
  const handleNameBlur = () => {
    if (dupStatus) setDupSnack(dupStatus)
  }

  useEffect(() => {
    const p = deriveTraitPrefix(initialFileName, trait.name)
    setData(trait)
    setPrefix(p)
    setFileName(initialFileName || computeTraitFilename(p, trait.name))
    setFileNameEdited(!!initialFileName)
    setFolder(initialFolder)
    isDirtyRef.current = false
    onDirtyChange?.(false)
    setDupSnack(null)
  }, [trait, initialFileName, initialFolder]) // eslint-disable-line react-hooks/exhaustive-deps

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
        if (!fileNameEdited) setFileName(computeTraitFilename(prefix, next.name))
        return next
      })
    },
    [fileNameEdited, prefix, markDirtyLocal]
  )

  const setField = (field) => (value) => updateData((d) => ({ ...d, [field]: value }))

  const handlePrefixChange = (e) => {
    markDirtyLocal()
    setPrefix(e.target.value)
    if (!fileNameEdited) setFileName(computeTraitFilename(e.target.value, data.name))
  }

  const handleFolderChange = (val) => {
    markDirtyLocal()
    setFolder(val)
  }

  const handleRegenerate = () => {
    markDirtyLocal()
    setFileName(computeTraitFilename(prefix, data.name))
    setFileNameEdited(false)
  }

  if (saveRef) saveRef.current = () => onSave(data, fileName, normalizeFolder(folder))

  // ── Index-backed choices ──────────────────────────────────────────────────
  const traitNames = useMemo(() => libraryIndex.traits || [], [libraryIndex])
  const categories = libraryIndex.traitCategories || []
  const groups = Object.keys(libraryIndex.traitExclusiveGroups || {})
  // Not the trait itself (under its saved name or the one being typed).
  const conflictOptions = traitNames.filter((n) => n !== data.name && n !== trait.name)

  // The "is a trait" check needs the index; before it is built, skip it.
  const problems = validateTrait(data, libraryIndex.traits ? traitNames : null)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <EditorHeader
        title={data.name || '(unnamed trait)'}
        entityLabel="trait"
        fileName={fileName}
        initialFileName={initialFileName}
        computedFileName={computeTraitFilename(prefix, data.name)}
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
        {problems.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            The server refuses this trait until you correct these problems.
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {problems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </Box>
          </Alert>
        )}

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <TextField
                label="Prefix"
                size="small"
                sx={{ width: 120 }}
                value={prefix}
                onChange={handlePrefixChange}
                slotProps={{ htmlInput: { maxLength: 64, spellCheck: false } }}
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
                onChange={(e) => setField('name')(e.target.value)}
                onBlur={handleNameBlur}
                slotProps={{ htmlInput: { maxLength: 255 } }}
              />
              <SuggestField
                label="Category"
                value={data.category}
                options={categories}
                onChange={setField('category')}
                sx={{ width: 200 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <IconPicker
                type={data.iconSet === 'Spell' ? 'spell' : 'skill'}
                value={data.icon}
                onChange={setField('icon')}
              />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel id="trait-icon-set-label">Icon Set</InputLabel>
                <Select
                  labelId="trait-icon-set-label"
                  value={data.iconSet}
                  label="Icon Set"
                  onChange={(e) => setField('iconSet')(e.target.value)}
                >
                  {ICON_SETS.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <TextField
              label="Description"
              size="small"
              multiline
              minRows={2}
              value={data.description}
              onChange={(e) => setField('description')(e.target.value)}
            />
            <CommentField
              value={data.comment}
              onChange={(e) => setField('comment')(e.target.value)}
            />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Exclusivity
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start', mb: 2 }}>
            <SuggestField
              label="Exclusive Group"
              value={data.exclusiveGroup}
              options={groups}
              onChange={setField('exclusiveGroup')}
              sx={{ width: 220 }}
              helperText="A character has at most one trait from each group."
            />
            {data.exclusiveGroup && (
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="trait-policy-label">When the group is taken</InputLabel>
                <Select
                  labelId="trait-policy-label"
                  value={data.exclusivePolicy || 'Reject'}
                  label="When the group is taken"
                  onChange={(e) =>
                    // Reject is the schema default, so it is not written.
                    setField('exclusivePolicy')(e.target.value === 'Reject' ? '' : e.target.value)
                  }
                >
                  {EXCLUSIVE_POLICIES.map((p) => (
                    <MenuItem key={p} value={p}>
                      {p === 'Reject' ? 'Reject this trait' : 'Replace the trait it has'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
          <Autocomplete
            multiple
            freeSolo
            filterSelectedOptions
            options={conflictOptions}
            value={data.conflictsWith}
            onChange={(_, vals) =>
              setField('conflictsWith')(vals.map((v) => v.trim()).filter(Boolean))
            }
            size="small"
            renderInput={(params) => (
              <TextField
                {...params}
                label="Conflicts With"
                helperText="A conflict applies in both directions, so list it on one of the two traits."
              />
            )}
          />
        </Paper>

        <StatsTab data={data.statModifiers} onChange={setField('statModifiers')} />
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

export default TraitEditor
