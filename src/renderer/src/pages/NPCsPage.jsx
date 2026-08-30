import { useState, useCallback, useMemo } from 'react'
import { Box, Typography, Snackbar, Alert, CircularProgress } from '@mui/material'
import {
  useStoreValue,
  useStoreState,
  activeLibraryState,
  libraryIndexState
} from '../store/appStore'
import NPCEditor from '../components/npcs/NPCEditor'
import EditorFileListPanel from '../components/shared/EditorFileListPanel'
import MultiSelectOverlay from '../components/shared/MultiSelectOverlay'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'
import { useBulkFileActions } from '../hooks/useBulkFileActions'
import { useSectionFiles } from '../hooks/useSectionFiles'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'
import RenameReferencesDialog from '../components/shared/RenameReferencesDialog'
import { useRenameReferences } from '../hooks/useRenameReferences'
import { resolveSavePath, folderOptions, relDir, toSectionFile } from '../utils/fileTree'

const NPCS_SUBDIR = 'npcs'
const IGNORE_SUBDIR = 'npcs/.ignore'

const DEFAULT_NPC = {
  name: '',
  displayName: '',
  comment: '',
  meta: { job: '', species: '', location: '' },
  sprite: '',
  portrait: '',
  allowDead: false,
  responses: [],
  strings: [],
  roles: {
    disableForget: false,
    bank: null,
    post: null,
    repair: null,
    vend: null,
    train: null
  }
}

function NPCsPage() {
  const activeLibrary = useStoreValue(activeLibraryState)
  const [libraryIndex, setLibraryIndex] = useStoreState(libraryIndexState)
  const namesByFilename = libraryIndex?.npcsNamesByFilename
  const [selectedFile, setSelectedFile] = useState(null)
  const [editingNpc, setEditingNpc] = useState(null)
  const [loadingNpc, setLoadingNpc] = useState(false)
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
  } = useUnsavedGuard('NPC')

  const { files, archivedFiles, loading, loadFiles } = useSectionFiles(
    activeLibrary,
    NPCS_SUBDIR,
    useCallback(() => {
      setSelectedFile(null)
      setEditingNpc(null)
    }, [])
  )

  // Save destinations the picker offers: every folder this section already uses,
  // archived ones included — a folder emptied by archiving everything in it is
  // still somewhere you might file an NPC.
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
    setEditingNpc({ ...DEFAULT_NPC, roles: { ...DEFAULT_NPC.roles } })
  }
  const handleNew = () => guard(doNew)

  const doSelect = async (file) => {
    setSelectedFile(file)
    setLoadError(null)
    setEditingNpc(null)
    setLoadingNpc(true)
    try {
      let npc = await window.electronAPI.loadNpc(file.path)
      if (!npc.meta?.job) {
        const namePart = file.name.replace(/\.xml$/i, '')
        const underscoreIdx = namePart.indexOf('_')
        if (underscoreIdx > 0) {
          const prefix = namePart.slice(0, underscoreIdx)
          if (prefix && prefix.toLowerCase() !== 'npc') {
            npc = { ...npc, meta: { ...(npc.meta || {}), job: prefix } }
          }
        }
      }
      setEditingNpc(npc)
    } catch (err) {
      console.error('Failed to load NPC:', err)
      setEditingNpc(null)
      setLoadError(err?.message || 'Failed to parse XML.')
    } finally {
      setLoadingNpc(false)
    }
  }
  const handleSelect = (file) => guard(() => doSelect(file))

  // HTOO-378: a <Name> is a key, so a changed name orphans every file that
  // names this entity. Maps place NPCs by name, so the referrers here are
  // files only Taliesin opens. Offered before the save, so Cancel writes
  // nothing.
  const { confirmRename, renameDialogProps } = useRenameReferences({
    activeLibrary,
    type: 'npcs',
    setSnackbar,
    setLibraryIndex
  })

  const handleSave = async (data, fileName, folder, mode = 'archive') => {
    try {
      // Before anything is written: the count the user is shown describes
      // the files as they stand, and Cancel is therefore truthful.
      const rename = await confirmRename(editingNpc?.name, data.name, {
        isExisting: !!selectedFile
      })
      if (rename.cancelled) return
      const wasArchived = selectedFile?.archived === true
      const { newPath, newRel, isRename } = resolveSavePath(
        activeLibrary,
        NPCS_SUBDIR,
        selectedFile,
        fileName,
        folder
      )
      // The list's own shape, so the next save reads back the folder it landed
      // in rather than an ad-hoc object with no treePath.
      const nextFile = () => toSectionFile(`${activeLibrary}/${NPCS_SUBDIR}`, newRel, wasArchived)

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
      await window.electronAPI.saveNpc(newPath, data)
      setEditingNpc(data)
      markClean()
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
        setSelectedFile(nextFile())
      }
      if (activeLibrary) {
        await loadFiles(activeLibrary)
        const section = await window.electronAPI.buildIndexSection(activeLibrary, NPCS_SUBDIR)
        setLibraryIndex((prev) => ({ ...prev, ...section }))
      }
      // Last, and only once the entity itself is on disk: a failed entity
      // save must not leave the world repointed at a name never written.
      await rename.apply()
    } catch (err) {
      console.error('Failed to save NPC:', err)
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
    subdir: NPCS_SUBDIR,
    ignoreSubdir: IGNORE_SUBDIR,
    selectedFile,
    setSelectedFile,
    clearEditing: () => setEditingNpc(null),
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
        title="NPCs"
        entityLabel="NPC"
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
            <strong>Failed to load NPC:</strong> {loadError}
          </Alert>
        ) : loadingNpc ? (
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
          >
            <CircularProgress size={64} thickness={4} color="info" disableShrink />
          </Box>
        ) : editingNpc ? (
          <NPCEditor
            npc={editingNpc}
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
              Select an NPC or create a new one.
            </Typography>
          </Box>
        )}
        <MultiSelectOverlay count={selectionCount} />
      </Box>
      <RenameReferencesDialog {...renameDialogProps} />
      <UnsavedChangesDialog
        open={dialogOpen}
        label="NPC"
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

export default NPCsPage
