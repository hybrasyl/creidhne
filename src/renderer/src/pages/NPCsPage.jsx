import React, { useState, useEffect, useCallback } from 'react';
import { useRecoilValue, useRecoilState } from 'recoil';
import {
  Box, List, ListItem, ListItemButton, ListItemText, Typography, Divider, Button, Tooltip,
  TextField, InputAdornment, IconButton, Snackbar, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ArchiveIcon from '@mui/icons-material/Archive';
import { activeLibraryState, libraryIndexState } from '../recoil/atoms';
import NPCEditor from '../components/npcs/NPCEditor';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';

const NPCS_SUBDIR = 'npcs';
const IGNORE_SUBDIR = 'npcs/.ignore';

const DEFAULT_NPC = {
  name: '',
  displayName: '',
  comment: '',
  sprite: '',
  portrait: '',
  allowDead: false,
  responses: [],
  strings: [],
  roles: {
    bankCheck: '',
    repairCheck: '',
    postCheck: '',
    vendCheck: '',
    trainCheck: '',
    bank: null,
    post: null,
    repair: null,
    vend: null,
    train: null,
  },
};

function FileListPanel({ files, archivedFiles, selectedFile, onSelect, onNew, showArchived, onToggleArchived }) {
  const [search, setSearch] = React.useState('');
  const filtered = (list) =>
    search.trim() ? list.filter((f) => f.name.toLowerCase().includes(search.toLowerCase())) : list;

  const filteredActive = filtered(files);
  const filteredArchived = filtered(archivedFiles);

  return (
    <Box sx={{ width: 240, flexShrink: 0, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">NPCs</Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={showArchived ? 'Hide Archived' : 'Show Archived'}>
            <IconButton size="small" onClick={onToggleArchived} color={showArchived ? 'primary' : 'default'}>
              <ArchiveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="New NPC">
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
            No NPCs found. Check that a library is set in Settings.
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

function NPCsPage() {
  const activeLibrary = useRecoilValue(activeLibraryState);
  const [, setLibraryIndex] = useRecoilState(libraryIndexState);
  const [files, setFiles] = useState([]);
  const [archivedFiles, setArchivedFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingNpc, setEditingNpc] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [snackbar, setSnackbar] = useState(null);

  const { markDirty, markClean, saveRef, guard, dialogOpen,
    handleDialogSave, handleDialogDiscard, handleDialogCancel } = useUnsavedGuard('NPC');

  const loadActiveFiles = async (library) => {
    if (!library) { setFiles([]); return; }
    const items = await window.electronAPI.listDir(`${library}/${NPCS_SUBDIR}`);
    setFiles(items);
  };

  const loadArchivedFiles = async (library) => {
    if (!library) { setArchivedFiles([]); return; }
    const items = await window.electronAPI.listDir(`${library}/${IGNORE_SUBDIR}`);
    setArchivedFiles(items.map((f) => ({ ...f, archived: true })));
  };

  useEffect(() => {
    if (!activeLibrary) { setFiles([]); setArchivedFiles([]); setSelectedFile(null); setEditingNpc(null); return; }
    loadActiveFiles(activeLibrary);
    if (showArchived) loadArchivedFiles(activeLibrary);
  }, [activeLibrary]);

  const handleToggleArchived = async () => {
    const next = !showArchived;
    setShowArchived(next);
    if (next && activeLibrary) await loadArchivedFiles(activeLibrary);
  };

  const doNew = () => {
    setSelectedFile(null);
    setLoadError(null);
    setEditingNpc({ ...DEFAULT_NPC, roles: { ...DEFAULT_NPC.roles } });
  };
  const handleNew = () => guard(doNew);

  const doSelect = async (file) => {
    setSelectedFile(file);
    setLoadError(null);
    try {
      const npc = await window.electronAPI.loadNpc(file.path);
      setEditingNpc(npc);
    } catch (err) {
      console.error('Failed to load NPC:', err);
      setEditingNpc(null);
      setLoadError(err?.message || 'Failed to parse XML.');
    }
  };
  const handleSelect = (file) => guard(() => doSelect(file));

  const handleSave = async (data, fileName) => {
    try {
      const filePath = selectedFile
        ? selectedFile.path
        : `${activeLibrary}/${NPCS_SUBDIR}/${fileName}`;
      await window.electronAPI.saveNpc(filePath, data);
      markClean();
      if (!selectedFile && activeLibrary) await loadActiveFiles(activeLibrary);
      if (activeLibrary) {
        const section = await window.electronAPI.buildIndexSection(activeLibrary, NPCS_SUBDIR);
        setLibraryIndex((prev) => ({ ...prev, ...section }));
      }
    } catch (err) {
      console.error('Failed to save NPC:', err);
    }
  };

  const handleArchive = async () => {
    if (!selectedFile || !activeLibrary) return;
    const result = await window.electronAPI.moveFile(
      selectedFile.path,
      `${activeLibrary}/${IGNORE_SUBDIR}/${selectedFile.name}`
    );
    if (result?.conflict) { setSnackbar({ message: 'An archived NPC with this name already exists.', severity: 'error' }); return; }
    markClean();
    setSelectedFile(null); setEditingNpc(null);
    await loadActiveFiles(activeLibrary);
    if (showArchived) await loadArchivedFiles(activeLibrary);
  };

  const handleUnarchive = async () => {
    if (!selectedFile || !activeLibrary) return;
    const result = await window.electronAPI.moveFile(
      selectedFile.path,
      `${activeLibrary}/${NPCS_SUBDIR}/${selectedFile.name}`
    );
    if (result?.conflict) {
      setSnackbar({ message: 'An active NPC with this name already exists. Rename the archived NPC before unarchiving.', severity: 'error' });
      return;
    }
    markClean();
    setSelectedFile(null); setEditingNpc(null);
    await loadActiveFiles(activeLibrary);
    await loadArchivedFiles(activeLibrary);
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
            <strong>Failed to load NPC:</strong> {loadError}
          </Alert>
        ) : editingNpc ? (
          <NPCEditor
            npc={editingNpc}
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
              Select an NPC or create a new one.
            </Typography>
          </Box>
        )}
      </Box>
      <UnsavedChangesDialog
        open={dialogOpen} label="NPC"
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

export default NPCsPage;
