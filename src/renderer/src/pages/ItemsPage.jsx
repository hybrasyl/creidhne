import React, { useState, useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import {
  Box, List, ListItem, ListItemButton, ListItemText, Typography, Divider, Button, Tooltip,
  TextField, InputAdornment, IconButton, Snackbar, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ArchiveIcon from '@mui/icons-material/Archive';
import { activeLibraryState } from '../recoil/atoms';
import ItemEditor from '../components/items/ItemEditor';
import { DEFAULT_ITEM } from '../data/itemConstants';
import { validateItem } from '../data/itemValidation';

const ITEMS_SUBDIR = 'items';
const IGNORE_SUBDIR = 'items/.ignore';

function FileListPanel({ files, archivedFiles, selectedFile, onSelect, onNew, showArchived, onToggleArchived }) {
  const [search, setSearch] = React.useState('');

  const filtered = (list) =>
    search.trim()
      ? list.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
      : list;

  const filteredActive = filtered(files);
  const filteredArchived = filtered(archivedFiles);

  return (
    <Box
      sx={{
        width: 240,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">Items</Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={showArchived ? 'Hide Archived' : 'Show Archived'}>
            <IconButton size="small" onClick={onToggleArchived} color={showArchived ? 'primary' : 'default'}>
              <ArchiveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="New Item">
            <Button size="small" startIcon={<AddIcon />} onClick={onNew}>
              New
            </Button>
          </Tooltip>
        </Box>
      </Box>
      <Box sx={{ px: 1, pb: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Filter..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {files.length === 0 && !showArchived ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No items found. Check that a library is set in Settings.
          </Typography>
        ) : filteredActive.length === 0 && (!showArchived || filteredArchived.length === 0) ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No matches.
          </Typography>
        ) : (
          <>
            <List dense disablePadding>
              {filteredActive.map((file) => (
                <ListItem key={file.path} disablePadding>
                  <ListItemButton
                    selected={selectedFile?.path === file.path}
                    onClick={() => onSelect(file)}
                  >
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
                      <ListItemButton
                        selected={selectedFile?.path === file.path}
                        onClick={() => onSelect(file)}
                      >
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

function ItemsPage() {
  const activeLibrary = useRecoilValue(activeLibraryState);
  const [files, setFiles] = useState([]);
  const [archivedFiles, setArchivedFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [editWarnings, setEditWarnings] = useState([]);
  const [snackbar, setSnackbar] = useState(null); // { message, severity }

  const loadActiveFiles = async (library) => {
    if (!library) { setFiles([]); return; }
    const items = await window.electronAPI.listDir(`${library}/${ITEMS_SUBDIR}`);
    setFiles(items);
  };

  const loadArchivedFiles = async (library) => {
    if (!library) { setArchivedFiles([]); return; }
    const items = await window.electronAPI.listDir(`${library}/${IGNORE_SUBDIR}`);
    setArchivedFiles(items.map((f) => ({ ...f, archived: true })));
  };

  useEffect(() => {
    if (!activeLibrary) {
      setFiles([]);
      setArchivedFiles([]);
      setSelectedFile(null);
      setEditingItem(null);
      return;
    }
    loadActiveFiles(activeLibrary);
    if (showArchived) loadArchivedFiles(activeLibrary);
  }, [activeLibrary]);

  const handleToggleArchived = async () => {
    const next = !showArchived;
    setShowArchived(next);
    if (next && activeLibrary) await loadArchivedFiles(activeLibrary);
  };

  const handleNew = () => {
    setSelectedFile(null);
    setLoadError(null);
    setEditWarnings([]);
    setEditingItem(JSON.parse(JSON.stringify(DEFAULT_ITEM)));
  };

  const handleSelect = async (file) => {
    setSelectedFile(file);
    setLoadError(null);
    setEditWarnings([]);
    try {
      const item = await window.electronAPI.loadItem(file.path);
      setEditingItem(item);
      setEditWarnings(validateItem(item));
    } catch (err) {
      console.error('Failed to load item:', err);
      setEditingItem(null);
      setLoadError(err?.message || 'Failed to parse XML.');
    }
  };

  const handleSave = async (data, fileName) => {
    try {
      const filePath = selectedFile
        ? selectedFile.path
        : `${activeLibrary}/${ITEMS_SUBDIR}/${fileName}`;
      await window.electronAPI.saveItem(filePath, data);
      if (!selectedFile && activeLibrary) {
        await loadActiveFiles(activeLibrary);
      }
    } catch (err) {
      console.error('Failed to save item:', err);
    }
  };

  const handleArchive = async () => {
    if (!selectedFile || !activeLibrary) return;
    const src = selectedFile.path;
    const dest = `${activeLibrary}/${IGNORE_SUBDIR}/${selectedFile.name}`;
    const result = await window.electronAPI.moveFile(src, dest);
    if (result?.conflict) {
      setSnackbar({ message: 'An archived item with this name already exists.', severity: 'error' });
      return;
    }
    setSelectedFile(null);
    setEditingItem(null);
    await loadActiveFiles(activeLibrary);
    if (showArchived) await loadArchivedFiles(activeLibrary);
  };

  const handleUnarchive = async () => {
    if (!selectedFile || !activeLibrary) return;
    const src = selectedFile.path;
    const dest = `${activeLibrary}/${ITEMS_SUBDIR}/${selectedFile.name}`;
    const result = await window.electronAPI.moveFile(src, dest);
    if (result?.conflict) {
      setSnackbar({
        message: 'An active item with this name already exists. Rename the archived item before unarchiving.',
        severity: 'error',
      });
      return;
    }
    setSelectedFile(null);
    setEditingItem(null);
    await loadActiveFiles(activeLibrary);
    await loadArchivedFiles(activeLibrary);
  };

  const isArchived = selectedFile?.archived === true;

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <FileListPanel
        files={files}
        archivedFiles={archivedFiles}
        selectedFile={selectedFile}
        onSelect={handleSelect}
        onNew={handleNew}
        showArchived={showArchived}
        onToggleArchived={handleToggleArchived}
      />

      <Box sx={{ flex: 1, p: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loadError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>Failed to load item:</strong> {loadError}
          </Alert>
        ) : editingItem ? (
          <ItemEditor
            item={editingItem}
            initialFileName={selectedFile?.name ?? null}
            isArchived={isArchived}
            isExisting={!!selectedFile}
            warnings={editWarnings}
            onSave={handleSave}
            onArchive={handleArchive}
            onUnarchive={handleUnarchive}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body1" color="text.secondary">
              Select an item or create a new one.
            </Typography>
          </Box>
        )}
      </Box>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={6000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar?.severity ?? 'info'} onClose={() => setSnackbar(null)} sx={{ width: '100%' }}>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ItemsPage;
