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
import CreatureEditor from '../components/creatures/CreatureEditor'
import EditorFileListPanel from '../components/shared/EditorFileListPanel'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'

const CREATURES_SUBDIR = 'creatures'
const IGNORE_SUBDIR = 'creatures/.ignore'

const DEFAULT_CREATURE = {
  name: '',
  sprite: '',
  behaviorSet: '',
  minDmg: '',
  maxDmg: '',
  assailSound: '',
  comment: '',
  description: '',
  meta: { family: '' },
  loot: [],
  hostility: {
    players: false,
    playerExceptCookie: '',
    playerOnlyCookie: '',
    monsters: false,
    monsterExceptCookie: '',
    monsterOnlyCookie: ''
  },
  cookies: [],
  subtypes: []
}

function CreaturesPage() {
  const activeLibrary = useRecoilValue(activeLibraryState)
  const [libraryIndex, setLibraryIndex] = useRecoilState(libraryIndexState)
  const namesByFilename = libraryIndex?.creaturesNamesByFilename
  const [files, setFiles] = useState([])
  const [archivedFiles, setArchivedFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [editingCreature, setEditingCreature] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingCreature, setLoadingCreature] = useState(false)
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
  } = useUnsavedGuard('Creature')

  const loadActiveFiles = async (library) => {
    if (!library) {
      setFiles([])
      return
    }
    const items = await window.electronAPI.listDir(`${library}/${CREATURES_SUBDIR}`)
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
      setEditingCreature(null)
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
    setEditingCreature({ ...DEFAULT_CREATURE, hostility: { ...DEFAULT_CREATURE.hostility } })
  }
  const handleNew = () => guard(doNew)

  const doSelect = async (file) => {
    setSelectedFile(file)
    setLoadError(null)
    setEditingCreature(null)
    setLoadingCreature(true)
    try {
      let creature = await window.electronAPI.loadCreature(file.path)
      if (!creature.meta?.family) {
        const namePart = file.name.replace(/\.xml$/i, '')
        const underscoreIdx = namePart.indexOf('_')
        if (underscoreIdx > 0) {
          const prefix = namePart.slice(0, underscoreIdx)
          if (prefix) creature = { ...creature, meta: { ...(creature.meta || {}), family: prefix } }
        }
      }
      setEditingCreature(creature)
    } catch (err) {
      console.error('Failed to load creature:', err)
      setLoadError(err?.message || 'Failed to parse XML.')
    } finally {
      setLoadingCreature(false)
    }
  }
  const handleSelect = (file) => guard(() => doSelect(file))

  const handleSave = async (data, fileName) => {
    try {
      const isRename = !!(selectedFile && fileName !== selectedFile.name)
      const newPath =
        isRename || !selectedFile
          ? `${activeLibrary}/${CREATURES_SUBDIR}/${fileName}`
          : selectedFile.path
      await window.electronAPI.saveCreature(newPath, data)
      setEditingCreature(data)
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
        const section = await window.electronAPI.buildIndexSection(activeLibrary, CREATURES_SUBDIR)
        setLibraryIndex((prev) => ({ ...prev, ...section }))
      }
    } catch (err) {
      console.error('Failed to save creature:', err)
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
        message: 'An archived creature with this name already exists.',
        severity: 'error'
      })
      return
    }
    markClean()
    setSelectedFile(null)
    setEditingCreature(null)
    await loadActiveFiles(activeLibrary)
    await loadArchivedFiles(activeLibrary)
    const section = await window.electronAPI.buildIndexSection(activeLibrary, CREATURES_SUBDIR)
    setLibraryIndex((prev) => ({ ...prev, ...section }))
  }

  const handleUnarchive = async () => {
    if (!selectedFile || !activeLibrary) return
    const result = await window.electronAPI.moveFile(
      selectedFile.path,
      `${activeLibrary}/${CREATURES_SUBDIR}/${selectedFile.name}`
    )
    if (result?.conflict) {
      setSnackbar({
        message:
          'An active creature with this name already exists. Rename the archived creature before unarchiving.',
        severity: 'error'
      })
      return
    }
    markClean()
    setSelectedFile(null)
    setEditingCreature(null)
    await loadActiveFiles(activeLibrary)
    await loadArchivedFiles(activeLibrary)
    const section = await window.electronAPI.buildIndexSection(activeLibrary, CREATURES_SUBDIR)
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
        title="Creatures"
        entityLabel="Creature"
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
            <strong>Failed to load creature:</strong> {loadError}
          </Alert>
        ) : loadingCreature ? (
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
          >
            <CircularProgress size={64} thickness={4} color="info" disableShrink />
          </Box>
        ) : editingCreature ? (
          <CreatureEditor
            creature={editingCreature}
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
              Select a creature or create a new one.
            </Typography>
          </Box>
        )}
      </Box>
      <UnsavedChangesDialog
        open={dialogOpen}
        label="Creature"
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

export default CreaturesPage
