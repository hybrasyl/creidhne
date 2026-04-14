import React, { useState, useEffect, useCallback } from 'react';
import { useRecoilValue, useRecoilState } from 'recoil';
import {
  Box, Typography, Divider, Button, Tooltip,
  IconButton, Snackbar, Alert, CircularProgress,
} from '@mui/material';
import { activeLibraryState, libraryIndexState } from '../recoil/atoms';
import NationEditor from '../components/nations/NationEditor';
import EditorFileListPanel from '../components/shared/EditorFileListPanel';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';

const NATIONS_SUBDIR = 'nations';
const IGNORE_SUBDIR = 'nations/.ignore';

const DEFAULT_NATION = {
  name: '',
  comment: '',
  description: '',
  flag: '',
  isDefault: false,
  spawnPoints: [],
  territory: null,
};

function NationsPage() {
  const activeLibrary = useRecoilValue(activeLibraryState);
  const [libraryIndex, setLibraryIndex] = useRecoilState(libraryIndexState);
  const namesByFilename = libraryIndex?.nationsNamesByFilename;
  const [files, setFiles] = useState([]);
  const [archivedFiles, setArchivedFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingNation, setEditingNation] = useState(null);
  const [loadingNation, setLoadingNation] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [snackbar, setSnackbar] = useState(null);

  const { markDirty, markClean, saveRef, guard, dialogOpen,
    handleDialogSave, handleDialogDiscard, handleDialogCancel } = useUnsavedGuard('Nation');

  const loadActiveFiles = async (library) => {
    if (!library) { setFiles([]); return; }
    const items = await window.electronAPI.listDir(`${library}/${NATIONS_SUBDIR}`);
    setFiles(items);
  };

  const loadArchivedFiles = async (library) => {
    if (!library) { setArchivedFiles([]); return; }
    const items = await window.electronAPI.listDir(`${library}/${IGNORE_SUBDIR}`);
    setArchivedFiles(items.map((f) => ({ ...f, archived: true })));
  };

  useEffect(() => {
    if (!activeLibrary) { setFiles([]); setArchivedFiles([]); setSelectedFile(null); setEditingNation(null); return; }
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
    setEditingNation({ ...DEFAULT_NATION, spawnPoints: [] });
  };
  const handleNew = () => guard(doNew);

  const doSelect = async (file) => {
    setSelectedFile(file);
    setLoadError(null);
    setEditingNation(null);
    setLoadingNation(true);
    try {
      const nation = await window.electronAPI.loadNation(file.path);
      setEditingNation(nation);
    } catch (err) {
      console.error('Failed to load nation:', err);
      setLoadError(err?.message || 'Failed to parse XML.');
    } finally {
      setLoadingNation(false);
    }
  };
  const handleSelect = (file) => guard(() => doSelect(file));

  const handleSave = async (data, fileName) => {
    try {
      const isRename = !!(selectedFile && fileName !== selectedFile.name);
      const newPath = isRename || !selectedFile
        ? `${activeLibrary}/${NATIONS_SUBDIR}/${fileName}`
        : selectedFile.path;

      await window.electronAPI.saveNation(newPath, data);
      setEditingNation(data);

      if (isRename) {
        const result = await window.electronAPI.archiveFile(
          selectedFile.path,
          `${activeLibrary}/${IGNORE_SUBDIR}`
        );
        setSelectedFile({ name: fileName, path: newPath });
        setSnackbar({ message: `Renamed. Old file archived as "${result.archivedAs}".`, severity: 'success' });
      } else if (!selectedFile) {
        setSelectedFile({ name: fileName, path: newPath });
      }

      markClean();
      await loadActiveFiles(activeLibrary);
      await loadArchivedFiles(activeLibrary);
      if (activeLibrary) {
        const section = await window.electronAPI.buildIndexSection(activeLibrary, NATIONS_SUBDIR);
        setLibraryIndex((prev) => ({ ...prev, ...section }));
      }
    } catch (err) {
      console.error('Failed to save nation:', err);
      setSnackbar({ message: 'Save failed.', severity: 'error' });
    }
  };

  const handleArchive = async () => {
    if (!selectedFile || !activeLibrary) return;
    const result = await window.electronAPI.moveFile(
      selectedFile.path,
      `${activeLibrary}/${IGNORE_SUBDIR}/${selectedFile.name}`
    );
    if (result?.conflict) { setSnackbar({ message: 'An archived nation with this name already exists.', severity: 'error' }); return; }
    markClean();
    setSelectedFile(null); setEditingNation(null);
    await loadActiveFiles(activeLibrary);
    await loadArchivedFiles(activeLibrary);
    const section = await window.electronAPI.buildIndexSection(activeLibrary, NATIONS_SUBDIR);
    setLibraryIndex((prev) => ({ ...prev, ...section }));
  };

  const handleUnarchive = async () => {
    if (!selectedFile || !activeLibrary) return;
    const result = await window.electronAPI.moveFile(
      selectedFile.path,
      `${activeLibrary}/${NATIONS_SUBDIR}/${selectedFile.name}`
    );
    if (result?.conflict) {
      setSnackbar({ message: 'An active nation with this name already exists. Rename the archived nation before unarchiving.', severity: 'error' });
      return;
    }
    markClean();
    setSelectedFile(null); setEditingNation(null);
    await loadActiveFiles(activeLibrary);
    await loadArchivedFiles(activeLibrary);
    const section = await window.electronAPI.buildIndexSection(activeLibrary, NATIONS_SUBDIR);
    setLibraryIndex((prev) => ({ ...prev, ...section }));
  };

  const handleDirtyChange = useCallback((dirty) => { dirty ? markDirty() : markClean(); }, [markDirty, markClean]);

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <EditorFileListPanel
        title="Nations"
        entityLabel="Nation"
        files={files}
        archivedFiles={archivedFiles}
        selectedFile={selectedFile}
        onSelect={handleSelect}
        onNew={handleNew}
        showArchived={showArchived}
        onToggleArchived={handleToggleArchived}
        namesByFilename={namesByFilename}
      />
      <Box sx={{ flex: 1, p: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loadError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>Failed to load nation:</strong> {loadError}
          </Alert>
        ) : loadingNation ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress size={64} thickness={4} color="info" disableShrink/>
          </Box>
        ) : editingNation ? (
          <NationEditor
            nation={editingNation}
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
              Select a nation or create a new one.
            </Typography>
          </Box>
        )}
      </Box>
      <Snackbar open={!!snackbar} autoHideDuration={6000} onClose={() => setSnackbar(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar?.severity ?? 'info'} onClose={() => setSnackbar(null)} sx={{ width: '100%' }}>
          {snackbar?.message}
        </Alert>
      </Snackbar>
      <UnsavedChangesDialog
        open={dialogOpen} label="Nation"
        onSave={handleDialogSave} onDiscard={handleDialogDiscard} onCancel={handleDialogCancel}
      />
    </Box>
  );
}

export default NationsPage;
