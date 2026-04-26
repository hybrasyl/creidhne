import React, { useState, useEffect } from 'react'
import { Box, Button, TextField, Tooltip, IconButton, Typography } from '@mui/material'
import ClearIcon from '@mui/icons-material/Clear'
import { useRecoilValue } from 'recoil'
import { activeLibraryState } from '../../recoil/atoms'
import FormulaPickerDialog from './FormulaPickerDialog'

/**
 * Shared formula row used by HealEditor and DamageEditor when kind === 'Formula'.
 *
 * Renders on a single line:
 *   [Pick] [Name (readonly)] [Formula (readonly)] [Clear]
 *
 * If the formula name is not in the library (or there is no name), shows warning
 * styling and action buttons: "+ Add to index" / "Replace from index".
 *
 * Props:
 *   formulaName — current formula name (may be empty)
 *   formula     — current formula string
 *   category    — picker pre-filter ('heal' | 'damage')
 *   onSelect    — ({ name, formula }) => void
 *   onClear     — () => void
 */
function FormulaRow({ formulaName, formula, category, onSelect, onClear }) {
  const activeLibrary = useRecoilValue(activeLibraryState)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [formulas, setFormulas] = useState([])
  const [formulasLoaded, setFormulasLoaded] = useState(false)
  const [addingToIndex, setAddingToIndex] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!activeLibrary) return
    setFormulasLoaded(false)
    window.electronAPI
      .loadFormulas(activeLibrary)
      .then((data) => {
        setFormulas(data.formulas || [])
        setFormulasLoaded(true)
      })
      .catch(() => setFormulasLoaded(true))
  }, [activeLibrary])

  const matched =
    formulasLoaded && formulaName ? formulas.find((f) => f.name === formulaName) : null
  const isCustom = formulasLoaded && !formulaName && !!formula
  const notInIndex = formulasLoaded && !!formulaName && !matched
  // Library has the formula but it's been archived — distinct, more severe
  // case than not-in-library since the user explicitly retired it.
  const referencesArchived = !!(matched && matched.isArchived)
  const hasWarning = isCustom || notInIndex
  const hasIssue = hasWarning || referencesArchived

  // Archive case is rendered in error red; warning cases stay orange.
  const issueColor = referencesArchived ? 'error.main' : 'warning.main'
  const issueButtonColor = referencesArchived ? 'error' : 'warning'

  const displayName = formulaName || (formula ? 'custom' : '')
  const warnSx = hasIssue
    ? {
        '& .MuiOutlinedInput-root fieldset': { borderColor: issueColor },
        '& .MuiInputLabel-root:not(.Mui-focused)': { color: issueColor }
      }
    : {}

  const handleFormulaSelect = (f) => {
    onSelect(f)
    setAddingToIndex(false)
  }

  const handleAddToIndex = async () => {
    const name = newName.trim()
    if (!name || !activeLibrary) return
    setSaving(true)
    try {
      const data = await window.electronAPI.loadFormulas(activeLibrary)
      const entry = {
        id: crypto.randomUUID(),
        name,
        description: '',
        category: category || 'general',
        formula
      }
      const updated = { ...data, formulas: [...data.formulas, entry] }
      await window.electronAPI.saveFormulas(activeLibrary, updated)
      setFormulas(updated.formulas)
      onSelect({ name, formula })
      setAddingToIndex(false)
      setNewName('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1, minWidth: 0 }}>
      {/* Main row */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setPickerOpen(true)}
          sx={{ flexShrink: 0, height: 40 }}
        >
          Pick
        </Button>
        <TextField
          label="Formula Name"
          size="small"
          sx={{ width: 180, ...warnSx }}
          value={displayName}
          slotProps={{
            htmlInput: { readOnly: true, tabIndex: -1 }
          }}
        />
        <TextField
          label="Formula"
          size="small"
          sx={{ flex: 1, minWidth: 0 }}
          value={formula || ''}
          slotProps={{
            htmlInput: { readOnly: true, tabIndex: -1, style: { fontFamily: 'monospace' } }
          }}
        />
        {(formulaName || formula) && (
          <Tooltip title="Clear formula">
            <IconButton size="small" onClick={onClear} sx={{ flexShrink: 0 }}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {/* Issue actions */}
      {hasIssue && !addingToIndex && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* "Add to index" only makes sense for the orange/warning case.
              For an archived reference the formula already exists — the
              fix is to swap to a live one (or unarchive in the panel). */}
          {hasWarning && (
            <Button
              size="small"
              color={issueButtonColor}
              onClick={() => {
                setAddingToIndex(true)
                setNewName(formulaName || '')
              }}
            >
              + Add to index
            </Button>
          )}
          <Button size="small" color={issueButtonColor} onClick={() => setPickerOpen(true)}>
            Replace from index
          </Button>
          <Typography variant="caption" sx={{ color: issueColor }}>
            {referencesArchived
              ? 'Archived formula — replace before saving'
              : notInIndex
                ? 'Not in library'
                : 'No library entry'}
          </Typography>
        </Box>
      )}
      {/* Add-to-index inline form */}
      {addingToIndex && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            label="Name"
            size="small"
            sx={{ flex: 1 }}
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddToIndex()
              if (e.key === 'Escape') {
                setAddingToIndex(false)
                setNewName('')
              }
            }}
            slotProps={{
              htmlInput: { maxLength: 128 }
            }}
          />
          <Button
            size="small"
            variant="contained"
            disabled={!newName.trim() || saving}
            onClick={handleAddToIndex}
          >
            Save to Library
          </Button>
          <Button
            size="small"
            onClick={() => {
              setAddingToIndex(false)
              setNewName('')
            }}
          >
            Cancel
          </Button>
        </Box>
      )}
      <FormulaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleFormulaSelect}
        category={category}
      />
    </Box>
  );
}

export default FormulaRow
