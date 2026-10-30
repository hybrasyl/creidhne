import { useState, useCallback, useMemo } from 'react'
import { Box, Typography, Snackbar, Alert, CircularProgress } from '@mui/material'
import {
  useStoreValue,
  useStoreState,
  activeLibraryState,
  libraryIndexState
} from '../store/appStore'
import SpeciesEditor from '../components/species/SpeciesEditor'
import EditorFileListPanel from '../components/shared/EditorFileListPanel'
import MultiSelectOverlay from '../components/shared/MultiSelectOverlay'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'
import { useBulkFileActions } from '../hooks/useBulkFileActions'
import { useSectionFiles } from '../hooks/useSectionFiles'
import { useOpenFileRequest } from '../hooks/useOpenFileRequest'
import SharedKeyNotice from '../components/shared/SharedKeyNotice'
import StagedReferenceNotice from '../components/shared/StagedReferenceNotice'
import StagingScope from '../components/shared/StagingScope'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'
import { resolveSavePath, folderOptions, relDir } from '../utils/fileTree'

const SPECIES_SUBDIR = 'species'
const IGNORE_SUBDIR = 'species/.ignore'

// A new species is Locked, as the card asks: nobody can pick it until its
// author says so.
const DEFAULT_SPECIES = {
  key: '',
  comment: '',
  id: '',
  origin: '',
  playerOption: 'Locked',
  branchOf: '',
  affinity: '',
  resistance: '',
  names: { singular: '', plural: '', adjective: '' },
  description: '',
  bodies: []
}

