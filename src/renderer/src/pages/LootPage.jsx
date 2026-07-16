import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, Snackbar, Alert, CircularProgress } from '@mui/material'
import {
  useStoreValue,
  useStoreState,
  activeLibraryState,
  libraryIndexState
} from '../store/appStore'
import LootEditor from '../components/loot/LootEditor'
import EditorFileListPanel from '../components/shared/EditorFileListPanel'
import MultiSelectOverlay from '../components/shared/MultiSelectOverlay'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'
import { useBulkFileActions } from '../hooks/useBulkFileActions'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'
import { toSectionFile, relDir } from '../utils/fileTree'

const LOOT_SUBDIR = 'lootsets'
const IGNORE_SUBDIR = 'lootsets/.ignore'

const DEFAULT_LOOT = {
  name: '',
  inInventory: false,
  comment: '',
  table: {
    rolls: '',
    chance: '',
    inInventory: false,
    gold: { min: '', max: '' },
    xp: { min: '', max: '' },
    items: { rolls: '', chance: '', entries: [] }
  }
}

function LootPage() {
  const activeLibrary = useStoreValue(activeLibraryState)
  const [libraryIndex, setLibraryIndex] = useStoreState(libraryIndexState)
  const namesByFilename = libraryIndex?.lootsetsNamesByFilename
  const [files, setFiles] = useState([])
  const [archivedFiles, setArchivedFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [editingLoot, setEditingLoot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingLoot, setLoadingLoot] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [snackbar, setSnackbar] = useState(null)

  const {
    markDirty,
    markClean,
    saveRef,
    guard,
    dialogOpen,
    handleDialogSave,
    handleDialogDiscard,
    handleDialogCancel
  } = useUnsavedGuard('Loot Set')

  // One recursive, archive-splitting call replaces the two flat listDir
  // calls. Each rel path IS the index key, so name lookups need no prefix.
  const loadFiles = useCallback(async (library) => {
    if (!library) {
      setFiles([])
      setArchivedFiles([])
      return
    }
    const { dir, active, archived } = await window.electronAPI.listSection(library, LOOT_SUBDIR)
    setFiles(active.map((rel) => toSectionFile(dir, rel, false)))
    setArchivedFiles(archived.map((rel) => toSectionFile(dir, rel, true)))
  }, [])

  useEffect(() => {
    if (!activeLibrary) {
      setFiles([])
      setArchivedFiles([])
      setSelectedFile(null)
      setEditingLoot(null)
      setLoading(false)
      return
    }
    setLoading(true)
    loadFiles(activeLibrary).finally(() => setLoading(false))
  }, [activeLibrary, loadFiles])

  const doNew = () => {
    setSelectedFile(null)
    setLoadError(null)
    setEditingLoot({
      ...DEFAULT_LOOT,
      table: { ...DEFAULT_LOOT.table, items: { ...DEFAULT_LOOT.table.items, entries: [] } }
    })
  }
  const handleNew = () => guard(doNew)

  const doSelect = async (file) => {
    setSelectedFile(file)
    setLoadError(null)
    setEditingLoot(null)
    setLoadingLoot(true)
    try {
      const loot = await window.electronAPI.loadLoot(file.path)
      setEditingLoot(loot)
    } catch (err) {
      console.error('Failed to load loot set:', err)
      setLoadError(err?.message || 'Failed to parse XML.')
    } finally {
      setLoadingLoot(false)
    }
  }
  const handleSelect = (file) => guard(() => doSelect(file))

  const handleSave = async (data, fileName) => {
    try {
      const isRename = !!(selectedFile && fileName !== selectedFile.name)
      // Rename in place: keep the file in whatever subfolder it was filed
      // under. Writing to `<type>/<name>` unconditionally would silently
      // lift it out of e.g. universal/ and back to the type root.
      const subDir = selectedFile ? relDir(selectedFile.rel) : ''
      const newPath =
        isRename || !selectedFile
          ? `${activeLibrary}/${LOOT_SUBDIR}/${subDir ? `${subDir}/` : ''}${fileName}`
          : selectedFile.path

      // `rel` rides along: it is the index key the panel looks names up by,
      // and the source of the subfolder on any later rename.
      const newRel = subDir ? `${subDir}/${fileName}` : fileName

      await window.electronAPI.saveLoot(newPath, data)
      setEditingLoot(data)
      markClean()

      if (isRename) {
        const result = await window.electronAPI.archiveFile(
          selectedFile.path,
          `${activeLibrary}/${IGNORE_SUBDIR}`
        )
        setSelectedFile({ rel: newRel, name: fileName, path: newPath })
        setSnackbar({
          message: `Renamed. Old file archived as "${result.archivedAs}".`,
          severity: 'success'
        })
      } else if (!selectedFile) {
        setSelectedFile({ rel: newRel, name: fileName, path: newPath })
      }

      if (activeLibrary) {
        await loadFiles(activeLibrary)
        const section = await window.electronAPI.buildIndexSection(activeLibrary, LOOT_SUBDIR)
        setLibraryIndex((prev) => ({ ...prev, ...section }))
      }
    } catch (err) {
      console.error('Failed to save loot set:', err)
    }
  }

  const {
    selectionCount,
    onSelectionChange,
    handleArchive,
    handleUnarchive,
    handleBulkArchive,
    handleBulkUnarchive,
    handleBulkDelete,
    handleDuplicate
  } = useBulkFileActions({
    activeLibrary,
    subdir: LOOT_SUBDIR,
    ignoreSubdir: IGNORE_SUBDIR,
    selectedFile,
    setSelectedFile,
    clearEditing: () => setEditingLoot(null),
    setLibraryIndex,
    loadFiles,
    setSnackbar,
    markClean
  })

  const handleDirtyChange = useCallback(
    (dirty) => {
      dirty ? markDirty() : markClean()
    },
    [markDirty, markClean]
  )

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <EditorFileListPanel
        title="Loot Sets"
        entityLabel="Loot Set"
        files={files}
        archivedFiles={archivedFiles}
        selectedFile={selectedFile}
        onSelect={handleSelect}
        onNew={handleNew}
        namesByFilename={namesByFilename}
        loading={loading}
        onArchive={handleBulkArchive}
        onUnarchive={handleBulkUnarchive}
        onDelete={handleBulkDelete}
        onDuplicate={handleDuplicate}
        onSelectionChange={onSelectionChange}
      />
      <Box
        sx={{
          flex: 1,
          p: 2,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {loadError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>Failed to load loot set:</strong> {loadError}
          </Alert>
        ) : loadingLoot ? (
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
          >
            <CircularProgress size={64} thickness={4} color="info" disableShrink />
          </Box>
        ) : editingLoot ? (
          <LootEditor
            loot={editingLoot}
            initialFileName={selectedFile?.name ?? null}
            isArchived={selectedFile?.archived === true}
            isExisting={!!selectedFile}
            onSave={handleSave}
            onArchive={handleArchive}
            onUnarchive={handleUnarchive}
            onDirtyChange={handleDirtyChange}
            saveRef={saveRef}
          />
        ) : (
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
          >
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary'
              }}
            >
              Select a loot set or create a new one.
            </Typography>
          </Box>
        )}
        <MultiSelectOverlay count={selectionCount} />
      </Box>
      <UnsavedChangesDialog
        open={dialogOpen}
        label="Loot Set"
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

export default LootPage
