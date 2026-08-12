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
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'
import { resolveSavePath, folderOptions, relDir, toSectionFile } from '../utils/fileTree'

const SUBDIR = 'elementtables'
const IGNORE_SUBDIR = 'elementtables/.ignore'

const DEFAULT_TABLE = {
  name: '',
  comment: '',
  elements: ['NewElement(1)'],
  matrix: [[100]]
}

function ElementsPage() {
  const activeLibrary = useStoreValue(activeLibraryState)
  const [libraryIndex, setLibraryIndex] = useStoreState(libraryIndexState)
  const namesByFilename = libraryIndex?.elementtablesNamesByFilename
  const [selectedFile, setSelectedFile] = useState(null)
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

  const { files, archivedFiles, loading, loadFiles } = useSectionFiles(
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
    () => folderOptions([...files, ...archivedFiles]),
    [files, archivedFiles]
  )
  // treePath, not rel: an archived file's picker shows where it sits within the
  // type, not `.ignore/…`. resolveSavePath puts the prefix back.
  const initialFolder = selectedFile ? relDir(selectedFile.treePath) : ''

  const doNew = () => {
    setSelectedFile(null)
    setLoadError(null)
    setEditingTable({ ...DEFAULT_TABLE })
  }
  const handleNew = () => guard(doNew)

  const doSelect = async (file) => {
    setSelectedFile(file)
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

  const handleSave = async (data, fileName, folder, mode = 'archive') => {
    try {
      const wasArchived = selectedFile?.archived === true
      const { newPath, newRel, isRename } = resolveSavePath(
        activeLibrary,
        SUBDIR,
        selectedFile,
        fileName,
        folder
      )
      // The list's own shape, so the next save reads back the folder it landed
      // in rather than an ad-hoc object with no treePath.
      const nextFile = () => toSectionFile(`${activeLibrary}/${SUBDIR}`, newRel, wasArchived)

      // Rename: change the file's name before anything is written, so a
      // collision is refused while both files still exist. `moveFile`
      // treats a change of capitalisation as the same file, not a clash.
      if (isRename && mode === 'rename') {
        const moved = await window.electronAPI.moveFile(selectedFile.path, newPath)
        if (moved?.conflict) {
          setSnackbar({ message: `"${newRel}" already exists.`, severity: 'error' })
          return
        }
      }
      await window.electronAPI.saveElementTable(newPath, data)
      setEditingTable(data) // #6: sync editor to saved data before any selectedFile change

      if (isRename && mode === 'rename') {
        setSelectedFile(nextFile())
        setSnackbar({ message: `Renamed to "${newRel}".`, severity: 'success' })
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
    handleDuplicate
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
            <strong>Failed to load element table:</strong> {loadError}
          </Alert>
        ) : loadingTable ? (
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
          >
            <CircularProgress size={64} thickness={4} color="info" disableShrink />
          </Box>
        ) : editingTable ? (
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
              Select an element table or create a new one.
            </Typography>
          </Box>
        )}
        <MultiSelectOverlay count={selectionCount} />
      </Box>
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
