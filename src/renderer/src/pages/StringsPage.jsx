import { useState, useCallback, useMemo } from 'react'
import { Box, Typography, Snackbar, Alert, CircularProgress } from '@mui/material'
import {
  useStoreValue,
  useStoreState,
  activeLibraryState,
  libraryIndexState
} from '../store/appStore'
import LocalizationEditor from '../components/localizations/LocalizationEditor'
import EditorFileListPanel from '../components/shared/EditorFileListPanel'
import MultiSelectOverlay from '../components/shared/MultiSelectOverlay'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'
import { useBulkFileActions } from '../hooks/useBulkFileActions'
import { useSectionFiles } from '../hooks/useSectionFiles'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'
import { resolveSavePath, folderOptions, relDir, toSectionFile } from '../utils/fileTree'

const LOCALIZATIONS_SUBDIR = 'localizations'
const IGNORE_SUBDIR = 'localizations/.ignore'

const DEFAULT_LOCALIZATION = {
  locale: '',
  comment: '',
  common: [],
  merchant: [],
  npcSpeak: [],
  monsterSpeak: [],
  npcResponses: []
}

// ── Page ─────────────────────────────────────────────────────────────────────
function StringsPage() {
  const activeLibrary = useStoreValue(activeLibraryState)
  const [libraryIndex, setLibraryIndex] = useStoreState(libraryIndexState)
  const namesByFilename = libraryIndex?.localizationsNamesByFilename
  const [selectedFile, setSelectedFile] = useState(null)
  const [editingLocalization, setEditingLocalization] = useState(null)
  const [loadingLocalization, setLoadingLocalization] = useState(false)
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
  } = useUnsavedGuard('Localization')

  const { files, archivedFiles, loading, loadFiles } = useSectionFiles(
    activeLibrary,
    LOCALIZATIONS_SUBDIR,
    useCallback(() => {
      setSelectedFile(null)
      setEditingLocalization(null)
    }, [])
  )

  // Save destinations the picker offers: every folder this section already uses,
  // archived ones included — a folder emptied by archiving everything in it is
  // still somewhere you might file a localization.
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
    setEditingLocalization({ ...DEFAULT_LOCALIZATION })
  }
  const handleNew = () => guard(doNew)

  const doSelect = async (file) => {
    setSelectedFile(file)
    setLoadError(null)
    setEditingLocalization(null)
    setLoadingLocalization(true)
    try {
      const loc = await window.electronAPI.loadLocalization(file.path)
      setEditingLocalization(loc)
    } catch (err) {
      console.error('Failed to load localization:', err)
      setLoadError(err?.message || 'Failed to parse XML.')
    } finally {
      setLoadingLocalization(false)
    }
  }
  const handleSelect = (file) => guard(() => doSelect(file))

  const handleSave = async (data, fileName, folder) => {
    try {
      const wasArchived = selectedFile?.archived === true
      const { newPath, newRel, isRename } = resolveSavePath(
        activeLibrary,
        LOCALIZATIONS_SUBDIR,
        selectedFile,
        fileName,
        folder
      )
      // The list's own shape, so the next save reads back the folder it landed
      // in rather than an ad-hoc object with no treePath.
      const nextFile = () =>
        toSectionFile(`${activeLibrary}/${LOCALIZATIONS_SUBDIR}`, newRel, wasArchived)

      await window.electronAPI.saveLocalization(newPath, data)
      setEditingLocalization(data)
      markClean()

      if (isRename) {
        const result = await window.electronAPI.archiveFile(
          selectedFile.path,
          `${activeLibrary}/${IGNORE_SUBDIR}`
        )
        setSelectedFile(nextFile())
        await loadFiles(activeLibrary)
        setSnackbar({
          message: `Saved as "${newRel}". Old file archived as "${result.archivedAs}".`,
          severity: 'success'
        })
      } else if (!selectedFile) {
        setSelectedFile(nextFile())
        await loadFiles(activeLibrary)
      }

      if (activeLibrary) {
        const section = await window.electronAPI.buildIndexSection(
          activeLibrary,
          LOCALIZATIONS_SUBDIR
        )
        setLibraryIndex((prev) => ({ ...prev, ...section }))
      }
    } catch (err) {
      console.error('Failed to save localization:', err)
      setSnackbar({
        message: `Failed to save: ${err?.message ?? 'Unknown error'}`,
        severity: 'error'
      })
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
    subdir: LOCALIZATIONS_SUBDIR,
    ignoreSubdir: IGNORE_SUBDIR,
    selectedFile,
    setSelectedFile,
    clearEditing: () => setEditingLocalization(null),
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
        title="Localizations"
        entityLabel="Localization"
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
            <strong>Failed to load localization:</strong> {loadError}
          </Alert>
        ) : loadingLocalization ? (
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
          >
            <CircularProgress size={64} thickness={4} color="info" disableShrink />
          </Box>
        ) : editingLocalization ? (
          <LocalizationEditor
            localization={editingLocalization}
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
              Select a localization or create a new one.
            </Typography>
          </Box>
        )}
        <MultiSelectOverlay count={selectionCount} />
      </Box>
      <UnsavedChangesDialog
        open={dialogOpen}
        label="Localization"
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

export default StringsPage
