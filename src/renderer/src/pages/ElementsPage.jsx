import { useState, useCallback, useMemo } from 'react'
import { Box, Typography, Snackbar, Alert, CircularProgress } from '@mui/material'
import {
  useStoreValue,
  useStoreState,
  activeLibraryState,
  libraryIndexState
} from '../store/appStore'
import ElementTableEditor from '../components/elementTables/ElementTableEditor'
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

const SUBDIR = 'elementtables'
const IGNORE_SUBDIR = 'elementtables/.ignore'

// A new table is in the registry format (HXML-24): it defines its elements,
// and declares only the pairs that it needs. The model is in
// src/shared/elementTable.js.
const DEFAULT_TABLE = {
  name: '',
  comment: '',
  defaultMultiplier: '',
  registry: true,
  elements: [{ key: 'Force', id: '0', retailId: '0', name: '', isDefault: true, ivernic: '' }],
  groups: [],
  sources: []
}

function ElementsPage() {
  const activeLibrary = useStoreValue(activeLibraryState)
  const [libraryIndex, setLibraryIndex] = useStoreState(libraryIndexState)
  const namesByFilename = libraryIndex?.elementtablesNamesByFilename
  const [selectedFile, setSelectedFile] = useState(null)
  // Where the next save writes: the live tree, or staging while the editor's
  // Staging box is checked (HTOO-453, HTOO-628).
  const [saveStaged, setSaveStaged] = useState(false)
  const [editingTable, setEditingTable] = useState(null)
  const [loadingTable, setLoadingTable] = useState(false)
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
  } = useUnsavedGuard('Element Table')

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
      setEditingTable(null)
    }, [])
  )

  // Save destinations the picker offers: every folder this section already uses,
  // archived ones included — a folder emptied by archiving everything in it is
  // still somewhere you might file an element table.
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
    setEditingTable({ ...DEFAULT_TABLE })
  }
  // The panel passes `{ staged }`: true when the list shows only staged files.
  const handleNew = (opts) => guard(() => doNew(opts?.staged === true))

  const doSelect = async (file) => {
    setSelectedFile(file)
    setSaveStaged(file.staged === true)
    setLoadError(null)
    setEditingTable(null)
    setLoadingTable(true)
    try {
      const table = await window.electronAPI.loadElementTable(file.path)
      setEditingTable(table)
    } catch (err) {
      console.error('Failed to load element table:', err)
      setLoadError(err?.message || 'Failed to parse XML.')
    } finally {
      setLoadingTable(false)
    }
  }
  const handleSelect = (file) => guard(() => doSelect(file))
  // A report can ask this page to open a file (HTOO-625).
  useOpenFileRequest(SUBDIR, files, loading, handleSelect)

  const handleSave = async (data, fileName, folder, mode = 'archive') => {
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
      await window.electronAPI.saveElementTable(newPath, data)
      setEditingTable(data) // #6: sync editor to saved data before any selectedFile change

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
        setSelectedFile(nextFile()) // #5: associate with file after first save
      }

      markClean()
      if (activeLibrary) {
        await loadFiles(activeLibrary)
        const section = await window.electronAPI.buildIndexSection(activeLibrary, SUBDIR)
        setLibraryIndex((prev) => ({ ...prev, ...section }))
      }
      await move.apply(newPath)
    } catch (err) {
      console.error('Failed to save element table:', err)
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
    clearEditing: () => setEditingTable(null),
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
        title="Element Tables"
        entityLabel="Element Table"
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
              <strong>Failed to load element table:</strong> {loadError}
            </Alert>
          ) : loadingTable ? (
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
          ) : editingTable ? (
            <StagingScope saveStaged={saveStaged} onSaveStagedChange={handleSaveStagedChange}>
              <ElementTableEditor
                table={editingTable}
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
                Select an element table or create a new one.
              </Typography>
            </Box>
          )}
          <MultiSelectOverlay count={selectionCount} />
        </Box>
      </EditorFileListPanel>
      <UnsavedChangesDialog
        open={dialogOpen}
        label="Element Table"
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

export default ElementsPage
