import { useState, useCallback, useMemo } from 'react'
import { Box, Typography, Snackbar, Alert, CircularProgress } from '@mui/material'
import {
  useStoreValue,
  useStoreState,
  activeLibraryState,
  libraryIndexState
} from '../store/appStore'
import SpawngroupEditor from '../components/spawngroups/SpawngroupEditor'
import EditorFileListPanel from '../components/shared/EditorFileListPanel'
import MultiSelectOverlay from '../components/shared/MultiSelectOverlay'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'
import { useBulkFileActions } from '../hooks/useBulkFileActions'
import { useSectionFiles } from '../hooks/useSectionFiles'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'
import RenameReferencesDialog from '../components/shared/RenameReferencesDialog'
import { useRenameReferences } from '../hooks/useRenameReferences'
import { resolveSavePath, folderOptions, relDir, toSectionFile } from '../utils/fileTree'

const SPAWN_SUBDIR = 'spawngroups'
const IGNORE_SUBDIR = 'spawngroups/.ignore'

const DEFAULT_SPAWNGROUP = {
  name: '',
  prefix: '',
  baseLevel: '',
  despawnAfter: '',
  disabled: false,
  comment: '',
  loot: [],
  spawns: []
}

function SpawngroupsPage() {
  const activeLibrary = useStoreValue(activeLibraryState)
  const [libraryIndex, setLibraryIndex] = useStoreState(libraryIndexState)
  const namesByFilename = libraryIndex?.spawngroupsNamesByFilename
  const [selectedFile, setSelectedFile] = useState(null)
  const [editingSpawngroup, setEditingSpawngroup] = useState(null)
  const [loadingSpawngroup, setLoadingSpawngroup] = useState(false)
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
  } = useUnsavedGuard('Spawn Group')

  const { files, archivedFiles, loading, loadFiles } = useSectionFiles(
    activeLibrary,
    SPAWN_SUBDIR,
    useCallback(() => {
      setSelectedFile(null)
      setEditingSpawngroup(null)
    }, [])
  )

  // Save destinations the picker offers: every folder this section already uses,
  // archived ones included — a folder emptied by archiving everything in it is
  // still somewhere you might file a spawn group.
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
    setEditingSpawngroup({ ...DEFAULT_SPAWNGROUP, loot: [], spawns: [] })
  }
  const handleNew = () => guard(doNew)

  const doSelect = async (file) => {
    setSelectedFile(file)
    setLoadError(null)
    setEditingSpawngroup(null)
    setLoadingSpawngroup(true)
    try {
      const sg = await window.electronAPI.loadSpawngroup(file.path)
      setEditingSpawngroup(sg)
    } catch (err) {
      console.error('Failed to load spawn group:', err)
      setLoadError(err?.message || 'Failed to parse XML.')
    } finally {
      setLoadingSpawngroup(false)
    }
  }
  const handleSelect = (file) => guard(() => doSelect(file))

  // Renames used to be silently ignored here — the save always wrote back to
  // `selectedFile.path`, so editing the filename field did nothing. Now that the
  // folder picker can retarget a save too, this goes through resolveSavePath
  // like every other section and archives the file it supersedes.
  // HTOO-378: a <Name> is a key, so a changed name orphans every file that
  // names this entity. Offered before the save, so Cancel writes nothing.
  const { confirmRename, renameDialogProps } = useRenameReferences({
    activeLibrary,
    type: 'spawngroups',
    setSnackbar,
    setLibraryIndex
  })

  const handleSave = async (data, fileName, folder) => {
    try {
      // Before anything is written: the count the user is shown describes
      // the files as they stand, and Cancel is therefore truthful.
      const rename = await confirmRename(editingSpawngroup?.name, data.name, {
        isExisting: !!selectedFile
      })
      if (rename.cancelled) return
      const wasArchived = selectedFile?.archived === true
      const { newPath, newRel, isRename } = resolveSavePath(
        activeLibrary,
        SPAWN_SUBDIR,
        selectedFile,
        fileName,
        folder
      )
      // The list's own shape, so the next save reads back the folder it landed
      // in rather than an ad-hoc object with no treePath.
      const nextFile = () => toSectionFile(`${activeLibrary}/${SPAWN_SUBDIR}`, newRel, wasArchived)

      await window.electronAPI.saveSpawngroup(newPath, data)

      // Sync editingSpawngroup to the saved data BEFORE any selectedFile change
      // (HTOO-130, bug class 6). SpawngroupEditor's reset effect depends on
      // [spawngroup, initialFileName, initialFolder], and `initialFileName` is
      // `selectedFile?.name`. So the `setSelectedFile` below fires that effect, which
      // does `setData(spawngroup)` — and for a first save of a new spawngroup
      // `editingSpawngroup` is still the empty DEFAULT_SPAWNGROUP. The file on disk
      // was correct; the editor threw the user's work away in front of them.
      setEditingSpawngroup(data)

      markClean()

      if (isRename) {
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
      if ((isRename || !selectedFile) && activeLibrary) await loadFiles(activeLibrary)
      if (activeLibrary) {
        const section = await window.electronAPI.buildIndexSection(activeLibrary, SPAWN_SUBDIR)
        setLibraryIndex((prev) => ({ ...prev, ...section }))
      }
      // Last, and only once the entity itself is on disk: a failed entity
      // save must not leave the world repointed at a name never written.
      await rename.apply()
    } catch (err) {
      console.error('Failed to save spawn group:', err)
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
    subdir: SPAWN_SUBDIR,
    ignoreSubdir: IGNORE_SUBDIR,
    selectedFile,
    setSelectedFile,
    clearEditing: () => setEditingSpawngroup(null),
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
        title="Spawn Groups"
        entityLabel="Spawn Group"
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
            <strong>Failed to load spawn group:</strong> {loadError}
          </Alert>
        ) : loadingSpawngroup ? (
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
          >
            <CircularProgress size={64} thickness={4} color="info" disableShrink />
          </Box>
        ) : editingSpawngroup ? (
          <SpawngroupEditor
            spawngroup={editingSpawngroup}
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
              Select a spawn group or create a new one.
            </Typography>
          </Box>
        )}
        <MultiSelectOverlay count={selectionCount} />
      </Box>
      <RenameReferencesDialog {...renameDialogProps} />
      <UnsavedChangesDialog
        open={dialogOpen}
        label="Spawn Group"
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

export default SpawngroupsPage
