import { useState, useCallback, useMemo } from 'react'
import { Box, Typography, Snackbar, Alert, CircularProgress } from '@mui/material'
import {
  useStoreValue,
  useStoreState,
  activeLibraryState,
  libraryIndexState
} from '../store/appStore'
import StatusEditor from '../components/statuses/StatusEditor'
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
import RenameReferencesDialog from '../components/shared/RenameReferencesDialog'
import { useRenameReferences } from '../hooks/useRenameReferences'
import { resolveSavePath, folderOptions, relDir } from '../utils/fileTree'

const SUBDIR = 'statuses'
const IGNORE_SUBDIR = 'statuses/.ignore'

function makeDefaultEffectBlock() {
  return {
    animations: null,
    messages: null,
    heal: null,
    damage: null,
    statModifiers: null,
    conditions: null,
    handler: null
  }
}

const DEFAULT_STATUS = {
  name: '',
  comment: '',
  icon: '',
  duration: '',
  tick: '',
  removeChance: '',
  removeOnDeath: false,
  prohibitedMessage: '',
  prohibitedMessageKey: '',
  categories: [],
  castRestrictions: [],
  onApply: makeDefaultEffectBlock(),
  onTick: makeDefaultEffectBlock(),
  onRemove: makeDefaultEffectBlock(),
  onExpire: makeDefaultEffectBlock()
}

function StatusesPage() {
  const activeLibrary = useStoreValue(activeLibraryState)
  const [libraryIndex, setLibraryIndex] = useStoreState(libraryIndexState)
  const namesByFilename = libraryIndex?.statusesNamesByFilename
  const [selectedFile, setSelectedFile] = useState(null)
  // Where the next save writes: the live tree, or staging while the editor's
  // Staging box is checked (HTOO-453, HTOO-628).
  const [saveStaged, setSaveStaged] = useState(false)
  const [editingStatus, setEditingStatus] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
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
  } = useUnsavedGuard('Status')

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
    SUBDIR,
    useCallback(() => {
      setSelectedFile(null)
      setEditingStatus(null)
    }, [])
  )

  // Save destinations the picker offers: every folder this section already uses,
  // archived ones included — a folder emptied by archiving everything in it is
  // still somewhere you might file a status.
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
    setEditingStatus({
      ...DEFAULT_STATUS,
      onApply: makeDefaultEffectBlock(),
      onTick: makeDefaultEffectBlock(),
      onRemove: makeDefaultEffectBlock(),
      onExpire: makeDefaultEffectBlock()
    })
  }
  // The panel passes `{ staged }`: true when the list shows only staged files.
  const handleNew = (opts) => guard(() => doNew(opts?.staged === true))

  const doSelect = async (file) => {
    setSelectedFile(file)
    setSaveStaged(file.staged === true)
    setLoadError(null)
    setEditingStatus(null)
    setLoadingStatus(true)
    try {
      const s = await window.electronAPI.loadStatus(file.path)
      setEditingStatus(s)
    } catch (err) {
      console.error('Failed to load status:', err)
      setLoadError(err?.message || 'Failed to parse XML.')
    } finally {
      setLoadingStatus(false)
    }
  }
  const handleSelect = (file) => guard(() => doSelect(file))
  // A report can ask this page to open a file (HTOO-625).
  useOpenFileRequest(SUBDIR, files, loading, handleSelect)

  // HTOO-378: a <Name> is a key, so a changed name orphans every file that
  // names this entity. Offered before the save, so Cancel writes nothing.
  const { confirmRename, renameDialogProps } = useRenameReferences({
    activeLibrary,
    type: 'statuses',
    setSnackbar,
    setLibraryIndex
  })

  const handleSave = async (data, fileName, folder, mode = 'archive') => {
    try {
      // Before anything is written: the count the user is shown describes
      // the files as they stand, and Cancel is therefore truthful.
      const rename = await confirmRename(editingStatus?.name, data.name, {
        isExisting: !!selectedFile,
        staged: selectedFile?.staged === true
      })
      if (rename.cancelled) return
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
        SUBDIR,
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
      await window.electronAPI.saveStatus(newPath, data)
      setEditingStatus(data)
      markClean()

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

      if (activeLibrary) {
        await loadFiles(activeLibrary)
        const section = await window.electronAPI.buildIndexSection(activeLibrary, SUBDIR)
        setLibraryIndex((prev) => ({ ...prev, ...section }))
      }
      // Last, and only once the entity itself is on disk: a failed entity
      // save must not leave the world repointed at a name never written.
      await rename.apply()
      await move.apply(newPath)
    } catch (err) {
      console.error('Failed to save status:', err)
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
    subdir: SUBDIR,
    ignoreSubdir: IGNORE_SUBDIR,
    selectedFile,
    setSelectedFile,
    clearEditing: () => setEditingStatus(null),
    setLibraryIndex,
    loadFiles,
    setSnackbar,
    markClean
  })

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
        title="Statuses"
        entityLabel="Status"
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
          <SharedKeyNotice type={SUBDIR} file={selectedFile} />
          <StagedReferenceNotice type={SUBDIR} file={selectedFile} />
          {loadError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              <strong>Failed to load status:</strong> {loadError}
            </Alert>
          ) : loadingStatus ? (
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
          ) : editingStatus ? (
            <StagingScope saveStaged={saveStaged} onSaveStagedChange={handleSaveStagedChange}>
              <StatusEditor
                status={editingStatus}
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
                Select a status or create a new one.
              </Typography>
            </Box>
          )}
          <MultiSelectOverlay count={selectionCount} />
        </Box>
      </EditorFileListPanel>
      <RenameReferencesDialog {...renameDialogProps} />
      <UnsavedChangesDialog
        open={dialogOpen}
        label="Status"
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

export default StatusesPage
