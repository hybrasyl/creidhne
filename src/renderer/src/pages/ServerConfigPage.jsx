import { useState, useCallback, useMemo } from 'react'
import { Box, Typography, Alert, Snackbar } from '@mui/material'
import {
  useStoreValue,
  useStoreState,
  activeLibraryState,
  libraryIndexState
} from '../store/appStore'
import ServerConfigEditor from '../components/serverconfigs/ServerConfigEditor'
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

const SUBDIR = 'serverconfigs'
const IGNORE_SUBDIR = 'serverconfigs/.ignore'

export const DEFAULT_SERVERCONFIG = {
  name: '',
  locale: 'en_us',
  environment: 'dev',
  elementTable: 'default',
  motd: '',
  worldDataDir: '',
  logging: { singleStreamEnabled: false, jsonOutputEnabled: false, minimumLevel: 'Info', logs: [] },
  dataStore: {
    type: 'redis',
    host: '127.0.0.1',
    port: '',
    database: '',
    username: '',
    password: '',
    hasCredentials: false
  },
  network: {
    lobby: { bindAddress: '127.0.0.1', externalAddress: '', port: '2610' },
    login: { bindAddress: '127.0.0.1', externalAddress: '', port: '2611' },
    world: { bindAddress: '127.0.0.1', externalAddress: '', port: '2612' },
    grpc: null
  },
  apiEndpoints: {
    sentry: '',
    encryptionEndpoint: '',
    validationEndpoint: '',
    telemetryEndpoint: '',
    metricsEndpoint: null
  },
  access: { privileged: '', reserved: '' },
  boards: [],
  time: { ages: [], serverStart: { value: '', defaultAge: '', defaultYear: '' } },
  handlers: {
    death: null,
    chat: null,
    newPlayer: { startMaps: [] }
  },
  plugins: { message: [] },
  clientSettings: [],
  constants: {},
  formulas: {}
}

function ServerConfigPage() {
  const activeLibrary = useStoreValue(activeLibraryState)
  const [libraryIndex, setLibraryIndex] = useStoreState(libraryIndexState)
  const namesByFilename = libraryIndex?.serverconfigsNamesByFilename
  const [selectedFile, setSelectedFile] = useState(null)
  // Where the next save writes: the live tree, or staging while the editor's
  // Staging box is checked (HTOO-453, HTOO-628).
  const [saveStaged, setSaveStaged] = useState(false)
  const [editingConfig, setEditingConfig] = useState(null)
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
  } = useUnsavedGuard('Server Config')

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
      setEditingConfig(null)
    }, [])
  )

  // Save destinations the picker offers: every folder this section already uses,
  // archived ones included — a folder emptied by archiving everything in it is
  // still somewhere you might file a config.
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
    setEditingConfig(DEFAULT_SERVERCONFIG)
  }
  // The panel passes `{ staged }`: true when the list shows only staged files.
  const handleNew = (opts) => guard(() => doNew(opts?.staged === true))

  const doSelect = async (file) => {
    setSelectedFile(file)
    setSaveStaged(file.staged === true)
    setLoadError(null)
    try {
      const cfg = await window.electronAPI.loadServerConfig(file.path)
      setEditingConfig(cfg)
    } catch (err) {
      console.error('Failed to load server config:', err)
      setEditingConfig(null)
      setLoadError(err?.message || 'Failed to parse XML.')
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
      await window.electronAPI.saveServerConfig(newPath, data)
      setEditingConfig(data) // #6: sync editor to saved data before any selectedFile change

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
      console.error('Failed to save server config:', err)
      setSnackbar({ message: `Failed to save: ${err?.message}`, severity: 'error' })
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
    clearEditing: () => setEditingConfig(null),
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
        title="Server Configs"
        entityLabel="Server Config"
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
              <strong>Failed to load server config:</strong> {loadError}
            </Alert>
          ) : editingConfig ? (
            <StagingScope saveStaged={saveStaged} onSaveStagedChange={handleSaveStagedChange}>
              <ServerConfigEditor
                config={editingConfig}
                initialFileName={selectedFile?.name ?? null}
                initialFolder={initialFolder}
                folderOptions={folderChoices}
                isExisting={!!selectedFile}
                isArchived={selectedFile?.archived === true}
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
                Select a config or create a new one.
              </Typography>
            </Box>
          )}
          <MultiSelectOverlay count={selectionCount} />
        </Box>
      </EditorFileListPanel>
      <UnsavedChangesDialog
        open={dialogOpen}
        label="Server Config"
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

export default ServerConfigPage
