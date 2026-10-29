import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box,
  Button,
  Divider,
  TextField,
  Paper,
  Snackbar,
  Alert,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  IconButton,
  Radio
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { useStoreValue, libraryIndexState } from '../../store/appStore'
import { useDuplicateName } from '../../hooks/useDuplicateName'
import CommentField from '../shared/CommentField'
import EditorHeader from '../shared/EditorHeader'
import { ElementField } from '../shared/ElementFields'
import { normalizeFolder } from '../../utils/fileTree'
import { nameCollisionKey } from '@shared/nameCollision.js'
import {
  PLAYER_OPTIONS,
  SPECIES_ORIGINS,
  branchParents,
  isValidKey,
  validateSpecies
} from '@shared/speciesValidate'

// The Species editor (HXML-37, HTOO-618). A species is keyed by its Key
// attribute, which plays the part of the name for the duplicate check.
//
// Player saves store the species key and the body keys, so a saved key never
// changes (Species.xsd). The editor locks both after the first save. The one
// exception is a key that two files hold, which is what Duplicate makes: the
// copy must get a new key.

function computeSpeciesFilename(prefix, key) {
  const safe = (key || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '')
  if (!safe) return ''
  const p = (prefix || '').trim().toLowerCase().replace(/\s+/g, '_')
  return p ? `${p}_${safe}.xml` : `${safe}.xml`
}

function deriveSpeciesPrefix(fileName, key) {
  if (!fileName) return 'species'
  const safe = (key || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '')
  const base = fileName.replace(/\.xml$/i, '')
  if (safe && base.endsWith(`_${safe}`)) {
    const p = base.slice(0, base.length - safe.length - 1)
    return p || 'species'
  }
  return 'species'
}

const BLANK_BODY = { key: '', id: '', name: '', isDefault: false, retailSkinColor: '' }

/**
 * The species with each body's key as it is on disk, or null for a body that
 * is not saved. An edit keeps the field, so a row stays tied to its saved key.
 */
const markSaved = (species, isExisting) => ({
  ...species,
  bodies: species.bodies.map((b) => ({ ...b, savedKey: isExisting ? b.key : null }))
})

