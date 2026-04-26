import React, { useState, useEffect, useCallback } from 'react'
import { useRecoilValue, useRecoilState } from 'recoil'
import {
  Box,
  Typography,
  Divider,
  Button,
  Tooltip,
  IconButton,
  Alert,
  Snackbar
} from '@mui/material'
import { activeLibraryState, libraryIndexState } from '../recoil/atoms'
import ServerConfigEditor from '../components/serverconfigs/ServerConfigEditor'
import EditorFileListPanel from '../components/shared/EditorFileListPanel'
import MultiSelectOverlay from '../components/shared/MultiSelectOverlay'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'
import { useBulkFileActions } from '../hooks/useBulkFileActions'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'

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
  const activeLibrary = useRecoilValue(activeLibraryState)
  const [libraryIndex, setLibraryIndex] = useRecoilState(libraryIndexState)
  const namesByFilename = libraryIndex?.serverconfigsNamesByFilename
  const [files, setFiles] = useState([])
  const [archivedFiles, setArchivedFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [editingConfig, setEditingConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
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

  const loadFiles = async (library) => {
    if (!library) {
      setFiles([])
      return
    }
    const items = await window.electronAPI.listDir(`${library}/${SUBDIR}`)
    setFiles(items)
  }

  const loadArchivedFiles = async (library) => {
    if (!library) {
      setArchivedFiles([])
      return
    }
    const items = await window.electronAPI.listDir(`${library}/${IGNORE_SUBDIR}`)
    setArchivedFiles(items.map((f) => ({ ...f, archived: true })))
  }

  useEffect(() => {
    if (!activeLibrary) {
      setFiles([])
      setArchivedFiles([])
      setSelectedFile(null)
      setEditingConfig(null)
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([loadFiles(activeLibrary), loadArchivedFiles(activeLibrary)]).finally(() =>
      setLoading(false)
    )
  }, [activeLibrary])

  const handleToggleArchived = async () => {
    const next = !showArchived
    setShowArchived(next)
    if (next && activeLibrary) await loadArchivedFiles(activeLibrary)
  }

  const doNew = () => {
    setSelectedFile(null)
    setLoadError(null)
    setEditingConfig(DEFAULT_SERVERCONFIG)
  }
  const handleNew = () => guard(doNew)

  const doSelect = async (file) => {
    setSelectedFile(file)
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

  const handleSave = async (data, fileName) => {
    try {
      const isRename = !!(selectedFile && fileName !== selectedFile.name)
      const newPath =
        isRename || !selectedFile ? `${activeLibrary}/${SUBDIR}/${fileName}` : selectedFile.path

      await window.electronAPI.saveServerConfig(newPath, data)
      setEditingConfig(data) // #6: sync editor to saved data before any selectedFile change

      if (isRename) {
        const result = await window.electronAPI.archiveFile(
          selectedFile.path,
          `${activeLibrary}/${IGNORE_SUBDIR}`
        )
        setSelectedFile({ name: fileName, path: newPath })
        setSnackbar({
          message: `Renamed. Old file archived as "${result.archivedAs}".`,
          severity: 'success'
        })
      } else if (!selectedFile) {
        setSelectedFile({ name: fileName, path: newPath }) // #5: associate with file after first save
      }

      markClean()
      if (activeLibrary) await loadFiles(activeLibrary)
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
    handleDuplicate
  } = useBulkFileActions({
    activeLibrary,
    subdir: SUBDIR,
    ignoreSubdir: IGNORE_SUBDIR,
    selectedFile,
    setSelectedFile,
    clearEditing: () => setEditingConfig(null),
    setLibraryIndex,
    loadActiveFiles: loadFiles,
    loadArchivedFiles,
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
        title="Server Configs"
        entityLabel="Server Config"
        files={files}
        archivedFiles={archivedFiles}
        selectedFile={selectedFile}
        onSelect={handleSelect}
        onNew={handleNew}
        showArchived={showArchived}
        onToggleArchived={handleToggleArchived}
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
            <strong>Failed to load server config:</strong> {loadError}
          </Alert>
        ) : editingConfig ? (
          <ServerConfigEditor
            config={editingConfig}
            initialFileName={selectedFile?.name ?? null}
            isExisting={!!selectedFile}
            isArchived={selectedFile?.archived === true}
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
            <Typography variant="body1" sx={{
              color: "text.secondary"
            }}>
              Select a config or create a new one.
            </Typography>
          </Box>
        )}
        <MultiSelectOverlay count={selectionCount} />
      </Box>
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
  );
}

export default ServerConfigPage
