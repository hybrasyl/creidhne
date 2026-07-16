import { useState, useEffect, useCallback } from 'react'
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
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'
import { toSectionFile, relDir } from '../utils/fileTree'

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
  const [files, setFiles] = useState([])
  const [archivedFiles, setArchivedFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [editingVariantGroup, setEditingVariantGroup] = useState(null)
  const [loading, setLoading] = useState(true)
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

  // One recursive, archive-splitting call replaces the two flat listDir
  // calls. Each rel path IS the index key, so name lookups need no prefix.
  const loadFiles = useCallback(async (library) => {
    if (!library) {
      setFiles([])
      setArchivedFiles([])
      return
    }
    const { dir, active, archived } = await window.electronAPI.listSection(library, VARIANTS_SUBDIR)
    setFiles(active.map((rel) => toSectionFile(dir, rel, false)))
    setArchivedFiles(archived.map((rel) => toSectionFile(dir, rel, true)))
  }, [])

  useEffect(() => {
    if (!activeLibrary) {
      setFiles([])
      setArchivedFiles([])
      setSelectedFile(null)
      setEditingVariantGroup(null)
      setLoading(false)
      return
    }
    setLoading(true)
    loadFiles(activeLibrary).finally(() => setLoading(false))
  }, [activeLibrary, loadFiles])

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

  const handleSave = async (data, fileName) => {
    try {
      const isRename = !!(selectedFile && fileName !== selectedFile.name)
      // Rename in place: keep the file in whatever subfolder it was filed
      // under. Writing to `<type>/<name>` unconditionally would silently
      // lift it out of e.g. universal/ and back to the type root.
      const subDir = selectedFile ? relDir(selectedFile.rel) : ''
      const newPath =
        isRename || !selectedFile
          ? `${activeLibrary}/${VARIANTS_SUBDIR}/${subDir ? `${subDir}/` : ''}${fileName}`
          : selectedFile.path

      // `rel` rides along: it is the index key the panel looks names up by,
      // and the source of the subfolder on any later rename.
      const newRel = subDir ? `${subDir}/${fileName}` : fileName

      await window.electronAPI.saveVariantGroup(newPath, data)
      setEditingVariantGroup(data) // #6: sync editor to saved data before any selectedFile change

      if (isRename) {
        const result = await window.electronAPI.archiveFile(
          selectedFile.path,
          `${activeLibrary}/${IGNORE_SUBDIR}`
        )
        setSelectedFile({ rel: newRel, name: fileName, path: newPath })
        setSnackbar({
          message: `Renamed. Old file archived as "${result.archivedAs}".`,
          severity: 'success'
        })
      } else if (!selectedFile) {
        setSelectedFile({ rel: newRel, name: fileName, path: newPath }) // #5: associate with file after first save
      }

      markClean()
      if (activeLibrary) {
        await loadFiles(activeLibrary)
        const section = await window.electronAPI.buildIndexSection(activeLibrary, VARIANTS_SUBDIR)
        setLibraryIndex((prev) => ({ ...prev, ...section }))
      }
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
