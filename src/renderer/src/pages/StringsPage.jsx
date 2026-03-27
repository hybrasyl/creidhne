import React, { useState, useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import {
  Box, List, ListItem, ListItemButton, ListItemText, Typography, Divider,
  Button, Tooltip, TextField, InputAdornment, Snackbar, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { activeLibraryState } from '../recoil/atoms';
import LocalizationEditor from '../components/localizations/LocalizationEditor';

const LOCALIZATIONS_SUBDIR = 'localizations';

const DEFAULT_LOCALIZATION = {
  locale: '',
  common: [],
  merchant: [],
  monsterSpeak: [],
  npcResponses: [],
};

// ── File list panel ───────────────────────────────────────────────────────────
function FileListPanel({ files, selectedFile, onSelect, onNew }) {
  const [search, setSearch] = React.useState('');
  const filtered = search.trim()
    ? files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : files;

  return (
    <Box sx={{ width: 240, flexShrink: 0, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">Localizations</Typography>
        <Tooltip title="New Localization">
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
        {filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {files.length === 0
              ? 'No localizations found. Check that a library is set in Settings.'
              : 'No matches.'}
          </Typography>
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

// ── Page ─────────────────────────────────────────────────────────────────────
function StringsPage() {
  const activeLibrary = useRecoilValue(activeLibraryState);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingLocalization, setEditingLocalization] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [snackbar, setSnackbar] = useState(null);

  const loadFiles = async (library) => {
    if (!library) { setFiles([]); return; }
    const items = await window.electronAPI.listDir(`${library}/${LOCALIZATIONS_SUBDIR}`);
    setFiles(items);
  };

  useEffect(() => {
    if (!activeLibrary) { setFiles([]); setSelectedFile(null); setEditingLocalization(null); return; }
    loadFiles(activeLibrary);
  }, [activeLibrary]);

  const handleNew = () => {
    setSelectedFile(null);
    setLoadError(null);
    setEditingLocalization({ ...DEFAULT_LOCALIZATION, common: [], merchant: [], monsterSpeak: [], npcResponses: [] });
  };

  const handleSelect = async (file) => {
    setSelectedFile(file);
    setLoadError(null);
    try {
      const loc = await window.electronAPI.loadLocalization(file.path);
      setEditingLocalization(loc);
    } catch (err) {
      console.error('Failed to load localization:', err);
      setEditingLocalization(null);
      setLoadError(err?.message || 'Failed to parse XML.');
    }
  };

  const handleSave = async (data, fileName) => {
    try {
      const filePath = selectedFile
        ? selectedFile.path
        : `${activeLibrary}/${LOCALIZATIONS_SUBDIR}/${fileName}`;
      await window.electronAPI.saveLocalization(filePath, data);
      if (!selectedFile && activeLibrary) await loadFiles(activeLibrary);
    } catch (err) {
      console.error('Failed to save localization:', err);
      setSnackbar({ message: `Failed to save: ${err?.message ?? 'Unknown error'}`, severity: 'error' });
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <FileListPanel
        files={files} selectedFile={selectedFile}
        onSelect={handleSelect} onNew={handleNew}
      />
      <Box sx={{ flex: 1, p: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loadError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>Failed to load localization:</strong> {loadError}
          </Alert>
        ) : editingLocalization ? (
          <LocalizationEditor
            localization={editingLocalization}
            initialFileName={selectedFile?.name ?? null}
            isExisting={!!selectedFile}
            onSave={handleSave}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body1" color="text.secondary">
              Select a localization or create a new one.
            </Typography>
          </Box>
        )}
      </Box>
      <Snackbar open={!!snackbar} autoHideDuration={6000} onClose={() => setSnackbar(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar?.severity ?? 'info'} onClose={() => setSnackbar(null)} sx={{ width: '100%' }}>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default StringsPage;