/** A labelled Select over fixed values. */
function ChoiceField({ id, label, value, options, onChange, sx }) {
  return (
    <FormControl size="small" sx={sx} required>
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select
        labelId={`${id}-label`}
        value={value}
        label={label}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <MenuItem key={o} value={o}>
            {o}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

function SpeciesEditor({
  species,
  initialFileName,
  initialFolder = '',
  folderOptions,
  isArchived,
  isExisting,
  onSave,
  onArchive,
  onUnarchive,
  onDirtyChange,
  saveRef,
  loadParent
}) {
  const libraryIndex = useStoreValue(libraryIndexState)
  const [data, setData] = useState(() => markSaved(species, isExisting))
  const [prefix, setPrefix] = useState(() => deriveSpeciesPrefix(initialFileName, species.key))
  const [fileName, setFileName] = useState(
    initialFileName || computeSpeciesFilename('species', species.key)
  )
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName)
  const [folder, setFolder] = useState(initialFolder)
  const [parent, setParent] = useState(null)

  const isDirtyRef = useRef(false)

  // ── Duplicate detection ────────────────────────────────────────────────────
  const dupStatus = useDuplicateName({
    type: 'species',
    name: data.key,
    originalName: species.key,
    isExisting
  })

  const [dupSnack, setDupSnack] = useState(null)
  const handleKeyBlur = () => {
    if (dupStatus) setDupSnack(dupStatus)
  }

  useEffect(() => {
    const p = deriveSpeciesPrefix(initialFileName, species.key)
    setData(markSaved(species, isExisting))
    setPrefix(p)
    setFileName(initialFileName || computeSpeciesFilename(p, species.key))
    setFileNameEdited(!!initialFileName)
    setFolder(initialFolder)
    isDirtyRef.current = false
    onDirtyChange?.(false)
    setDupSnack(null)
  }, [species, initialFileName, initialFolder]) // eslint-disable-line react-hooks/exhaustive-deps

  // A branch shows what it takes from its parent, read from the parent's file.
  useEffect(() => {
    let cancelled = false
    if (!data.branchOf || !loadParent) {
      setParent(null)
      return undefined
    }
    loadParent(data.branchOf)
      .then((p) => !cancelled && setParent(p))
      .catch(() => !cancelled && setParent(null))
    return () => {
      cancelled = true
    }
  }, [data.branchOf, loadParent])

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
        if (!fileNameEdited) setFileName(computeSpeciesFilename(prefix, next.key))
        return next
      })
    },
    [fileNameEdited, prefix, markDirtyLocal]
  )

  const setField = (field) => (value) => updateData((d) => ({ ...d, [field]: value }))
  const setName = (form) => (e) =>
    updateData((d) => ({ ...d, names: { ...d.names, [form]: e.target.value } }))

  const handlePrefixChange = (e) => {
    markDirtyLocal()
    setPrefix(e.target.value)
    if (!fileNameEdited) setFileName(computeSpeciesFilename(e.target.value, data.key))
  }

  const handleFolderChange = (val) => {
    markDirtyLocal()
    setFolder(val)
  }

  const handleRegenerate = () => {
    markDirtyLocal()
    setFileName(computeSpeciesFilename(prefix, data.key))
    setFileNameEdited(false)
  }

  if (saveRef) saveRef.current = () => onSave(data, fileName, normalizeFolder(folder))

  // ── Bodies ────────────────────────────────────────────────────────────────
  const setBodies = (fn) => updateData((d) => ({ ...d, bodies: fn(d.bodies) }))
  const setBody = (i, field, value) =>
    setBodies((bs) => bs.map((b, j) => (j === i ? { ...b, [field]: value } : b)))
  const setDefaultBody = (i) => setBodies((bs) => bs.map((b, j) => ({ ...b, isDefault: j === i })))
  const moveBody = (i, by) =>
    setBodies((bs) => {
      const j = i + by
      if (j < 0 || j >= bs.length) return bs
      const next = [...bs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  // The first body of a species is its default, so a new species needs no extra step.
  const addBody = () => setBodies((bs) => [...bs, { ...BLANK_BODY, isDefault: bs.length === 0 }])

  // ── Index-backed choices and checks ───────────────────────────────────────
  const keyShared =
    (libraryIndex.speciesDuplicateNames?.[nameCollisionKey(String(species.key ?? ''))]?.length ??
      0) > 1
  // A saved key that the server refuses was never loaded, so no save holds it.
  const keyLocked = isExisting && !keyShared && isValidKey(species.key)
  const bodyKeyLocked = (b) =>
    b.savedKey != null &&
    isValidKey(b.savedKey) &&
    species.bodies.filter((o) => nameCollisionKey(o.key) === nameCollisionKey(b.savedKey))
      .length === 1
  // A value that is not a valid parent stays in the list, so the select shows
  // it and the problem list says what is wrong with it.
  const parents = branchParents(libraryIndex.speciesDetails, species.key)
  const parentOptions =
    data.branchOf && !parents.includes(data.branchOf) ? [data.branchOf, ...parents] : parents
  const problems = validateSpecies(
    data,
    libraryIndex.speciesDetails
      ? {
          details: libraryIndex.speciesDetails,
          bodyIds: libraryIndex.speciesBodyIds,
          duplicateNames: libraryIndex.speciesDuplicateNames,
          originalKey: isExisting ? species.key : null
        }
      : undefined
  )

  const isBranch = !!data.branchOf
  const inherited = (field) =>
    isBranch
      ? parent?.[field]
        ? {
            placeholder: parent[field],
            helperText: `Empty: takes ${parent[field]} from ${data.branchOf}`
          }
        : { helperText: `Empty: takes the value of ${data.branchOf}` }
      : {}

  const cell = { padding: '2px 4px' }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ── */}
      <EditorHeader
        title={data.key || '(unnamed species)'}
        entityLabel="species"
        fileName={fileName}
        initialFileName={initialFileName}
        computedFileName={computeSpeciesFilename(prefix, data.key)}
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
            The server refuses this species until you correct these problems.
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
                label="Key"
                size="small"
                required
                disabled={keyLocked}
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
                    ? `"${data.key}" already exists`
                    : dupStatus === 'archived'
                      ? `"${data.key}" exists in archive`
                      : keyLocked
                        ? 'Saves store the key, so it never changes.'
                        : keyShared
                          ? 'Another file has this key. Give this species a new key.'
                          : 'Saves store the key. It cannot change after the first save.'
                }
                value={data.key}
                onChange={(e) => setField('key')(e.target.value)}
                onBlur={handleKeyBlur}
                slotProps={{ htmlInput: { maxLength: 64, spellCheck: false } }}
              />
              <TextField
                label="Id"
                size="small"
                required
                sx={{ width: 90 }}
                value={data.id}
                onChange={(e) => setField('id')(e.target.value.replace(/\D/g, ''))}
                slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 3 } }}
              />
              <ChoiceField
                id="species-origin"
                label="Origin"
                value={data.origin}
                options={SPECIES_ORIGINS}
                onChange={setField('origin')}
                sx={{ minWidth: 140 }}
              />
              <ChoiceField
                id="species-player-option"
                label="Player Option"
                value={data.playerOption}
                options={PLAYER_OPTIONS}
                onChange={setField('playerOption')}
                sx={{ minWidth: 160 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                label="Singular"
                size="small"
                required
                sx={{ flex: 1, minWidth: 140 }}
                value={data.names.singular}
                onChange={setName('singular')}
              />
              <TextField
                label="Plural"
                size="small"
                required
                sx={{ flex: 1, minWidth: 140 }}
                value={data.names.plural}
                onChange={setName('plural')}
              />
              <TextField
                label="Adjective"
                size="small"
                required
                sx={{ flex: 1, minWidth: 140 }}
                value={data.names.adjective}
                onChange={setName('adjective')}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <FormControl size="small" sx={{ width: 200 }}>
                <InputLabel id="species-branch-of-label">Branch Of</InputLabel>
                <Select
                  labelId="species-branch-of-label"
                  value={data.branchOf}
                  label="Branch Of"
                  onChange={(e) => setField('branchOf')(e.target.value)}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {parentOptions.map((k) => (
                    <MenuItem key={k} value={k}>
                      {k}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>A ByBranch species that is not a branch</FormHelperText>
              </FormControl>
              <ElementField
                label="Affinity"
                value={data.affinity}
                onChange={setField('affinity')}
                sx={{ width: 200 }}
                {...inherited('affinity')}
              />
              <ElementField
                label="Resistance"
                value={data.resistance}
                onChange={setField('resistance')}
                sx={{ width: 200 }}
                {...inherited('resistance')}
              />
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
            Bodies
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            Each body is one pre-coloured sprite set. A body Id is unique across all species. Saves
            store the body key, so it never changes after the first save. The retail skin colour is
            only what a retail client sees, from 0 to 9, and many bodies can share one.
          </Typography>
          {data.bodies.length > 0 && (
            <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Key', 'Id', 'Name', 'Default', 'Retail Skin', ''].map((h) => (
                    <th key={h} style={{ ...cell, textAlign: 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.bodies.map((b, i) => (
                  <tr key={i}>
                    <td style={cell}>
                      <TextField
                        size="small"
                        value={b.key}
                        disabled={bodyKeyLocked(b)}
                        onChange={(e) => setBody(i, 'key', e.target.value)}
                        sx={{ width: 140 }}
                        slotProps={{
                          htmlInput: { 'aria-label': `Key of body ${i + 1}`, spellCheck: false }
                        }}
                      />
                    </td>
                    <td style={cell}>
                      <TextField
                        size="small"
                        value={b.id}
                        onChange={(e) => setBody(i, 'id', e.target.value.replace(/\D/g, ''))}
                        sx={{ width: 90 }}
                        slotProps={{
                          htmlInput: {
                            'aria-label': `Id of body ${i + 1}`,
                            inputMode: 'numeric',
                            maxLength: 5
                          }
                        }}
                      />
                    </td>
                    <td style={cell}>
                      <TextField
                        size="small"
                        value={b.name}
                        placeholder={b.key}
                        onChange={(e) => setBody(i, 'name', e.target.value)}
                        sx={{ width: 160 }}
                        slotProps={{ htmlInput: { 'aria-label': `Name of body ${i + 1}` } }}
                      />
                    </td>
                    <td style={{ ...cell, textAlign: 'center' }}>
                      <Radio
                        size="small"
                        checked={b.isDefault}
                        onChange={() => setDefaultBody(i)}
                        slotProps={{ input: { 'aria-label': `Body ${i + 1} is the default` } }}
                      />
                    </td>
                    <td style={cell}>
                      <TextField
                        size="small"
                        value={b.retailSkinColor}
                        placeholder="0"
                        onChange={(e) =>
                          setBody(i, 'retailSkinColor', e.target.value.replace(/\D/g, ''))
                        }
                        sx={{ width: 70 }}
                        slotProps={{
                          htmlInput: {
                            'aria-label': `Retail skin colour of body ${i + 1}`,
                            inputMode: 'numeric',
                            maxLength: 1
                          }
                        }}
                      />
                    </td>
                    <td style={cell}>
                      <IconButton
                        size="small"
                        aria-label={`Move body ${i + 1} up`}
                        disabled={i === 0}
                        onClick={() => moveBody(i, -1)}
                      >
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={`Move body ${i + 1} down`}
                        disabled={i === data.bodies.length - 1}
                        onClick={() => moveBody(i, 1)}
                      >
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Delete body ${i + 1}`}
                        onClick={() => setBodies((bs) => bs.filter((_, j) => j !== i))}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Button size="small" startIcon={<AddIcon />} onClick={addBody} sx={{ mt: 1 }}>
            Add Body
          </Button>
        </Paper>
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
            ? `"${data.key}" already exists!`
            : `"${data.key}" exists in archive`}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default SpeciesEditor
