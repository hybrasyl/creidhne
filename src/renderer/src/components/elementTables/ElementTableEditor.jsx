import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Autocomplete,
  Box,
  Button,
  Typography,
  Divider,
  TextField,
  IconButton,
  Snackbar,
  Alert,
  Paper,
  Radio,
  Tooltip
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import CommentField from '../shared/CommentField'
import EditorHeader from '../shared/EditorHeader'
import { useEditorAlert } from '../editorShell/EditorAlerts'
import { useDuplicateName } from '../../hooks/useDuplicateName'
import { normalizeFolder } from '../../utils/fileTree'
import {
  addElement,
  convertToRegistry,
  declaredMultiplier,
  effectiveMultiplier,
  elementKeys,
  removeElement,
  renameElement,
  setPair,
  setRowDefault,
  sourceRow,
  validateElementTable
} from '@shared/elementTable'

function deriveElementPrefix(fileName, name) {
  if (!fileName) return 'element'
  const safe = (name || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
  const base = fileName.replace(/\.xml$/i, '')
  if (safe && base.endsWith(`_${safe}`)) {
    const p = base.slice(0, base.length - safe.length - 1)
    return p || 'element'
  }
  return 'element'
}

function computeFileName(prefix, name) {
  const safe = (name || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
  return safe ? `${prefix || 'element'}_${safe}.xml` : ''
}

/** The table without name and comment, which the editor keeps on their own. */
function modelOf(table) {
  return {
    defaultMultiplier: table.defaultMultiplier ?? '',
    registry: !!table.registry,
    elements: table.elements ?? [],
    groups: table.groups ?? [],
    sources: table.sources ?? []
  }
}

/** A multiplier for a placeholder: at most four decimals, as the file would hold it. */
const shown = (n) => String(parseFloat(n.toFixed(4)))

/**
 * An element key. The rename applies on blur or Enter, never per keystroke:
 * part way through typing, the text can equal another element's key, and a
 * rename then would join the two rows. An empty or taken key goes back to the
 * old one.
 */
function KeyInput({ value, taken, onCommit, style, label }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const clash = text !== value && (text.trim() === '' || taken.includes(text.trim()))
  const commit = () => {
    const next = text.trim()
    if (next === value) return
    if (clash) setText(value)
    else onCommit(next)
  }
  return (
    <input
      type="text"
      aria-label={label}
      value={text}
      title={clash ? 'Another element has this key, or the key is empty' : undefined}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setText(value)
      }}
      style={{ ...style, ...(clash && { borderColor: '#f44336' }) }}
      spellCheck={false}
    />
  )
}

/**
 * One group's members, picked from the elements of this table. A member may
 * repeat, because a member listed twice is picked twice as often, so no option
 * equals a value and picking one again adds it again. A member that is not an
 * element stays, so a file that names one saves unchanged and the problem list
 * names it; typed text that is not an element is dropped. freeSolo keeps MUI
 * from warning about those values.
 */
function GroupMembersField({ members, elementKeys, onChange }) {
  return (
    <Autocomplete
      multiple
      freeSolo
      disableCloseOnSelect
      options={elementKeys}
      value={members}
      isOptionEqualToValue={() => false}
      onChange={(_, vals) =>
        onChange(vals.filter((v) => elementKeys.includes(v) || members.includes(v)))
      }
      size="small"
      sx={{ flex: 1 }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Members"
          helperText="Pick an element twice to make it twice as likely."
        />
      )}
    />
  )
}

