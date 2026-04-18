import React, { useState, useEffect, useCallback } from 'react'
import { useRecoilValue, useRecoilState } from 'recoil'
import {
  Box,
  Typography,
  Divider,
  Button,
  Tooltip,
  TextField,
  IconButton,
  Snackbar,
  Alert,
  CircularProgress
} from '@mui/material'
import { activeLibraryState, libraryIndexState } from '../recoil/atoms'
import ItemEditor from '../components/items/ItemEditor'
import EditorFileListPanel from '../components/shared/EditorFileListPanel'
import { DEFAULT_ITEM } from '../data/itemConstants'
import { validateItem } from '../data/itemValidation'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'

const ITEMS_SUBDIR = 'items'
const IGNORE_SUBDIR = 'items/.ignore'

function ItemsPage() {
  const activeLibrary = useRecoilValue(activeLibraryState)
  const [libraryIndex, setLibraryIndex] = useRecoilState(libraryIndexState)
  const namesByFilename = libraryIndex?.itemsNamesByFilename
  const [files, setFiles] = useState([])
  const [archivedFiles, setArchivedFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingItem, setLoadingItem] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [editWarnings, setEditWarnings] = useState([])
  const [snackbar, setSnackbar] = useState(null) // { message, severity }

  const {
    markDirty,
    markClean,
    saveRef,
    guard,
    dialogOpen,
    handleDialogSave,
    handleDialogDiscard,
    handleDialogCancel
  } = useUnsavedGuard('Item')

  const loadActiveFiles = async (library) => {
    if (!library) {
      setFiles([])
      return
    }
    const items = await window.electronAPI.listDir(`${library}/${ITEMS_SUBDIR}`)
    setFiles(items)
  }

  const loadArchivedFiles = async (library) => {
    if (!library) {
      setArchivedFiles([])
      return
    }
    const items = await window.electronAPI.listDir(`${library}/${IGNORE_SUBDIR}`)
    setArchivedFiles(items.map((f) => ({ ...f, archived: true })))
  }

  useEffect(() => {
    if (!activeLibrary) {
      setFiles([])
      setArchivedFiles([])
      setSelectedFile(null)
      setEditingItem(null)
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([loadActiveFiles(activeLibrary), loadArchivedFiles(activeLibrary)]).finally(() =>
      setLoading(false)
    )
  }, [activeLibrary])

  const handleToggleArchived = async () => {
    const next = !showArchived
    setShowArchived(next)
    if (next && activeLibrary) await loadArchivedFiles(activeLibrary)
  }

  const doNew = () => {
    setSelectedFile(null)
    setLoadError(null)
    setEditWarnings([])
    setEditingItem(JSON.parse(JSON.stringify(DEFAULT_ITEM)))
  }
  const handleNew = () => guard(doNew)

  const doSelect = async (file) => {
    setSelectedFile(file)
    setLoadError(null)
    setEditWarnings([])
    setEditingItem(null)
    setLoadingItem(true)
    try {
      const item = await window.electronAPI.loadItem(file.path)
      setEditingItem(item)
      setEditWarnings(validateItem(item))
    } catch (err) {
      console.error('Failed to load item:', err)
      setLoadError(err?.message || 'Failed to parse XML.')
    } finally {
      setLoadingItem(false)
    }
  }
  const handleSelect = (file) => guard(() => doSelect(file))

  const handleSave = async (data, fileName) => {
    try {
      const isRename = !!(selectedFile && fileName !== selectedFile.name)
      const newPath =
        isRename || !selectedFile
          ? `${activeLibrary}/${ITEMS_SUBDIR}/${fileName}`
          : selectedFile.path

      await window.electronAPI.saveItem(newPath, data)
      setEditingItem(data) // #6: sync editor to saved data before any selectedFile change

      if (isRename) {
        const result = await window.electronAPI.archiveFile(
          selectedFile.path,
          `${activeLibrary}/${IGNORE_SUBDIR}`
        )
        setSelectedFile({ name: fileName, path: newPath })
        setSnackbar({
          message: `Renamed. Old file archived as "${result.archivedAs}".`,
          severity: 'success'
        })
      } else if (!selectedFile) {
        setSelectedFile({ name: fileName, path: newPath }) // #5: associate with file after first save
      }

      markClean()
      if (activeLibrary) {
        await loadActiveFiles(activeLibrary)
        const section = await window.electronAPI.buildIndexSection(activeLibrary, ITEMS_SUBDIR)
        setLibraryIndex((prev) => ({ ...prev, ...section }))
      }
    } catch (err) {
      console.error('Failed to save item:', err)
    }
  }

  const handleArchive = async () => {
    if (!selectedFile || !activeLibrary) return
    const src = selectedFile.path
    const dest = `${activeLibrary}/${IGNORE_SUBDIR}/${selectedFile.name}`
    const result = await window.electronAPI.moveFile(src, dest)
    if (result?.conflict) {
      setSnackbar({ message: 'An archived item with this name already exists.', severity: 'error' })
      return
    }
    markClean()
    setSelectedFile(null)
    setEditingItem(null)
    await loadActiveFiles(activeLibrary)
    await loadArchivedFiles(activeLibrary)
    const section = await window.electronAPI.buildIndexSection(activeLibrary, ITEMS_SUBDIR)
    setLibraryIndex((prev) => ({ ...prev, ...section }))
  }

  const handleUnarchive = async () => {
    if (!selectedFile || !activeLibrary) return
    const src = selectedFile.path
    const dest = `${activeLibrary}/${ITEMS_SUBDIR}/${selectedFile.name}`
    const result = await window.electronAPI.moveFile(src, dest)
    if (result?.conflict) {
      setSnackbar({
        message:
          'An active item with this name already exists. Rename the archived item before unarchiving.',
        severity: 'error'
      })
      return
    }
    markClean()
    setSelectedFile(null)
    setEditingItem(null)
    await loadActiveFiles(activeLibrary)
    await loadArchivedFiles(activeLibrary)
    const section = await window.electronAPI.buildIndexSection(activeLibrary, ITEMS_SUBDIR)
    setLibraryIndex((prev) => ({ ...prev, ...section }))
  }

  const handleDirtyChange = useCallback(
    (dirty) => {
      dirty ? markDirty() : markClean()
    },
    [markDirty, markClean]
  )
  const isArchived = selectedFile?.archived === true

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <EditorFileListPanel
        title="Items"
        entityLabel="Item"
        files={files}
        archivedFiles={archivedFiles}
        selectedFile={selectedFile}
        onSelect={handleSelect}
        onNew={handleNew}
        showArchived={showArchived}
        onToggleArchived={handleToggleArchived}
        namesByFilename={namesByFilename}
        loading={loading}
      />
      <Box sx={{ flex: 1, p: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loadError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>Failed to load item:</strong> {loadError}
          </Alert>
        ) : loadingItem ? (
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
          >
            <CircularProgress size={64} thickness={4} color="info" disableShrink />
          </Box>
        ) : editingItem ? (
          <ItemEditor
            item={editingItem}
            initialFileName={selectedFile?.name ?? null}
            isArchived={isArchived}
            isExisting={!!selectedFile}
            warnings={editWarnings}
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
            <Typography variant="body1" sx={{
              color: "text.secondary"
            }}>
              Select an item or create a new one.
            </Typography>
          </Box>
        )}
      </Box>
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
      <UnsavedChangesDialog
        open={dialogOpen}
        label="Item"
        onSave={handleDialogSave}
        onDiscard={handleDialogDiscard}
        onCancel={handleDialogCancel}
      />
    </Box>
  );
}

export default ItemsPage
