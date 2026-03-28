import React, { useState, useEffect, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import {
  Box, List, ListItem, ListItemButton, ListItemText, Typography, Divider, Button, Tooltip,
  TextField, InputAdornment, IconButton, Alert, Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { activeLibraryState } from '../recoil/atoms';
import ServerConfigEditor from '../components/serverconfigs/ServerConfigEditor';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';

const SUBDIR = 'serverconfigs';

export const DEFAULT_SERVERCONFIG = {
  name: '',
  locale: 'en_us',
  environment: 'dev',
  elementTable: 'default',
  motd: '',
  worldDataDir: '',
  logging: { singleStreamEnabled: false, jsonOutputEnabled: false, minimumLevel: 'Info', logs: [] },
  dataStore: { type: 'redis', host: '127.0.0.1', port: '', database: '', username: '', password: '', hasCredentials: false },
  network: {
    lobby: { bindAddress: '127.0.0.1', externalAddress: '', port: '2610' },
    login: { bindAddress: '127.0.0.1', externalAddress: '', port: '2611' },
    world: { bindAddress: '127.0.0.1', externalAddress: '', port: '2612' },
    grpc: null,
  },
  apiEndpoints: { sentry: '', encryptionEndpoint: '', validationEndpoint: '', telemetryEndpoint: '', metricsEndpoint: null },
  access: { privileged: '', reserved: '' },
  boards: [],
  time: { ages: [], serverStart: { value: '', defaultAge: '', defaultYear: '' } },
  handlers: {
    death: null,
    chat: null,
    newPlayer: { startMaps: [] },
  },
  plugins: { message: [] },
  clientSettings: [],
  constants: {},
  formulas: {},
};

function FileListPanel({ files, selectedFile, onSelect, onNew }) {
  const [search, setSearch] = React.useState('');
  const filtered = search.trim()
    ? files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : files;

  return (
    <Box sx={{ width: 240, flexShrink: 0, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">Server Configs</Typography>
        <Tooltip title="New Server Config">
          <Button size="small" startIcon={<AddIcon />} onClick={onNew}>New</Button>
        </Tooltip>
      </Box>
      <Box sx={{ px: 1, pb: 1 }}>
        <TextField
          size="small" fullWidth placeholder="Filter..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {files.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No configs found. Check that a library is set in Settings.
          </Typography>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No matches.</Typography>
        ) : (
          <List dense disablePadding>
            {filtered.map((file) => (
              <ListItem key={file.path} disablePadding>
                <ListItemButton selected={selectedFile?.path === file.path} onClick={() => onSelect(file)}>
                  <ListItemText
                    primary={file.name.replace(/\.xml$/i, '')}
                    primaryTypographyProps={{ noWrap: true, variant: 'body2' }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}

function ServerConfigPage() {
  const activeLibrary = useRecoilValue(activeLibraryState);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingConfig, setEditingConfig] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [snackbar, setSnackbar] = useState(null);

  const { markDirty, markClean, saveRef, guard, dialogOpen,
    handleDialogSave, handleDialogDiscard, handleDialogCancel } = useUnsavedGuard('Server Config');

  const loadFiles = async (library) => {
    if (!library) { setFiles([]); return; }
    const items = await window.electronAPI.listDir(`${library}/${SUBDIR}`);
    setFiles(items);
  };

  useEffect(() => {
    if (!activeLibrary) { setFiles([]); setSelectedFile(null); setEditingConfig(null); return; }
    loadFiles(activeLibrary);
  }, [activeLibrary]);

  const doNew = () => {
    setSelectedFile(null);
    setLoadError(null);
    setEditingConfig(DEFAULT_SERVERCONFIG);
  };
  const handleNew = () => guard(doNew);

  const doSelect = async (file) => {
    setSelectedFile(file);
    setLoadError(null);
    try {
      const cfg = await window.electronAPI.loadServerConfig(file.path);
      setEditingConfig(cfg);
    } catch (err) {
      console.error('Failed to load server config:', err);
      setEditingConfig(null);
      setLoadError(err?.message || 'Failed to parse XML.');
    }
  };
  const handleSelect = (file) => guard(() => doSelect(file));

  const handleSave = async (data, fileName) => {
    try {
      const filePath = selectedFile
        ? selectedFile.path
        : `${activeLibrary}/${SUBDIR}/${fileName}`;
      await window.electronAPI.saveServerConfig(filePath, data);
      markClean();
      if (!selectedFile && activeLibrary) await loadFiles(activeLibrary);
    } catch (err) {
      console.error('Failed to save server config:', err);
      setSnackbar({ message: `Failed to save: ${err?.message}`, severity: 'error' });
    }
  };

  const handleDirtyChange = useCallback((dirty) => { dirty ? markDirty() : markClean(); }, [markDirty, markClean]);

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <FileListPanel
        files={files} selectedFile={selectedFile}
        onSelect={handleSelect} onNew={handleNew}
      />
      <Box sx={{ flex: 1, p: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loadError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>Failed to load server config:</strong> {loadError}
          </Alert>
        ) : editingConfig ? (
          <ServerConfigEditor
            config={editingConfig}
            initialFileName={selectedFile?.name ?? null}
            isExisting={!!selectedFile}
            onSave={handleSave}
            onDirtyChange={handleDirtyChange}
            saveRef={saveRef}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body1" color="text.secondary">
              Select a config or create a new one.
            </Typography>
          </Box>
        )}
      </Box>
      <UnsavedChangesDialog
        open={dialogOpen} label="Server Config"
        onSave={handleDialogSave} onDiscard={handleDialogDiscard} onCancel={handleDialogCancel}
      />
      <Snackbar open={!!snackbar} autoHideDuration={6000} onClose={() => setSnackbar(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar?.severity ?? 'info'} onClose={() => setSnackbar(null)} sx={{ width: '100%' }}>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ServerConfigPage;