function ElementTableEditor({
  table,
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
  const theme = useTheme()
  const headerBg = theme.palette.background.paper
  const borderColor = theme.palette.divider

  const [name, setName] = useState(table.name)
  const [comment, setComment] = useState(table.comment)
  const [model, setModel] = useState(() => modelOf(table))
  const [prefix, setPrefix] = useState(deriveElementPrefix(initialFileName, table.name))
  const [fileName, setFileName] = useState(
    initialFileName || computeFileName(deriveElementPrefix(initialFileName, table.name), table.name)
  )
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName)
  const [folder, setFolder] = useState(initialFolder)
  const [focusedCell, setFocusedCell] = useState(null) // { row, col }
  const [dupSnack, setDupSnack] = useState(null)
  const [elementsOpen, setElementsOpen] = useState(true)
  const [groupsOpen, setGroupsOpen] = useState(true)
  const [matrixOpen, setMatrixOpen] = useState(true)
  // Bumped on each reset, so the group fields remount with the new text.
  const [resetCount, setResetCount] = useState(0)

  const isDirtyRef = useRef(false)

  useEffect(() => {
    const derivedPrefix = deriveElementPrefix(initialFileName, table.name)
    setName(table.name)
    setComment(table.comment)
    setModel(modelOf(table))
    setPrefix(derivedPrefix)
    setFileName(initialFileName || computeFileName(derivedPrefix, table.name))
    setFileNameEdited(!!initialFileName)
    setFolder(initialFolder)
    setFocusedCell(null)
    setDupSnack(null)
    setResetCount((n) => n + 1)
    isDirtyRef.current = false
    onDirtyChange?.(false)
  }, [table, initialFileName, initialFolder]) // eslint-disable-line react-hooks/exhaustive-deps

  const markDirty = useCallback(() => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true
      onDirtyChange?.(true)
    }
  }, [onDirtyChange])

  /** Apply one change to the model and mark the editor dirty. */
  const edit = (fn) => {
    setModel((prev) => fn(prev))
    markDirty()
  }

  const handleNameChange = (val) => {
    setName(val)
    if (!fileNameEdited) setFileName(computeFileName(prefix, val))
    markDirty()
  }

  const handlePrefixChange = (e) => {
    const p = e.target.value
    setPrefix(p)
    if (!fileNameEdited) setFileName(computeFileName(p, name))
    markDirty()
  }

  const handleFolderChange = (val) => {
    markDirty()
    setFolder(val)
  }

  const handleRegenerate = () => {
    setFileName(computeFileName(prefix, name))
    setFileNameEdited(false)
    markDirty()
  }

  // ── Duplicate detection ──────────────────────────────────────────────────────

  const dupStatus = useDuplicateName({
    type: 'elementtables',
    name,
    originalName: table.name,
    isExisting
  })

  const handleNameBlur = () => {
    if (dupStatus) setDupSnack(dupStatus)
  }

  // ── Elements ────────────────────────────────────────────────────────────────

  const keys = elementKeys(model)
  const problems = useMemo(() => validateElementTable(model), [model])
  // In the alerts area under the header (HTOO-628), or in place without one.
  // The old-format notice stays in the form: its Convert button acts on the
  // table beside it.
  const problemsInArea = useEditorAlert(
    'problems',
    problems.length
      ? {
          order: 30,
          severity: 'warning',
          testId: 'editor-problems',
          message:
            'The server refuses this table until you correct these problems. A save still writes the file.',
          items: problems
        }
      : null
  )

  const handleAddElement = () => {
    let counter = keys.length + 1
    let newKey = `NewElement${counter}`
    while (keys.includes(newKey)) newKey = `NewElement${++counter}`
    edit((m) => addElement(m, newKey))
  }

  const setElementField = (index, field, value) =>
    edit((m) => ({
      ...m,
      elements: m.elements.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    }))

  const setDefaultElement = (index) =>
    edit((m) => ({
      ...m,
      elements: m.elements.map((e, i) => ({ ...e, isDefault: i === index }))
    }))

  const handleDeleteElement = (key) => {
    edit((m) => removeElement(m, key))
    setFocusedCell(null)
  }

  // ── Groups ──────────────────────────────────────────────────────────────────

  const setGroups = (fn) => edit((m) => ({ ...m, groups: fn(m.groups) }))

  const handleAddGroup = () => {
    let counter = model.groups.length + 1
    const used = model.groups.map((g) => g.key)
    let key = `Group${counter}`
    while (used.includes(key)) key = `Group${++counter}`
    setGroups((gs) => [...gs, { key, members: [] }])
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const getFileName = () => fileName || computeFileName(prefix, name) || 'element-table.xml'

  // A table with problems still saves: the file is the author's work, and
  // the list above the grid says what the server will refuse.
  const handleSave = useCallback(
    (mode) => {
      onSave({ name, comment, ...model }, getFileName(), normalizeFolder(folder), mode)
      isDirtyRef.current = false
      onDirtyChange?.(false)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, comment, model, isExisting, initialFileName, fileName, folder]
  )

  if (saveRef) saveRef.current = handleSave

  // ── Mirror highlight helpers ────────────────────────────────────────────────

  const isMirrorCell = (row, col) => {
    if (!focusedCell) return false
    const { row: fr, col: fc } = focusedCell
    // Mirror of [fr, fc] is [fc, fr] — highlight only if it's a different cell
    return row === fc && col === fr && !(row === fr && col === fc)
  }

  // ── Shared cell/header styles ───────────────────────────────────────────────

  const cellBorder = `1px solid ${borderColor}`
  const thickBorder = `2px solid ${theme.palette.divider}`

  const stickyCorner = {
    position: 'sticky',
    top: 0,
    left: 0,
    zIndex: 4,
    background: headerBg,
    borderBottom: thickBorder,
    borderRight: thickBorder,
    minWidth: model.registry ? 220 : 160,
    width: model.registry ? 220 : 160
  }

  const stickyColHeader = () => ({
    position: 'sticky',
    top: 0,
    zIndex: 3,
    background: headerBg,
    borderBottom: thickBorder,
    borderRight: cellBorder,
    minWidth: 76,
    width: 76,
    padding: '4px 6px',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    userSelect: 'none'
  })

  const stickyRowHeader = {
    position: 'sticky',
    left: 0,
    zIndex: 2,
    background: headerBg,
    borderRight: thickBorder,
    borderBottom: cellBorder,
    padding: '2px 4px'
  }

  const smallInput = (width) => ({
    width,
    fontSize: 12,
    border: `1px solid ${borderColor}`,
    borderRadius: 3,
    padding: '2px 4px',
    background: 'transparent',
    color: 'inherit'
  })

  const sectionHeader = (label, open, setOpen) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 2,
        py: 1,
        cursor: 'pointer',
        userSelect: 'none',
        flexShrink: 0
      }}
      onClick={() => setOpen((v) => !v)}
    >
      <Typography variant="subtitle2" sx={{ flex: 1 }}>
        {label}
      </Typography>
      {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Header ── */}
      <EditorHeader
        title={name || '(unnamed table)'}
        entityLabel="element table"
        fileName={fileName}
        initialFileName={initialFileName}
        computedFileName={computeFileName(prefix, name)}
        isExisting={isExisting}
        isArchived={isArchived}
        onFileNameChange={(val) => {
          setFileName(val)
          setFileNameEdited(true)
          markDirty()
        }}
        folder={folder}
        folderOptions={folderOptions}
        initialFolder={initialFolder}
        onFolderChange={handleFolderChange}
        onRegenerate={handleRegenerate}
        onSave={handleSave}
        onRenameFile={() => handleSave('rename')}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />
      <Divider sx={{ mb: 1.5, flexShrink: 0 }} />
      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* ── Metadata on Paper ── */}
        <Paper variant="outlined" sx={{ p: 2, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
              label="Name"
              size="small"
              value={name}
              sx={{
                width: 200,
                ...(dupStatus === 'archived' && {
                  '& .MuiOutlinedInput-root fieldset': { borderColor: 'warning.main' },
                  '& .MuiInputLabel-root:not(.Mui-focused)': { color: 'warning.main' },
                  '& .MuiFormHelperText-root': { color: 'warning.main' }
                })
              }}
              error={dupStatus === 'active'}
              helperText={
                dupStatus === 'active'
                  ? `"${name}" already exists`
                  : dupStatus === 'archived'
                    ? `"${name}" exists in archive`
                    : undefined
              }
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={handleNameBlur}
              slotProps={{
                htmlInput: { maxLength: 128 }
              }}
            />
            {model.registry && (
              <TextField
                label="Default multiplier"
                size="small"
                value={model.defaultMultiplier}
                placeholder="1"
                sx={{ width: 160 }}
                helperText="For each pair that sets no multiplier"
                onChange={(e) => edit((m) => ({ ...m, defaultMultiplier: e.target.value }))}
                slotProps={{ htmlInput: { inputMode: 'decimal', spellCheck: false } }}
              />
            )}
          </Box>
          <CommentField
            value={comment}
            onChange={(e) => {
              setComment(e.target.value)
              markDirty()
            }}
            fullWidth
            sx={{ mt: 2 }}
          />
        </Paper>

        {/* ── Format and problems ── */}
        {!model.registry && (
          <Alert
            severity="info"
            sx={{ flexShrink: 0 }}
            action={
              <Button color="inherit" size="small" onClick={() => edit(convertToRegistry)}>
                Convert
              </Button>
            }
          >
            This table is in the old format. Its elements are its rows, and it sets every pair. A
            save keeps this format. Convert adds an Elements block, with an Id for each element, so
            that the table can use groups and default multipliers. Convert changes no multiplier.
          </Alert>
        )}
        {problems.length > 0 && !problemsInArea && (
          <Alert severity="warning" sx={{ flexShrink: 0 }}>
            The server refuses this table until you correct these problems. A save still writes the
            file.
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {problems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </Box>
          </Alert>
        )}

        {/* ── Elements (registry format) ── */}
        {model.registry && (
          <Paper variant="outlined" sx={{ flexShrink: 0 }}>
            {sectionHeader('Elements', elementsOpen, setElementsOpen)}
            {elementsOpen && (
              <>
                <Divider />
                <Box sx={{ p: 2, overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['Key', 'Id', 'Retail Id', 'Name', 'Default', 'Ivernic', ''].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: '2px 6px' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {model.elements.map((e, i) => (
                        <tr key={i}>
                          <td style={{ padding: 2 }}>
                            <KeyInput
                              label={`Key of element ${i + 1}`}
                              value={e.key}
                              taken={keys.filter((k) => k !== e.key)}
                              onCommit={(next) => edit((m) => renameElement(m, e.key, next))}
                              style={smallInput(120)}
                            />
                          </td>
                          <td style={{ padding: 2 }}>
                            <input
                              type="text"
                              inputMode="numeric"
                              aria-label={`Id of ${e.key}`}
                              value={e.id}
                              onChange={(ev) => setElementField(i, 'id', ev.target.value.trim())}
                              style={smallInput(50)}
                            />
                          </td>
                          <td style={{ padding: 2 }}>
                            <input
                              type="text"
                              inputMode="numeric"
                              aria-label={`Retail Id of ${e.key}`}
                              value={e.retailId}
                              placeholder="0"
                              onChange={(ev) =>
                                setElementField(i, 'retailId', ev.target.value.trim())
                              }
                              style={smallInput(50)}
                            />
                          </td>
                          <td style={{ padding: 2 }}>
                            <input
                              type="text"
                              aria-label={`Name of ${e.key}`}
                              value={e.name}
                              placeholder={e.key}
                              onChange={(ev) => setElementField(i, 'name', ev.target.value)}
                              style={smallInput(120)}
                            />
                          </td>
                          <td style={{ padding: 0, textAlign: 'center' }}>
                            <Radio
                              size="small"
                              checked={e.isDefault}
                              onChange={() => setDefaultElement(i)}
                              slotProps={{ input: { 'aria-label': `${e.key} is the default` } }}
                            />
                          </td>
                          <td style={{ padding: 2 }}>
                            <input
                              type="text"
                              aria-label={`Ivernic name of ${e.key}`}
                              value={e.ivernic}
                              onChange={(ev) => setElementField(i, 'ivernic', ev.target.value)}
                              style={smallInput(100)}
                            />
                          </td>
                          <td style={{ padding: 0 }}>
                            <IconButton
                              size="small"
                              color="error"
                              aria-label={`Delete ${e.key}`}
                              onClick={() => handleDeleteElement(e.key)}
                            >
                              <DeleteIcon style={{ fontSize: 14 }} />
                            </IconButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddElement}
                    variant="outlined"
                    sx={{ mt: 1 }}
                  >
                    Add Element
                  </Button>
                </Box>
              </>
            )}
          </Paper>
        )}

        {/* ── Groups (registry format) ── */}
        {model.registry && (
          <Paper variant="outlined" sx={{ flexShrink: 0 }}>
            {sectionHeader('Groups', groupsOpen, setGroupsOpen)}
            {groupsOpen && (
              <>
                <Divider />
                <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Content picks a random member of a group with Random:&lt;Key&gt;, for example
                    Random:{model.groups[0]?.key || 'Cardinal'}.
                  </Typography>
                  {model.groups.map((g, i) => (
                    <Box
                      key={`${resetCount}-${i}`}
                      sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}
                    >
                      <TextField
                        label="Key"
                        size="small"
                        value={g.key}
                        sx={{ width: 160 }}
                        onChange={(ev) =>
                          setGroups((gs) =>
                            gs.map((x, j) => (j === i ? { ...x, key: ev.target.value } : x))
                          )
                        }
                        slotProps={{ htmlInput: { spellCheck: false } }}
                      />
                      <GroupMembersField
                        members={g.members}
                        elementKeys={keys}
                        onChange={(members) =>
                          setGroups((gs) => gs.map((x, j) => (j === i ? { ...x, members } : x)))
                        }
                      />
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Delete group ${g.key}`}
                        onClick={() => setGroups((gs) => gs.filter((_, j) => j !== i))}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                  <Box>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={handleAddGroup}
                      variant="outlined"
                    >
                      Add Group
                    </Button>
                  </Box>
                </Box>
              </>
            )}
          </Paper>
        )}

        {/* ── Multipliers ── */}
        <Paper
          variant="outlined"
          sx={{ display: 'flex', flexDirection: 'column', minHeight: 240, flexShrink: 0 }}
        >
          {sectionHeader('Multipliers', matrixOpen, setMatrixOpen)}
          {matrixOpen && (
            <>
              <Divider sx={{ flexShrink: 0 }} />
              <Box sx={{ p: 2, flexShrink: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                  <InfoOutlinedIcon fontSize="small" color="action" />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Enter multipliers: 0.8 reduces the damage by 20%, 1 makes no change, 1.5 adds
                    50%. Row = source element (attacker); column = target element (defender). The
                    highlighted cell shows the reverse interaction.
                    {model.registry &&
                      ' An empty cell uses the row default, then the table default, and shows that value in grey.'}
                  </Typography>
                </Box>
                {!model.registry && (
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddElement}
                    variant="outlined"
                  >
                    Add Element
                  </Button>
                )}
              </Box>
              <Box sx={{ overflow: 'auto', px: 2, pb: 2, maxHeight: '70vh' }}>
                <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={stickyCorner}>
                        {model.registry && (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Row default
                          </Typography>
                        )}
                      </th>
                      {keys.map((k, ci) => (
                        <th key={ci} style={stickyColHeader(ci)}>
                          {k || `(${ci + 1})`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((rowKey, ri) => (
                      <tr key={ri}>
                        <td style={stickyRowHeader}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {model.registry ? (
                              <>
                                <Typography
                                  variant="caption"
                                  sx={{ width: 110, fontWeight: 600, overflow: 'hidden' }}
                                  noWrap
                                >
                                  {rowKey}
                                </Typography>
                                <Tooltip title="Row default: for each pair in this row that sets no multiplier">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    aria-label={`Row default of ${rowKey}`}
                                    value={sourceRow(model, rowKey)?.defaultMultiplier ?? ''}
                                    placeholder={shown(
                                      effectiveMultiplier({ ...model, sources: [] }, rowKey, rowKey)
                                    )}
                                    onChange={(ev) =>
                                      edit((m) => setRowDefault(m, rowKey, ev.target.value))
                                    }
                                    style={smallInput(64)}
                                  />
                                </Tooltip>
                              </>
                            ) : (
                              <>
                                <KeyInput
                                  label={`Key of element ${ri + 1}`}
                                  value={rowKey}
                                  taken={keys.filter((k) => k !== rowKey)}
                                  onCommit={(next) => edit((m) => renameElement(m, rowKey, next))}
                                  style={smallInput(110)}
                                />
                                <IconButton
                                  size="small"
                                  color="error"
                                  aria-label={`Delete ${rowKey}`}
                                  onClick={() => handleDeleteElement(rowKey)}
                                >
                                  <DeleteIcon style={{ fontSize: 14 }} />
                                </IconButton>
                              </>
                            )}
                          </Box>
                        </td>
                        {keys.map((colKey, ci) => {
                          const mirror = isMirrorCell(ri, ci)
                          const isSelf = ri === ci
                          return (
                            <td
                              key={ci}
                              style={{
                                borderBottom: cellBorder,
                                borderRight: cellBorder,
                                padding: 2,
                                background: mirror
                                  ? theme.palette.mode === 'dark'
                                    ? '#3d1a1a'
                                    : '#fff5f5'
                                  : isSelf
                                    ? theme.palette.mode === 'dark'
                                      ? '#1a2a1a'
                                      : '#f5fff5'
                                    : undefined,
                                outline: mirror ? '2px solid #f44336' : undefined,
                                outlineOffset: -2
                              }}
                            >
                              <input
                                type="text"
                                inputMode="decimal"
                                aria-label={`${rowKey} against ${colKey}`}
                                value={declaredMultiplier(model, rowKey, colKey)}
                                placeholder={shown(effectiveMultiplier(model, rowKey, colKey))}
                                onChange={(ev) =>
                                  edit((m) => setPair(m, rowKey, colKey, ev.target.value))
                                }
                                onFocus={() => setFocusedCell({ row: ri, col: ci })}
                                onBlur={() => setFocusedCell(null)}
                                style={{ ...smallInput(64), textAlign: 'right' }}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </>
          )}
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
          {dupSnack === 'active' ? `"${name}" already exists!` : `"${name}" exists in archive`}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default ElementTableEditor
