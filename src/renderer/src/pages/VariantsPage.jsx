import React, { useState, useEffect, useCallback } from 'react';
import { useRecoilValue, useRecoilState } from 'recoil';
import {
  Box, Typography, Divider, Button, Tooltip,
  IconButton, Snackbar, Alert, CircularProgress,
} from '@mui/material';
import { activeLibraryState, libraryIndexState } from '../recoil/atoms';
import VariantEditor from '../components/variants/VariantEditor';
import EditorFileListPanel from '../components/shared/EditorFileListPanel';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';

const VARIANTS_SUBDIR = 'variantgroups';
const IGNORE_SUBDIR = 'variantgroups/.ignore';

const DEFAULT_VARIANT_GROUP = {
  name: '',
  comment: '',
  variants: [],
};

function VariantsPage() {
  const activeLibrary = useRecoilValue(activeLibraryState);
  const [libraryIndex, setLibraryIndex] = useRecoilState(libraryIndexState);
  const namesByFilename = libraryIndex?.variantgroupsNamesByFilename;
  const [files, setFiles] = useState([]);
  const [archivedFiles, setArchivedFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingVariantGroup, setEditingVariantGroup] = useState(null);
  const [loadingVariantGroup, setLoadingVariantGroup] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [snackbar, setSnackbar] = useState(null);

  const { markDirty, markClean, saveRef, guard, dialogOpen,
    handleDialogSave, handleDialogDiscard, handleDialogCancel } = useUnsavedGuard('Variant Group');

  const loadActiveFiles = async (library) => {
    if (!library) { setFiles([]); return; }
    const items = await window.electronAPI.listDir(`${library}/${VARIANTS_SUBDIR}`);
    setFiles(items);
  };

  const loadArchivedFiles = async (library) => {
    if (!library) { setArchivedFiles([]); return; }
    const items = await window.electronAPI.listDir(`${library}/${IGNORE_SUBDIR}`);
    setArchivedFiles(items.map((f) => ({ ...f, archived: true })));
  };

  useEffect(() => {
    if (!activeLibrary) { setFiles([]); setArchivedFiles([]); setSelectedFile(null); setEditingVariantGroup(null); return; }
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
    setEditingVariantGroup({ ...DEFAULT_VARIANT_GROUP, variants: [] });
  };
  const handleNew = () => guard(doNew);

  const doSelect = async (file) => {
    setSelectedFile(file);
    setLoadError(null);
    setEditingVariantGroup(null);
    setLoadingVariantGroup(true);
    try {
      const vg = await window.electronAPI.loadVariantGroup(file.path);
      setEditingVariantGroup(vg);
    } catch (err) {
      console.error('Failed to load variant group:', err);
      setLoadError(err?.message || 'Failed to parse XML.');
    } finally {
      setLoadingVariantGroup(false);
    }
  };
  const handleSelect = (file) => guard(() => doSelect(file));

  const handleSave = async (data, fileName) => {
    try {
      const isRename = !!(selectedFile && fileName !== selectedFile.name);
      const newPath  = isRename || !selectedFile
        ? `${activeLibrary}/${VARIANTS_SUBDIR}/${fileName}`
        : selectedFile.path;

      await window.electronAPI.saveVariantGroup(newPath, data);
      setEditingVariantGroup(data);  // #6: sync editor to saved data before any selectedFile change

      if (isRename) {
        const result = await window.electronAPI.archiveFile(
          selectedFile.path,
          `${activeLibrary}/${IGNORE_SUBDIR}`
        );
        setSelectedFile({ name: fileName, path: newPath });
        setSnackbar({ message: `Renamed. Old file archived as "${result.archivedAs}".`, severity: 'success' });
      } else if (!selectedFile) {
        setSelectedFile({ name: fileName, path: newPath });  // #5: associate with file after first save
      }

      markClean();
      if (activeLibrary) {
        await loadActiveFiles(activeLibrary);
        const section = await window.electronAPI.buildIndexSection(activeLibrary, VARIANTS_SUBDIR);
        setLibraryIndex((prev) => ({ ...prev, ...section }));
      }
    } catch (err) {
      console.error('Failed to save variant group:', err);
    }
  };

  const handleArchive = async () => {
    if (!selectedFile || !activeLibrary) return;
    const result = await window.electronAPI.moveFile(
      selectedFile.path,
      `${activeLibrary}/${IGNORE_SUBDIR}/${selectedFile.name}`
    );
    if (result?.conflict) {
      setSnackbar({ message: 'An archived variant group with this name already exists.', severity: 'error' });
      return;
    }
    markClean();
    setSelectedFile(null); setEditingVariantGroup(null);
    await loadActiveFiles(activeLibrary);
    await loadArchivedFiles(activeLibrary);
    const section = await window.electronAPI.buildIndexSection(activeLibrary, VARIANTS_SUBDIR);
    setLibraryIndex((prev) => ({ ...prev, ...section }));
  };

  const handleUnarchive = async () => {
    if (!selectedFile || !activeLibrary) return;
    const result = await window.electronAPI.moveFile(
      selectedFile.path,
      `${activeLibrary}/${VARIANTS_SUBDIR}/${selectedFile.name}`
    );
    if (result?.conflict) {
      setSnackbar({ message: 'An active variant group with this name already exists. Rename the archived file before unarchiving.', severity: 'error' });
      return;
    }
    markClean();
    setSelectedFile(null); setEditingVariantGroup(null);
    await loadActiveFiles(activeLibrary);
    await loadArchivedFiles(activeLibrary);
    const section = await window.electronAPI.buildIndexSection(activeLibrary, VARIANTS_SUBDIR);
    setLibraryIndex((prev) => ({ ...prev, ...section }));
  };

  const handleDirtyChange = useCallback((dirty) => { dirty ? markDirty() : markClean(); }, [markDirty, markClean]);

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
        showArchived={showArchived}
        onToggleArchived={handleToggleArchived}
        namesByFilename={namesByFilename}
      />
      <Box sx={{ flex: 1, p: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loadError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>Failed to load variant group:</strong> {loadError}
          </Alert>
        ) : loadingVariantGroup ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress size={64} thickness={4} color="info" disableShrink/>
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body1" color="text.secondary">
              Select a variant group or create a new one.
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
        open={dialogOpen} label="Variant Group"
        onSave={handleDialogSave} onDiscard={handleDialogDiscard} onCancel={handleDialogCancel}
      />
    </Box>
  );
}

export default VariantsPage;
