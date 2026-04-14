import React, { useState, useEffect, useCallback } from 'react';
import { useRecoilValue, useRecoilState } from 'recoil';
import {
  Box, Typography, Divider, Button, Tooltip,
  IconButton, Snackbar, Alert, CircularProgress,
} from '@mui/material';
import { activeLibraryState, libraryIndexState } from '../recoil/atoms';
import CastableEditor from '../components/castables/CastableEditor';
import EditorFileListPanel from '../components/shared/EditorFileListPanel';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';
import { DEFAULT_CASTABLE, derivePrefix, computeCastableFilename } from '../data/castableConstants';

const SUBDIR        = 'castables';
const IGNORE_SUBDIR = 'castables/.ignore';

function makeDefaultCastable() {
  return { ...DEFAULT_CASTABLE };
}

function CastablesPage() {
  const activeLibrary = useRecoilValue(activeLibraryState);
  const [libraryIndex, setLibraryIndex] = useRecoilState(libraryIndexState);
  const namesByFilename = libraryIndex?.castablesNamesByFilename;
  const [files,           setFiles]           = useState([]);
  const [archivedFiles,   setArchivedFiles]   = useState([]);
  const [selectedFile,    setSelectedFile]    = useState(null);
  const [editingCastable, setEditingCastable] = useState(null);
  const [loadingCastable, setLoadingCastable] = useState(false);
  const [showArchived,    setShowArchived]    = useState(false);
  const [loadError,       setLoadError]       = useState(null);
  const [snackbar,        setSnackbar]        = useState(null);

  const { markDirty, markClean, saveRef, guard, dialogOpen,
    handleDialogSave, handleDialogDiscard, handleDialogCancel } = useUnsavedGuard('Castable');

  const loadActiveFiles = async (library) => {
    if (!library) { setFiles([]); return; }
    const items = await window.electronAPI.listDir(`${library}/${SUBDIR}`);
    setFiles(items);
  };

  const loadArchivedFiles = async (library) => {
    if (!library) { setArchivedFiles([]); return; }
    const items = await window.electronAPI.listDir(`${library}/${IGNORE_SUBDIR}`);
    setArchivedFiles(items.map((f) => ({ ...f, archived: true })));
  };

  useEffect(() => {
    if (!activeLibrary) { setFiles([]); setArchivedFiles([]); setSelectedFile(null); setEditingCastable(null); return; }
    loadActiveFiles(activeLibrary);
    loadArchivedFiles(activeLibrary);
  }, [activeLibrary]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleArchived = async () => {
    const next = !showArchived;
    setShowArchived(next);
    if (next && activeLibrary) await loadArchivedFiles(activeLibrary);
  };

  const doNew = () => {
    setSelectedFile(null);
    setLoadError(null);
    setEditingCastable(makeDefaultCastable());
  };
  const handleNew = () => guard(doNew);

  const doSelect = async (file) => {
    setSelectedFile(file);
    setLoadError(null);
    setEditingCastable(null);
    setLoadingCastable(true);
    try {
      let c = await window.electronAPI.loadCastable(file.path);
      // Infer meta override flag from filename for files that predate the meta comment
      if (!c.meta?.isTest && !c.meta?.isGM && !c.meta?.deprecated) {
        const base = file.name.toLowerCase();
        const inferred = base.startsWith('1test') ? { isTest: true, isGM: false, deprecated: false }
          : base.startsWith('3gm')   ? { isTest: false, isGM: true,  deprecated: false }
          : base.startsWith('2arch') ? { isTest: false, isGM: false, deprecated: true  }
          : null;
        if (inferred) c = { ...c, meta: { ...c.meta, ...inferred } };
      }
      setEditingCastable(c);
    } catch (err) {
      console.error('Failed to load castable:', err);
      setLoadError(err?.message || 'Failed to parse XML.');
    } finally {
      setLoadingCastable(false);
    }
  };
  const handleSelect = (file) => guard(() => doSelect(file));

  const handleSave = async (data, fileName) => {
    try {
      const isRename = !!(selectedFile && fileName !== selectedFile.name);
      const newPath  = isRename || !selectedFile
        ? `${activeLibrary}/${SUBDIR}/${fileName}`
        : selectedFile.path;

      await window.electronAPI.saveCastable(newPath, data);

      // Always sync editingCastable to the saved data so the editor's reset
      // useEffect (triggered by selectedFile/initialFileName changes below) resets
      // to the correct content rather than the stale pre-edit version.
      setEditingCastable(data);

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
      if (showArchived) await loadArchivedFiles(activeLibrary);
      if (activeLibrary) {
        const section = await window.electronAPI.buildIndexSection(activeLibrary, SUBDIR);
        setLibraryIndex((prev) => ({ ...prev, ...section }));
      }
    } catch (err) {
      console.error('Failed to save castable:', err);
      setSnackbar({ message: 'Save failed.', severity: 'error' });
    }
  };

  const handleArchive = async () => {
    if (!selectedFile || !activeLibrary) return;
    const result = await window.electronAPI.moveFile(
      selectedFile.path,
      `${activeLibrary}/${IGNORE_SUBDIR}/${selectedFile.name}`
    );
    if (result?.conflict) {
      setSnackbar({ message: 'An archived castable with this name already exists.', severity: 'error' });
      return;
    }
    markClean();
    setSelectedFile(null); setEditingCastable(null);
    await loadActiveFiles(activeLibrary);
    await loadArchivedFiles(activeLibrary);
    const section = await window.electronAPI.buildIndexSection(activeLibrary, SUBDIR);
    setLibraryIndex((prev) => ({ ...prev, ...section }));
  };

  const handleUnarchive = async () => {
    if (!selectedFile || !activeLibrary) return;
    const result = await window.electronAPI.moveFile(
      selectedFile.path,
      `${activeLibrary}/${SUBDIR}/${selectedFile.name}`
    );
    if (result?.conflict) {
      setSnackbar({ message: 'An active castable with this name already exists. Rename before unarchiving.', severity: 'error' });
      return;
    }
    markClean();
    setSelectedFile(null); setEditingCastable(null);
    await loadActiveFiles(activeLibrary);
    await loadArchivedFiles(activeLibrary);
    const section = await window.electronAPI.buildIndexSection(activeLibrary, SUBDIR);
    setLibraryIndex((prev) => ({ ...prev, ...section }));
  };

  const handleDirtyChange = useCallback((dirty) => { dirty ? markDirty() : markClean(); }, [markDirty, markClean]);

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <EditorFileListPanel
        title="Castables"
        entityLabel="Castable"
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
            <strong>Failed to load castable:</strong> {loadError}
          </Alert>
        ) : loadingCastable ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress size={64} thickness={4} color="info" disableShrink/>
          </Box>
        ) : editingCastable ? (
          <CastableEditor
            castable={editingCastable}
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
              Select a castable or create a new one.
            </Typography>
          </Box>
        )}
      </Box>
      <UnsavedChangesDialog
        open={dialogOpen} label="Castable"
        onSave={handleDialogSave} onDiscard={handleDialogDiscard} onCancel={handleDialogCancel}
      />
      <Snackbar
        open={!!snackbar} autoHideDuration={6000} onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar?.severity ?? 'info'} onClose={() => setSnackbar(null)} sx={{ width: '100%' }}>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default CastablesPage;
