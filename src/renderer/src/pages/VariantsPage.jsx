import { useState, useCallback, useMemo } from 'react'
import { Box, Typography, Snackbar, Alert, CircularProgress } from '@mui/material'
import {
  useStoreValue,
  useStoreState,
  activeLibraryState,
  libraryIndexState
} from '../store/appStore'
import VariantEditor from '../components/variants/VariantEditor'
import EditorFileListPanel from '../components/shared/EditorFileListPanel'
import MultiSelectOverlay from '../components/shared/MultiSelectOverlay'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'
import { useBulkFileActions } from '../hooks/useBulkFileActions'
import { useSectionFiles } from '../hooks/useSectionFiles'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'
import RenameReferencesDialog from '../components/shared/RenameReferencesDialog'
import { useRenameReferences } from '../hooks/useRenameReferences'
import { resolveSavePath, folderOptions, relDir, toSectionFile } from '../utils/fileTree'

const VARIANTS_SUBDIR = 'variantgroups'
const IGNORE_SUBDIR = 'variantgroups/.ignore'

const DEFAULT_VARIANT_GROUP = {
  name: '',
  comment: '',
  variants: []
}

function VariantsPage() {
  const activeLibrary = useStoreValue(activeLibraryState)
  const [libraryIndex, setLibraryIndex] = useStoreState(libraryIndexState)
  const namesByFilename = libraryIndex?.variantgroupsNamesByFilename
  const [selectedFile, setSelectedFile] = useState(null)
  const [editingVariantGroup, setEditingVariantGroup] = useState(null)
  const [loadingVariantGroup, setLoadingVariantGroup] = useState(false)
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
  } = useUnsavedGuard('Variant Group')

  const { files, archivedFiles, loading, loadFiles } = useSectionFiles(
    activeLibrary,
    VARIANTS_SUBDIR,
    useCallback(() => {
      setSelectedFile(null)
      setEditingVariantGroup(null)
    }, [])
  )

  // Save destinations the picker offers: every folder this section already uses,
  // archived ones included — a folder emptied by archiving everything in it is
  // still somewhere you might file a variant group.
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
    setEditingVariantGroup({ ...DEFAULT_VARIANT_GROUP, variants: [] })
  }
  const handleNew = () => guard(doNew)

  const doSelect = async (file) => {
    setSelectedFile(file)
    setLoadError(null)
    setEditingVariantGroup(null)
    setLoadingVariantGroup(true)
    try {
      const vg = await window.electronAPI.loadVariantGroup(file.path)
      setEditingVariantGroup(vg)
    } catch (err) {
      console.error('Failed to load variant group:', err)
      setLoadError(err?.message || 'Failed to parse XML.')
    } finally {
      setLoadingVariantGroup(false)
    }
  }
  const handleSelect = (file) => guard(() => doSelect(file))

  // HTOO-378: a <Name> is a key, so a changed name orphans every file that
  // names this entity. Offered before the save, so Cancel writes nothing.
  const { confirmRename, renameDialogProps } = useRenameReferences({
    activeLibrary,
    type: 'variantgroups',
    setSnackbar,
    setLibraryIndex
  })

  const handleSave = async (data, fileName, folder, mode = 'archive') => {
    try {
      // Before anything is written: the count the user is shown describes
      // the files as they stand, and Cancel is therefore truthful.
      const rename = await confirmRename(editingVariantGroup?.name, data.name, {
        isExisting: !!selectedFile
      })
      if (rename.cancelled) return
      const wasArchived = selectedFile?.archived === true
      const { newPath, newRel, isRename } = resolveSavePath(
        activeLibrary,
        VARIANTS_SUBDIR,
        selectedFile,
        fileName,
        folder
      )
      // The list's own shape, so the next save reads back the folder it landed
      // in rather than an ad-hoc object with no treePath.
      const nextFile = () =>
        toSectionFile(`${activeLibrary}/${VARIANTS_SUBDIR}`, newRel, wasArchived)

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
      await window.electronAPI.saveVariantGroup(newPath, data)
      setEditingVariantGroup(data) // #6: sync editor to saved data before any selectedFile change

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
        const section = await window.electronAPI.buildIndexSection(activeLibrary, VARIANTS_SUBDIR)
        setLibraryIndex((prev) => ({ ...prev, ...section }))
      }
      // Last, and only once the entity itself is on disk: a failed entity
      // save must not leave the world repointed at a name never written.
      await rename.apply()
    } catch (err) {
      console.error('Failed to save variant group:', err)
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
    subdir: VARIANTS_SUBDIR,
    ignoreSubdir: IGNORE_SUBDIR,
    selectedFile,
    setSelectedFile,
    clearEditing: () => setEditingVariantGroup(null),
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
        title="Variant Groups"
        entityLabel="Variant Group"
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
            <strong>Failed to load variant group:</strong> {loadError}
          </Alert>
        ) : loadingVariantGroup ? (
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
          >
            <CircularProgress size={64} thickness={4} color="info" disableShrink />
          </Box>
        ) : editingVariantGroup ? (
          <VariantEditor
            variantGroup={editingVariantGroup}
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
              Select a variant group or create a new one.
            </Typography>
          </Box>
        )}
        <MultiSelectOverlay count={selectionCount} />
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
      <RenameReferencesDialog {...renameDialogProps} />
      <UnsavedChangesDialog
        open={dialogOpen}
        label="Variant Group"
        onSave={handleDialogSave}
        onDiscard={handleDialogDiscard}
        onCancel={handleDialogCancel}
      />
    </Box>
  )
}

export default VariantsPage
