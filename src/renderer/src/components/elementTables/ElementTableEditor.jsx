import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Box,
  Button,
  Typography,
  Divider,
  TextField,
  IconButton,
  Snackbar,
  Alert,
  Paper
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import CommentField from '../shared/CommentField'
import EditorHeader from '../shared/EditorHeader'
import { useRecoilValue } from 'recoil'
import { libraryIndexState } from '../../recoil/atoms'

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

function ElementTableEditor({
  table,
  initialFileName,
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
  const libraryIndex = useRecoilValue(libraryIndexState)

  const [name, setName] = useState(table.name)
  const [comment, setComment] = useState(table.comment)
  const [elements, setElements] = useState(table.elements)
  const [matrix, setMatrix] = useState(table.matrix)
  const [prefix, setPrefix] = useState(deriveElementPrefix(initialFileName, table.name))
  const [fileName, setFileName] = useState(
    initialFileName || computeFileName(deriveElementPrefix(initialFileName, table.name), table.name)
  )
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName)
  const [focusedCell, setFocusedCell] = useState(null) // { row, col }
  const [dupSnack, setDupSnack] = useState(null)
  const [elementsOpen, setElementsOpen] = useState(true)

  const isDirtyRef = useRef(false)

  useEffect(() => {
    const derivedPrefix = deriveElementPrefix(initialFileName, table.name)
    setName(table.name)
    setComment(table.comment)
    setElements(table.elements)
    setMatrix(table.matrix)
    setPrefix(derivedPrefix)
    setFileName(initialFileName || computeFileName(derivedPrefix, table.name))
    setFileNameEdited(!!initialFileName)
    setFocusedCell(null)
    setDupSnack(null)
    isDirtyRef.current = false
    onDirtyChange?.(false)
  }, [table, initialFileName]) // eslint-disable-line react-hooks/exhaustive-deps

  const markDirty = useCallback(() => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true
      onDirtyChange?.(true)
    }
  }, [onDirtyChange])

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

  const handleRegenerate = () => {
    setFileName(computeFileName(prefix, name))
    setFileNameEdited(false)
    markDirty()
  }

  // ── Duplicate detection ──────────────────────────────────────────────────────

  const dupStatus = useMemo(() => {
    const trimmed = (name || '').trim()
    if (!trimmed) return null
    const originalName = isExisting ? table.name || '' : ''
    if (originalName && trimmed.toLowerCase() === originalName.toLowerCase()) return null

    const activeNames = libraryIndex?.elementtables || []
    if (activeNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) return 'active'

    const archivedNames = libraryIndex?.archivedElementtables || []
    if (archivedNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) return 'archived'

    return null
  }, [name, libraryIndex, isExisting, table.name])

  const handleNameBlur = () => {
    if (dupStatus) setDupSnack(dupStatus)
  }

  // ── Grid mutations ──────────────────────────────────────────────────────────

  const handleCellChange = (row, col, raw) => {
    const parsed = parseInt(raw, 10)
    const val = isNaN(parsed) ? '' : Math.max(0, Math.min(9999, parsed))
    setMatrix((prev) => {
      const next = prev.map((r) => [...r])
      next[row][col] = val
      return next
    })
    markDirty()
  }

  const handleRenameElement = (index, val) => {
    setElements((prev) => {
      const next = [...prev]
      next[index] = val
      return next
    })
    markDirty()
  }

  const handleAddElement = () => {
    const existing = elements
    let counter = existing.length + 1
    let newName = `NewElement(${counter})`
    while (existing.includes(newName)) {
      counter++
      newName = `NewElement(${counter})`
    }

    setElements((prev) => [...prev, newName])
    setMatrix((prev) => {
      const next = prev.map((r) => [...r, 100])
      next.push(new Array(existing.length + 1).fill(100))
      return next
    })
    markDirty()
  }

  const handleDeleteElement = (index) => {
    setElements((prev) => prev.filter((_, i) => i !== index))
    setMatrix((prev) =>
      prev.filter((_, i) => i !== index).map((r) => r.filter((_, j) => j !== index))
    )
    if (focusedCell && (focusedCell.row === index || focusedCell.col === index)) {
      setFocusedCell(null)
    }
    markDirty()
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const getFileName = () => fileName || computeFileName(prefix, name) || 'element-table.xml'

  const handleSave = useCallback(() => {
    onSave({ name, comment, elements, matrix }, getFileName())
    isDirtyRef.current = false
    onDirtyChange?.(false)
  }, [name, comment, elements, matrix, isExisting, initialFileName, fileName]) // eslint-disable-line react-hooks/exhaustive-deps

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
    minWidth: 160,
    width: 160
  }

  const stickyColHeader = (ci) => ({
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
        onRegenerate={handleRegenerate}
        onSave={handleSave}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />

      <Divider sx={{ mb: 1.5, flexShrink: 0 }} />

      {/* ── Metadata on Paper ── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 1.5, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="Prefix"
            size="small"
            value={prefix}
            sx={{ width: 140 }}
            onChange={handlePrefixChange}
            inputProps={{ maxLength: 64, spellCheck: false }}
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
            inputProps={{ maxLength: 128 }}
          />
          <CommentField
            value={comment}
            onChange={(e) => {
              setComment(e.target.value)
              markDirty()
            }}
            sx={{ flex: 1 }}
          />
        </Box>
      </Paper>

      {/* ── Elements accordion ── */}
      <Paper
        variant="outlined"
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
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
          onClick={() => setElementsOpen((v) => !v)}
        >
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            Elements
          </Typography>
          {elementsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </Box>
        {elementsOpen && (
          <>
            <Divider sx={{ flexShrink: 0 }} />
            <Box sx={{ p: 2, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                <InfoOutlinedIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  Enter values as whole-number percentages — 80 = 80% (×0.8), 100 = no change
                  (×1.0), 150 = 150% (×1.5). Row = source element (attacker); column = target
                  element (defender). The highlighted cell shows the reverse interaction.
                </Typography>
              </Box>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddElement}
                variant="outlined"
              >
                Add Element
              </Button>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2 }}>
              <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={stickyCorner} />
                    {elements.map((el, ci) => (
                      <th key={ci} style={stickyColHeader(ci)}>
                        {el || `(${ci + 1})`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {elements.map((el, ri) => (
                    <tr key={ri}>
                      {/* Row name + delete */}
                      <td style={stickyRowHeader}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <input
                            type="text"
                            value={el}
                            onChange={(e) => handleRenameElement(ri, e.target.value)}
                            style={{
                              width: 110,
                              fontSize: 12,
                              border: `1px solid ${borderColor}`,
                              borderRadius: 3,
                              padding: '2px 5px',
                              background: 'transparent',
                              color: 'inherit'
                            }}
                          />
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteElement(ri)}
                          >
                            <DeleteIcon style={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>
                      </td>
                      {/* Value cells */}
                      {elements.map((_, ci) => {
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
                              type="number"
                              min={0}
                              max={9999}
                              value={matrix[ri]?.[ci] ?? ''}
                              onChange={(e) => handleCellChange(ri, ci, e.target.value)}
                              onFocus={() => setFocusedCell({ row: ri, col: ci })}
                              onBlur={() => setFocusedCell(null)}
                              style={{
                                width: 64,
                                fontSize: 12,
                                border: `1px solid ${borderColor}`,
                                borderRadius: 3,
                                padding: '2px 4px',
                                textAlign: 'right',
                                background: 'transparent',
                                color: 'inherit'
                              }}
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
