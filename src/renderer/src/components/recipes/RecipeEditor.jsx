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
  Snackbar,
  Alert
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { useRecoilValue } from 'recoil'
import { libraryIndexState } from '../../recoil/atoms'
import CommentField from '../shared/CommentField'
import EditorHeader from '../shared/EditorHeader'

function deriveRecipePrefix(fileName, name) {
  if (!fileName) return 'recipe'
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '')
  const base = fileName.replace(/\.xml$/i, '')
  if (safe && base.endsWith(`_${safe}`)) {
    const p = base.slice(0, base.length - safe.length - 1)
    return p || 'recipe'
  }
  return 'recipe'
}

function computeRecipeFilename(prefix, name) {
  const safe = (name || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '')
  if (!safe) return ''
  return `${prefix || 'recipe'}_${safe}.xml`
}

function RecipeEditor({
  recipe,
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

  const [data, setData] = useState(recipe)
  const [prefix, setPrefix] = useState(deriveRecipePrefix(initialFileName, recipe.name))
  const [fileName, setFileName] = useState(
    initialFileName ||
      computeRecipeFilename(deriveRecipePrefix(initialFileName, recipe.name), recipe.name)
  )
  const [fileNameEdited, setFileNameEdited] = useState(!!initialFileName)

  const isDirtyRef = useRef(false)

  useEffect(() => {
    const derivedPrefix = deriveRecipePrefix(initialFileName, recipe.name)
    setData(recipe)
    setPrefix(derivedPrefix)
    setFileName(initialFileName || computeRecipeFilename(derivedPrefix, recipe.name))
    setFileNameEdited(!!initialFileName)
    isDirtyRef.current = false
    setDupSnack(null)
    onDirtyChange?.(false)
  }, [recipe, initialFileName]) // eslint-disable-line react-hooks/exhaustive-deps

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
        if (!fileNameEdited) setFileName(computeRecipeFilename(prefix, next.name))
        return next
      })
    },
    [fileNameEdited, prefix, markDirtyLocal]
  )

  const set = (field) => (e) => updateData((d) => ({ ...d, [field]: e.target.value }))

  const handlePrefixChange = (e) => {
    markDirtyLocal()
    const p = e.target.value
    setPrefix(p)
    if (!fileNameEdited) setFileName(computeRecipeFilename(p, data.name))
  }

  const handleRegenerate = () => {
    markDirtyLocal()
    setFileName(computeRecipeFilename(prefix, data.name))
    setFileNameEdited(false)
  }

  // ── Duplicate detection ──────────────────────────────────────────────────────

  const dupStatus = useMemo(() => {
    const name = (data.name || '').trim()
    if (!name) return null
    const originalName = isExisting ? recipe.name || '' : ''
    if (originalName && name.toLowerCase() === originalName.toLowerCase()) return null

    const activeNames = libraryIndex?.recipes || []
    if (activeNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'active'

    const archivedNames = libraryIndex?.archivedRecipes || []
    if (archivedNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'archived'

    return null
  }, [data.name, libraryIndex, isExisting, recipe.name])

  const [dupSnack, setDupSnack] = useState(null)
  const handleNameBlur = () => {
    if (dupStatus) setDupSnack(dupStatus)
  }

  if (saveRef) saveRef.current = () => onSave(data, fileName)

  const addIngredient = () =>
    updateData((d) => ({ ...d, ingredients: [...d.ingredients, { name: '', quantity: '1' }] }))

  const setIngredient = (index, field, val) =>
    updateData((d) => ({
      ...d,
      ingredients: d.ingredients.map((ing, i) => (i === index ? { ...ing, [field]: val } : ing))
    }))

  const removeIngredient = (index) =>
    updateData((d) => ({ ...d, ingredients: d.ingredients.filter((_, i) => i !== index) }))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <EditorHeader
        title={data.name || '(unnamed recipe)'}
        entityLabel="recipe"
        fileName={fileName}
        initialFileName={initialFileName}
        computedFileName={computeRecipeFilename(prefix, data.name)}
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

      {/* Form */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
                onChange={set('name')}
                onBlur={handleNameBlur}
                inputProps={{ maxLength: 255 }}
              />
            </Box>
            <TextField
              label="Description"
              value={data.description}
              onChange={set('description')}
              size="small"
              multiline
              minRows={2}
              inputProps={{ maxLength: 500 }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Autocomplete
                freeSolo
                options={itemNames}
                value={data.produces}
                onInputChange={(_, val, reason) => {
                  if (reason === 'input') updateData((d) => ({ ...d, produces: val }))
                }}
                onChange={(_, val) => updateData((d) => ({ ...d, produces: val ?? '' }))}
                size="small"
                sx={{ flex: 1 }}
                renderInput={(params) => <TextField {...params} label="Produces (Item)" required />}
              />
              <TextField
                label="Duration"
                value={data.duration}
                onChange={set('duration')}
                size="small"
                sx={{ width: 140 }}
                inputProps={{ maxLength: 64 }}
              />
            </Box>
            <CommentField value={data.comment} onChange={set('comment')} />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Ingredients
          </Typography>
          {data.ingredients.map((ing, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <Autocomplete
                freeSolo
                options={itemNames}
                value={ing.name}
                onInputChange={(_, val, reason) => {
                  if (reason === 'input') setIngredient(index, 'name', val)
                }}
                onChange={(_, val) => setIngredient(index, 'name', val ?? '')}
                size="small"
                sx={{ flex: 1 }}
                renderInput={(params) => <TextField {...params} label="Item" />}
              />
              <TextField
                label="Qty"
                type="number"
                value={ing.quantity}
                onChange={(e) => setIngredient(index, 'quantity', e.target.value)}
                size="small"
                sx={{ width: 90 }}
                inputProps={{ min: 1 }}
              />
              <IconButton size="small" color="error" onClick={() => removeIngredient(index)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addIngredient}>
            Add Ingredient
          </Button>
        </Paper>

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

export default RecipeEditor
