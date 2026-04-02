import React, { useState, useEffect, useCallback } from 'react';
import { useRecoilValue, useRecoilState } from 'recoil';
import {
  Box, List, ListItem, ListItemButton, ListItemText, Typography, Divider,
  Button, Tooltip, TextField, InputAdornment, IconButton, Snackbar, Alert, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ArchiveIcon from '@mui/icons-material/Archive';
import { activeLibraryState, libraryIndexState } from '../recoil/atoms';
import LocalizationEditor from '../components/localizations/LocalizationEditor';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';

const LOCALIZATIONS_SUBDIR = 'localizations';
const IGNORE_SUBDIR = 'localizations/.ignore';

const DEFAULT_LOCALIZATION = {
  locale: '',
  comment: '',
  common: [],
  merchant: [],
  npcSpeak: [],
  monsterSpeak: [],
  npcResponses: [],
};

// ── File list panel ───────────────────────────────────────────────────────────
function FileListPanel({ files, archivedFiles, selectedFile, onSelect, onNew, showArchived, onToggleArchived }) {
  const [search, setSearch] = React.useState('');
  const filtered = (list) =>
    search.trim() ? list.filter((f) => f.name.toLowerCase().includes(search.toLowerCase())) : list;

  const filteredActive = filtered(files);
  const filteredArchived = filtered(archivedFiles);

  return (
    <Box sx={{ width: 240, flexShrink: 0, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">Localizations</Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={showArchived ? 'Hide Archived' : 'Show Archived'}>
            <IconButton size="small" onClick={onToggleArchived} color={showArchived ? 'primary' : 'default'}>
              <ArchiveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="New Localization">
            <Button size="small" startIcon={<AddIcon />} onClick={onNew}>New</Button>
          </Tooltip>
        </Box>
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
        {files.length === 0 && !showArchived ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No localizations found. Check that a library is set in Settings.
          </Typography>
        ) : filteredActive.length === 0 && (!showArchived || filteredArchived.length === 0) ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No matches.</Typography>
        ) : (
          <>
            <List dense disablePadding>
              {filteredActive.map((file) => (
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
            {showArchived && filteredArchived.length > 0 && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, py: 0.5, display: 'block' }}>
                  Archived
                </Typography>
                <List dense disablePadding>
                  {filteredArchived.map((file) => (
                    <ListItem key={file.path} disablePadding>
                      <ListItemButton selected={selectedFile?.path === file.path} onClick={() => onSelect(file)}>
                        <ListItemText
                          primary={file.name.replace(/\.xml$/i, '')}
                          primaryTypographyProps={{ noWrap: true, variant: 'body2', color: 'text.secondary' }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
function StringsPage() {
  const activeLibrary = useRecoilValue(activeLibraryState);
  const [, setLibraryIndex] = useRecoilState(libraryIndexState);
  const [files, setFiles] = useState([]);
  const [archivedFiles, setArchivedFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingLocalization, setEditingLocalization] = useState(null);
  const [loadingLocalization, setLoadingLocalization] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [snackbar, setSnackbar] = useState(null);

  const { markDirty, markClean, saveRef, guard, dialogOpen,
    handleDialogSave, handleDialogDiscard, handleDialogCancel } = useUnsavedGuard('Localization');

  const loadActiveFiles = async (library) => {
    if (!library) { setFiles([]); return; }
    const items = await window.electronAPI.listDir(`${library}/${LOCALIZATIONS_SUBDIR}`);
    setFiles(items);
  };

  const loadArchivedFiles = async (library) => {
    if (!library) { setArchivedFiles([]); return; }
    const items = await window.electronAPI.listDir(`${library}/${IGNORE_SUBDIR}`);
    setArchivedFiles(items.map((f) => ({ ...f, archived: true })));
  };

  useEffect(() => {
    if (!activeLibrary) { setFiles([]); setArchivedFiles([]); setSelectedFile(null); setEditingLocalization(null); return; }
    loadActiveFiles(activeLibrary);
    loadArchivedFiles(activeLibrary);
  }, [activeLibrary]);

  const handleToggleArchived = async () => {
    const next = !showArchived;
    setShowArchived(next);
    if (next && activeLibrary) await loadArchivedFiles(activeLibrary);
  };

  const doNew = () => {
    setSelectedFile(null);
    setLoadError(null);
    setEditingLocalization({ ...DEFAULT_LOCALIZATION });
  };
  const handleNew = () => guard(doNew);

  const doSelect = async (file) => {
    setSelectedFile(file);
    setLoadError(null);
    setEditingLocalization(null);
    setLoadingLocalization(true);
    try {
      const loc = await window.electronAPI.loadLocalization(file.path);
      setEditingLocalization(loc);
    } catch (err) {
      console.error('Failed to load localization:', err);
      setLoadError(err?.message || 'Failed to parse XML.');
    } finally {
      setLoadingLocalization(false);
    }
  };
  const handleSelect = (file) => guard(() => doSelect(file));

  const handleSave = async (data, fileName) => {
    try {
      const isRename = !!(selectedFile && fileName !== selectedFile.name);
      const newPath = isRename || !selectedFile
        ? `${activeLibrary}/${LOCALIZATIONS_SUBDIR}/${fileName}`
        : selectedFile.path;

      await window.electronAPI.saveLocalization(newPath, data);
      setEditingLocalization(data);
      markClean();

      if (isRename) {
        const result = await window.electronAPI.archiveFile(
          selectedFile.path,
          `${activeLibrary}/${IGNORE_SUBDIR}`
        );
        setSelectedFile({ name: fileName, path: newPath });
        await loadActiveFiles(activeLibrary);
        await loadArchivedFiles(activeLibrary);
        setSnackbar({ message: `Renamed. Old file archived as "${result.archivedAs}".`, severity: 'success' });
      } else if (!selectedFile) {
        setSelectedFile({ name: fileName, path: newPath });
        await loadActiveFiles(activeLibrary);
      }

      if (activeLibrary) {
        const section = await window.electronAPI.buildIndexSection(activeLibrary, LOCALIZATIONS_SUBDIR);
        setLibraryIndex((prev) => ({ ...prev, ...section }));
      }
    } catch (err) {
      console.error('Failed to save localization:', err);
      setSnackbar({ message: `Failed to save: ${err?.message ?? 'Unknown error'}`, severity: 'error' });
    }
  };

  const handleArchive = async () => {
    if (!selectedFile || !activeLibrary) return;
    const result = await window.electronAPI.moveFile(
      selectedFile.path,
      `${activeLibrary}/${IGNORE_SUBDIR}/${selectedFile.name}`
    );
    if (result?.conflict) {
      setSnackbar({ message: 'An archived localization with this name already exists.', severity: 'error' });
      return;
    }
    markClean();
    setSelectedFile(null); setEditingLocalization(null);
    await loadActiveFiles(activeLibrary);
    await loadArchivedFiles(activeLibrary);
    const section = await window.electronAPI.buildIndexSection(activeLibrary, LOCALIZATIONS_SUBDIR);
    setLibraryIndex((prev) => ({ ...prev, ...section }));
  };

  const handleUnarchive = async () => {
    if (!selectedFile || !activeLibrary) return;
    const result = await window.electronAPI.moveFile(
      selectedFile.path,
      `${activeLibrary}/${LOCALIZATIONS_SUBDIR}/${selectedFile.name}`
    );
    if (result?.conflict) {
      setSnackbar({ message: 'An active localization with this name already exists. Rename the archived file before unarchiving.', severity: 'error' });
      return;
    }
    markClean();
    setSelectedFile(null); setEditingLocalization(null);
    await loadActiveFiles(activeLibrary);
    await loadArchivedFiles(activeLibrary);
    const section = await window.electronAPI.buildIndexSection(activeLibrary, LOCALIZATIONS_SUBDIR);
    setLibraryIndex((prev) => ({ ...prev, ...section }));
  };

  const handleDirtyChange = useCallback((dirty) => { dirty ? markDirty() : markClean(); }, [markDirty, markClean]);

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <FileListPanel
        files={files} archivedFiles={archivedFiles} selectedFile={selectedFile}
        onSelect={handleSelect} onNew={handleNew}
        showArchived={showArchived} onToggleArchived={handleToggleArchived}
      />
      <Box sx={{ flex: 1, p: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loadError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>Failed to load localization:</strong> {loadError}
          </Alert>
        ) : loadingLocalization ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress size={64} thickness={4} color="info" disableShrink/>
          </Box>
        ) : editingLocalization ? (
          <LocalizationEditor
            localization={editingLocalization}
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body1" color="text.secondary">
              Select a localization or create a new one.
            </Typography>
          </Box>
        )}
      </Box>
      <UnsavedChangesDialog
        open={dialogOpen} label="Localization"
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

export default StringsPage;