function SpeciesPage() {
  const activeLibrary = useStoreValue(activeLibraryState)
  const [libraryIndex, setLibraryIndex] = useStoreState(libraryIndexState)
  const namesByFilename = libraryIndex?.speciesNamesByFilename
  const [selectedFile, setSelectedFile] = useState(null)
  // Where the next save writes: the live tree, or staging while the editor's
  // Staging box is checked (HTOO-453, HTOO-628).
  const [saveStaged, setSaveStaged] = useState(false)
  const [editingSpecies, setEditingSpecies] = useState(null)
  const [loadingSpecies, setLoadingSpecies] = useState(false)
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
  } = useUnsavedGuard('Species')

  const {
    files,
    archivedFiles,
    stagedFiles,
    stagedDir,
    stagedNamesByFilename,
    loading,
    loadFiles
  } = useSectionFiles(
    activeLibrary,
    SPECIES_SUBDIR,
    useCallback(() => {
      setSelectedFile(null)
      setEditingSpecies(null)
    }, [])
  )

  // Save destinations the picker offers: every folder this section already uses,
  // archived ones included — a folder emptied by archiving everything in it is
  // still somewhere you might file a species.
  const folderChoices = useMemo(
    () => folderOptions([...files, ...archivedFiles, ...stagedFiles]),
    [files, archivedFiles, stagedFiles]
  )
  // treePath, not rel: an archived file's picker shows where it sits within the
  // type, not `.ignore/…`. resolveSavePath puts the prefix back.
  const initialFolder = selectedFile ? relDir(selectedFile.treePath) : ''

  const doNew = (staged = false) => {
    setSaveStaged(staged)
    setSelectedFile(null)
    setLoadError(null)
    setEditingSpecies({ ...DEFAULT_SPECIES, names: { ...DEFAULT_SPECIES.names }, bodies: [] })
  }
  // The panel passes `{ staged }`: true when the list shows only staged files.
  const handleNew = (opts) => guard(() => doNew(opts?.staged === true))

  const doSelect = async (file) => {
    setSelectedFile(file)
    setSaveStaged(file.staged === true)
    setLoadError(null)
    setEditingSpecies(null)
    setLoadingSpecies(true)
    try {
      const loaded = await window.electronAPI.loadSpecies(file.path)
      setEditingSpecies(loaded)
    } catch (err) {
      console.error('Failed to load species:', err)
      setLoadError(err?.message || 'Failed to parse XML.')
    } finally {
      setLoadingSpecies(false)
    }
  }
  const handleSelect = (file) => guard(() => doSelect(file))
  // A report can ask this page to open a file (HTOO-625).
  useOpenFileRequest(SPECIES_SUBDIR, files, loading, handleSelect)

  const handleSave = async (data, fileName, folder, mode = 'archive') => {
    // No rename offer (HTOO-378): player saves store the key, so the editor
    // locks it after the first save, and only a duplicated file's copy may
    // take a new one. Its branches belong to the original.
    try {
      // Staging keeps no archive, so a staged Save renames in place (HTOO-453).
      const wasStaged = selectedFile?.staged === true
      const {
        newPath,
        newRel,
        isRename,
        crossesRoot,
        file: savedFile
      } = resolveSavePath(
        activeLibrary,
        SPECIES_SUBDIR,
        selectedFile,
        fileName,
        folder,
        saveStaged ? stagedDir : undefined
      )
      // The list's own shape, so the next save reads back the folder it landed
      // in rather than an ad-hoc object with no treePath.
      const nextFile = () => savedFile
      // The Staging box moves the file between the live tree and staging
      // (HTOO-628): Stage's or Release's checks, before anything is written.
      const move = await confirmMove(crossesRoot ? selectedFile : null, data.name)
      if (move.cancelled) return

      // Rename: change the file's name before anything is written, so a
      // collision is refused while both files still exist. `moveFile`
      // treats a change of capitalisation as the same file, not a clash.
      if (isRename && (mode === 'rename' || wasStaged || crossesRoot)) {
        const moved = await window.electronAPI.moveFile(selectedFile.path, newPath)
        if (moved?.conflict) {
          setSnackbar({ message: `"${newRel}" already exists.`, severity: 'error' })
          return
        }
      }
      await window.electronAPI.saveSpecies(newPath, data)
      setEditingSpecies(data)

      if (isRename && (mode === 'rename' || wasStaged || crossesRoot)) {
        setSelectedFile(nextFile())
        setSnackbar({ message: move.describe(newRel), severity: 'success' })
      } else if (isRename) {
        const result = await window.electronAPI.archiveFile(
          selectedFile.path,
          `${activeLibrary}/${IGNORE_SUBDIR}`
        )
        setSelectedFile(nextFile())
        setSnackbar({
          message: `Saved as "${newRel}". Old file archived as "${result.archivedAs}".`,
          severity: 'success'
        })
      } else if (!selectedFile) {
        setSelectedFile(nextFile())
      }

      markClean()
      await loadFiles(activeLibrary)
      if (activeLibrary) {
        const section = await window.electronAPI.buildIndexSection(activeLibrary, SPECIES_SUBDIR)
        setLibraryIndex((prev) => ({ ...prev, ...section }))
      }
      await move.apply(newPath)
    } catch (err) {
      console.error('Failed to save species:', err)
      setSnackbar({ message: 'Save failed.', severity: 'error' })
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
    handleDuplicate,
    handleBulkStage,
    handleBulkRelease,
    confirmMove
  } = useBulkFileActions({
    activeLibrary,
    subdir: SPECIES_SUBDIR,
    ignoreSubdir: IGNORE_SUBDIR,
    selectedFile,
    setSelectedFile,
    clearEditing: () => setEditingSpecies(null),
    setLibraryIndex,
    loadFiles,
    setSnackbar,
    markClean
  })

  // A branch shows the Affinity and Resistance it takes from its parent, which
  // the index does not hold, so the parent's file is read.
  const loadParent = useCallback(
    async (key) => {
      const k = String(key ?? '').toLowerCase()
      if (!k) return null
      const file = files.find((f) => String(namesByFilename?.[f.rel] ?? '').toLowerCase() === k)
      return file ? window.electronAPI.loadSpecies(file.path) : null
    },
    [files, namesByFilename]
  )

  // The Staging box is an edit: the next Save moves the file.
  const handleSaveStagedChange = useCallback(
    (staged) => {
      setSaveStaged(staged)
      markDirty()
    },
    [markDirty]
  )

  const handleDirtyChange = useCallback(
    (dirty) => {
      dirty ? markDirty() : markClean()
    },
    [markDirty, markClean]
  )

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <EditorFileListPanel
        title="Species"
        entityLabel="Species"
        files={files}
        archivedFiles={archivedFiles}
        selectedFile={selectedFile}
        onSelect={handleSelect}
        onNew={handleNew}
        namesByFilename={namesByFilename}
        loading={loading}
        onArchive={handleBulkArchive}
        onUnarchive={handleBulkUnarchive}
        stagedFiles={stagedFiles}
        stagedNamesByFilename={stagedNamesByFilename}
        onStage={handleBulkStage}
        onRelease={handleBulkRelease}
        onDelete={handleBulkDelete}
        onDuplicate={handleDuplicate}
        onSelectionChange={onSelectionChange}
      >
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
          <SharedKeyNotice type={SPECIES_SUBDIR} file={selectedFile} />
          <StagedReferenceNotice type={SPECIES_SUBDIR} file={selectedFile} />
          {loadError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              <strong>Failed to load species:</strong> {loadError}
            </Alert>
          ) : loadingSpecies ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%'
              }}
            >
              <CircularProgress size={64} thickness={4} color="info" disableShrink />
            </Box>
          ) : editingSpecies ? (
            <StagingScope saveStaged={saveStaged} onSaveStagedChange={handleSaveStagedChange}>
              <SpeciesEditor
                species={editingSpecies}
                initialFileName={selectedFile?.name ?? null}
                initialFolder={initialFolder}
                folderOptions={folderChoices}
                isArchived={selectedFile?.archived === true}
                isExisting={!!selectedFile}
                onSave={handleSave}
                onArchive={handleArchive}
                onUnarchive={handleUnarchive}
                onDirtyChange={handleDirtyChange}
                saveRef={saveRef}
                loadParent={loadParent}
              />
            </StagingScope>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%'
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  color: 'text.secondary'
                }}
              >
                Select a species or create a new one.
              </Typography>
            </Box>
          )}
          <MultiSelectOverlay count={selectionCount} />
        </Box>
      </EditorFileListPanel>
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
        label="Species"
        onSave={handleDialogSave}
        onDiscard={handleDialogDiscard}
        onCancel={handleDialogCancel}
      />
    </Box>
  )
}

export default SpeciesPage
