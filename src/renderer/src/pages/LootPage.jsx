import React, { useState, useEffect, useCallback } from 'react'
import { useRecoilValue, useRecoilState } from 'recoil'
import {
  Box,
  Typography,
  Divider,
  Button,
  Tooltip,
  IconButton,
  Snackbar,
  Alert,
  CircularProgress
} from '@mui/material'
import { activeLibraryState, libraryIndexState } from '../recoil/atoms'
import LootEditor from '../components/loot/LootEditor'
import EditorFileListPanel from '../components/shared/EditorFileListPanel'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'

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
  const activeLibrary = useRecoilValue(activeLibraryState)
  const [libraryIndex, setLibraryIndex] = useRecoilState(libraryIndexState)
  const namesByFilename = libraryIndex?.lootsetsNamesByFilename
  const [files, setFiles] = useState([])
  const [archivedFiles, setArchivedFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [editingLoot, setEditingLoot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingLoot, setLoadingLoot] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
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

  const loadActiveFiles = async (library) => {
    if (!library) {
      setFiles([])
      return
    }
    const items = await window.electronAPI.listDir(`${library}/${LOOT_SUBDIR}`)
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
      setEditingLoot(null)
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
      const newPath =
        isRename || !selectedFile
          ? `${activeLibrary}/${LOOT_SUBDIR}/${fileName}`
          : selectedFile.path

      await window.electronAPI.saveLoot(newPath, data)
      setEditingLoot(data)
      markClean()

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
        setSelectedFile({ name: fileName, path: newPath })
      }

      if (activeLibrary) {
        await loadActiveFiles(activeLibrary)
        const section = await window.electronAPI.buildIndexSection(activeLibrary, LOOT_SUBDIR)
        setLibraryIndex((prev) => ({ ...prev, ...section }))
      }
    } catch (err) {
      console.error('Failed to save loot set:', err)
    }
  }

  const handleArchive = async () => {
    if (!selectedFile || !activeLibrary) return
    const result = await window.electronAPI.moveFile(
      selectedFile.path,
      `${activeLibrary}/${IGNORE_SUBDIR}/${selectedFile.name}`
    )
    if (result?.conflict) {
      setSnackbar({
        message: 'An archived loot set with this name already exists.',
        severity: 'error'
      })
      return
    }
    markClean()
    setSelectedFile(null)
    setEditingLoot(null)
    await loadActiveFiles(activeLibrary)
    await loadArchivedFiles(activeLibrary)
    const section = await window.electronAPI.buildIndexSection(activeLibrary, LOOT_SUBDIR)
    setLibraryIndex((prev) => ({ ...prev, ...section }))
  }

  const handleUnarchive = async () => {
    if (!selectedFile || !activeLibrary) return
    const result = await window.electronAPI.moveFile(
      selectedFile.path,
      `${activeLibrary}/${LOOT_SUBDIR}/${selectedFile.name}`
    )
    if (result?.conflict) {
      setSnackbar({
        message:
          'An active loot set with this name already exists. Rename the archived file before unarchiving.',
        severity: 'error'
      })
      return
    }
    markClean()
    setSelectedFile(null)
    setEditingLoot(null)
    await loadActiveFiles(activeLibrary)
    await loadArchivedFiles(activeLibrary)
    const section = await window.electronAPI.buildIndexSection(activeLibrary, LOOT_SUBDIR)
    setLibraryIndex((prev) => ({ ...prev, ...section }))
  }

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
        showArchived={showArchived}
        onToggleArchived={handleToggleArchived}
        namesByFilename={namesByFilename}
        loading={loading}
      />
      <Box sx={{ flex: 1, p: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
            <Typography variant="body1" color="text.secondary">
              Select a loot set or create a new one.
            </Typography>
          </Box>
        )}
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
