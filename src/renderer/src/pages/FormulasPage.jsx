import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRecoilValue } from 'recoil'
import { Box, Typography, Snackbar, Alert, CircularProgress } from '@mui/material'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import SettingsIcon from '@mui/icons-material/Settings'
import { activeLibraryState } from '../recoil/atoms'
import FormulaEditor from '../components/formulas/FormulaEditor'
import FormulaSettingsDialog from '../components/formulas/FormulaSettingsDialog'
import EditorFileListPanel from '../components/shared/EditorFileListPanel'
import MultiSelectOverlay from '../components/shared/MultiSelectOverlay'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'

const DEFAULT_FORMULA = {
  id: null,
  name: '',
  description: '',
  category: 'damage',
  formula: '',
  patternId: null,
  isArchived: false
}

// Maps a formula record onto the shape the shared panel expects: `name` is
// the display text and `path` is the stable identity key (we use the formula
// id so renames don't break the selection).
function toPseudoFile(formula, archived = false) {
  return { name: formula.name || '(unnamed)', path: formula.id, archived }
}

function FormulasPage() {
  const activeLibrary = useRecoilValue(activeLibraryState)
  const [formulasData, setFormulasData] = useState({ settings: {}, patterns: [], formulas: [] })
  const [selectedFile, setSelectedFile] = useState(null)
  const [editingFormula, setEditingFormula] = useState(null)
  const [loading, setLoading] = useState(false)
  const [snackbar, setSnackbar] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [selectionCount, setSelectionCount] = useState(0)

  const {
    markDirty,
    markClean,
    saveRef,
    guard,
    dialogOpen,
    handleDialogSave,
    handleDialogDiscard,
    handleDialogCancel
  } = useUnsavedGuard('Formula')

  const loadData = async (library) => {
    if (!library) {
      setFormulasData({ settings: {}, patterns: [], formulas: [] })
      return
    }
    setLoading(true)
    try {
      const data = await window.electronAPI.loadFormulas(library)
      setFormulasData(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setSelectedFile(null)
    setEditingFormula(null)
    loadData(activeLibrary)
  }, [activeLibrary]) // eslint-disable-line react-hooks/exhaustive-deps

  // Active = !isArchived; Archived = isArchived. Sort each by name asc so the
  // panel's virtualized active list and native archived list are stable.
  const { activeFiles, archivedFiles } = useMemo(() => {
    const active = []
    const archived = []
    for (const f of formulasData.formulas) {
      if (f.isArchived) archived.push(toPseudoFile(f, true))
      else active.push(toPseudoFile(f, false))
    }
    const byName = (a, b) => a.name.localeCompare(b.name)
    active.sort(byName)
    archived.sort(byName)
    return { activeFiles: active, archivedFiles: archived }
  }, [formulasData.formulas])

  const findById = useCallback(
    (id) => formulasData.formulas.find((f) => f.id === id),
    [formulasData.formulas]
  )

  // ── Selection / new / save ──────────────────────────────────────────────────
  const doNew = () => {
    setSelectedFile(null)
    setEditingFormula({
      ...DEFAULT_FORMULA,
      id: crypto.randomUUID(),
      patternId: formulasData.settings?.defaultPatternId || null
    })
  }
  const handleNew = () => guard(doNew)

  const doSelect = (file) => {
    const f = findById(file.path)
    if (!f) return
    setSelectedFile(file)
    setEditingFormula({ ...f })
  }
  const handleSelect = (file) => guard(() => doSelect(file))

  const handleSave = async (data) => {
    try {
      const isNew = !formulasData.formulas.some((f) => f.id === data.id)
      const nextFormulas = isNew
        ? [...formulasData.formulas, data]
        : formulasData.formulas.map((f) => (f.id === data.id ? data : f))
      const next = { ...formulasData, formulas: nextFormulas }
      await window.electronAPI.saveFormulas(activeLibrary, next)
      setFormulasData(next)
      setEditingFormula(data)
      setSelectedFile(toPseudoFile(data, !!data.isArchived))
      markClean()
      setSnackbar({ message: 'Saved.', severity: 'success' })
    } catch (err) {
      setSnackbar({
        message: `Failed to save: ${err?.message ?? 'Unknown error'}`,
        severity: 'error'
      })
    }
  }

  // ── Bulk panel callbacks ────────────────────────────────────────────────────
  // Archive/unarchive/delete operate on the formulas array directly since
  // there's no on-disk move to perform — flip isArchived (or splice) and
  // persist the whole formulas.json in one save.
  const persistFormulas = useCallback(
    async (nextFormulas, touchedIds) => {
      const next = { ...formulasData, formulas: nextFormulas }
      try {
        await window.electronAPI.saveFormulas(activeLibrary, next)
        setFormulasData(next)
        if (selectedFile && touchedIds.includes(selectedFile.path)) {
          setSelectedFile(null)
          setEditingFormula(null)
          markClean()
        }
      } catch (err) {
        setSnackbar({
          message: `Save failed: ${err?.message ?? 'Unknown error'}`,
          severity: 'error'
        })
        throw err
      }
    },
    [activeLibrary, formulasData, selectedFile, markClean]
  )

  const handleBulkArchive = useCallback(
    async (files) => {
      if (!activeLibrary || files.length === 0) return
      const ids = files.map((f) => f.path)
      const next = formulasData.formulas.map((f) =>
        ids.includes(f.id) ? { ...f, isArchived: true } : f
      )
      await persistFormulas(next, ids)
      setSnackbar({
        message: `Archived ${ids.length} formula${ids.length === 1 ? '' : 's'}.`,
        severity: 'success'
      })
    },
    [activeLibrary, formulasData.formulas, persistFormulas]
  )

  const handleBulkUnarchive = useCallback(
    async (files) => {
      if (!activeLibrary || files.length === 0) return
      const ids = files.map((f) => f.path)
      const next = formulasData.formulas.map((f) =>
        ids.includes(f.id) ? { ...f, isArchived: false } : f
      )
      await persistFormulas(next, ids)
      setSnackbar({
        message: `Unarchived ${ids.length} formula${ids.length === 1 ? '' : 's'}.`,
        severity: 'success'
      })
    },
    [activeLibrary, formulasData.formulas, persistFormulas]
  )

  const handleBulkDelete = useCallback(
    async (files) => {
      if (!activeLibrary || files.length === 0) return
      const ids = files.map((f) => f.path)
      const next = formulasData.formulas.filter((f) => !ids.includes(f.id))
      await persistFormulas(next, ids)
      setSnackbar({
        message: `Deleted ${ids.length} formula${ids.length === 1 ? '' : 's'}.`,
        severity: 'success'
      })
    },
    [activeLibrary, formulasData.formulas, persistFormulas]
  )

  // Single-only: copy with a new id and " (Copy)" / " (Copy 2)" name suffix.
  const handleDuplicate = useCallback(
    async (file) => {
      if (!activeLibrary || !file) return
      const src = findById(file.path)
      if (!src) return
      const usedNames = new Set(formulasData.formulas.map((f) => f.name))
      let candidate = `${src.name} (Copy)`
      let counter = 2
      while (usedNames.has(candidate)) {
        candidate = `${src.name} (Copy ${counter})`
        counter++
      }
      const dup = { ...src, id: crypto.randomUUID(), name: candidate }
      const next = [...formulasData.formulas, dup]
      try {
        await window.electronAPI.saveFormulas(activeLibrary, { ...formulasData, formulas: next })
        setFormulasData((prev) => ({ ...prev, formulas: next }))
        setSnackbar({ message: `Duplicated as "${candidate}".`, severity: 'success' })
      } catch (err) {
        setSnackbar({
          message: `Duplicate failed: ${err?.message ?? 'Unknown error'}`,
          severity: 'error'
        })
      }
    },
    [activeLibrary, formulasData, findById]
  )

  const handleToggleArchived = () => setShowArchived((v) => !v)
  const onSelectionChange = useCallback((set) => setSelectionCount(set.size), [])

  // ── Import / settings ───────────────────────────────────────────────────────
  const doImport = async () => {
    if (!activeLibrary) {
      setSnackbar({
        message: 'No library selected. Open a library from Settings first.',
        severity: 'error'
      })
      return
    }
    try {
      const result = await window.electronAPI.importFormulas(activeLibrary)
      if (!result) return // user cancelled
      await window.electronAPI.saveFormulas(activeLibrary, result.data)
      setFormulasData(result.data)
      setSelectedFile(null)
      setEditingFormula(null)
      markClean()
      const parts = []
      if (result.updated) parts.push(`${result.updated} updated`)
      if (result.added) parts.push(`${result.added} added`)
      if (result.duplicates?.length)
        parts.push(`${result.duplicates.length} duplicate string(s) flagged`)
      setSnackbar({
        message: `Import complete: ${parts.join(', ') || 'no changes'}.`,
        severity: result.duplicates?.length ? 'warning' : 'success'
      })
    } catch (err) {
      setSnackbar({
        message: `Import failed: ${err?.message ?? 'Unknown error'}`,
        severity: 'error'
      })
    }
  }
  const handleImport = () => guard(doImport)

  const handleSettingsSave = async (newSettings) => {
    const next = { ...formulasData, settings: newSettings }
    try {
      await window.electronAPI.saveFormulas(activeLibrary, next)
      setFormulasData(next)
      setSnackbar({ message: 'Settings saved.', severity: 'success' })
    } catch (err) {
      setSnackbar({
        message: `Failed to save settings: ${err?.message ?? 'Unknown error'}`,
        severity: 'error'
      })
    }
  }

  const handleDirtyChange = useCallback(
    (dirty) => {
      dirty ? markDirty() : markClean()
    },
    [markDirty, markClean]
  )

  const extraActions = useMemo(
    () => [
      {
        icon: <FileUploadIcon fontSize="small" />,
        tooltip: 'Import from Lua',
        onClick: handleImport
      },
      {
        icon: <SettingsIcon fontSize="small" />,
        tooltip: 'Formula Settings',
        onClick: () => setSettingsOpen(true)
      }
    ],
    [handleImport]
  )

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <EditorFileListPanel
        title="Formulas"
        entityLabel="Formula"
        files={activeFiles}
        archivedFiles={archivedFiles}
        selectedFile={selectedFile}
        onSelect={handleSelect}
        onNew={handleNew}
        showArchived={showArchived}
        onToggleArchived={handleToggleArchived}
        loading={loading}
        onArchive={handleBulkArchive}
        onUnarchive={handleBulkUnarchive}
        onDelete={handleBulkDelete}
        onDuplicate={handleDuplicate}
        onSelectionChange={onSelectionChange}
        extraActions={extraActions}
      />
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {loading ? (
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
          >
            <CircularProgress size={64} thickness={4} color="info" disableShrink />
          </Box>
        ) : editingFormula ? (
          <FormulaEditor
            formula={editingFormula}
            allFormulas={formulasData.formulas}
            isExisting={formulasData.formulas.some((f) => f.id === editingFormula.id)}
            onSave={handleSave}
            onDirtyChange={handleDirtyChange}
            saveRef={saveRef}
            settings={formulasData.settings}
          />
        ) : (
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
          >
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              Select a formula or create a new one.
            </Typography>
          </Box>
        )}
        <MultiSelectOverlay count={selectionCount} />
      </Box>
      <FormulaSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={formulasData.settings}
        onSave={handleSettingsSave}
      />
      <UnsavedChangesDialog
        open={dialogOpen}
        label="Formula"
        onSave={handleDialogSave}
        onDiscard={handleDialogDiscard}
        onCancel={handleDialogCancel}
      />
      <Snackbar
        open={!!snackbar}
        autoHideDuration={6000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar?.severity ?? 'info'}
          onClose={() => setSnackbar(null)}
          sx={{ width: '100%' }}
        >
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default FormulasPage
