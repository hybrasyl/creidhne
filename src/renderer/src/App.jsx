import React, { useEffect, useState, useCallback } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { useRecoilState } from 'recoil';
import { themeState, librariesState, currentPageState, activeLibraryState, libraryIndexState, dirtyEditorState, recentPagesState } from './recoil/atoms'; // Import Recoil atoms
import hybrasylTheme from './themes/hybrasyl';
import chadulTheme from './themes/chadul';
import danaanTheme from './themes/danaan';
import grinnealTheme from './themes/grinneal';

const themes = {
  hybrasyl: hybrasylTheme,
  chadul:   chadulTheme,
  danaan:   danaanTheme,
  grinneal: grinnealTheme,
};
import MainLayout from './components/MainLayout';
import PageRenderer from './components/PageRenderer';
import UnsavedChangesDialog from './components/UnsavedChangesDialog';

function App() {
  const [theme, setTheme] = useRecoilState(themeState);
  const [libraries, setLibraries] = useRecoilState(librariesState);
  const [, setCurrentPage] = useRecoilState(currentPageState); // Manage current page with Recoil
  const [, setRecentPages] = useRecoilState(recentPagesState);
  const [activeLibrary, setActiveLibrary] = useRecoilState(activeLibraryState);
  const [, setLibraryIndex] = useRecoilState(libraryIndexState);
  const [dirtyEditor, setDirtyEditor] = useRecoilState(dirtyEditorState);
  const [pendingNav, setPendingNav] = useState(null);
  const [navDialogOpen, setNavDialogOpen] = useState(false);

  // Load settings on mount
  useEffect(() => {
    async function fetchSettings() {
      const settings = await window.electronAPI.loadSettings(); // Use IPC call to load settings
      setTheme(themes[settings.theme] ? settings.theme : 'hybrasyl');
      setLibraries(settings.libraries || []);
      setActiveLibrary(settings.activeLibrary || null);
    }

    fetchSettings();
  }, [setTheme, setLibraries, setActiveLibrary]);

  // Load persisted index from disk whenever active library changes
  useEffect(() => {
    if (!activeLibrary) { setLibraryIndex({}); return; }
    window.electronAPI.loadIndex(activeLibrary).then((index) => setLibraryIndex(index || {}));
  }, [activeLibrary, setLibraryIndex]);

  // Save settings whenever theme or libraries change
  useEffect(() => {
    window.electronAPI.saveSettings({
      libraries,
      activeLibrary, // Save the active library
      theme,
    });
  }, [theme, libraries, activeLibrary]);

  const pushRecentPage = useCallback((page) => {
    if (page === 'dashboard') return;
    setRecentPages((prev) => {
      const updated = [page, ...prev.filter((p) => p !== page)].slice(0, 5);
      localStorage.setItem('recentPages', JSON.stringify(updated));
      return updated;
    });
  }, [setRecentPages]);

  const handleNavigate = useCallback((page) => {
    if (dirtyEditor) {
      setPendingNav(page);
      setNavDialogOpen(true);
    } else {
      pushRecentPage(page);
      setCurrentPage(page);
    }
  }, [dirtyEditor, setCurrentPage, pushRecentPage]);

  const handleNavSave = useCallback(async () => {
    const page = pendingNav;
    setNavDialogOpen(false);
    setPendingNav(null);
    try {
      await dirtyEditor?.onSave();
      // markClean is called inside the editor's save handler; navigate after
      pushRecentPage(page);
      setCurrentPage(page);
    } catch {
      // save failed — stay on current page
    }
  }, [pendingNav, dirtyEditor, setCurrentPage, pushRecentPage]);

  const handleNavDiscard = useCallback(() => {
    const page = pendingNav;
    setNavDialogOpen(false);
    setPendingNav(null);
    setDirtyEditor(null);
    pushRecentPage(page);
    setCurrentPage(page);
  }, [pendingNav, setCurrentPage, setDirtyEditor, pushRecentPage]);

  const handleNavCancel = useCallback(() => {
    setNavDialogOpen(false);
    setPendingNav(null);
  }, []);

  const handleAddLibrary = async () => {
    const directoryPath = await window.electronAPI.openDirectory(); // Use IPC call to open directory
    if (directoryPath && !libraries.includes(directoryPath)) {
      setLibraries((prevLibraries) => [...prevLibraries, directoryPath]);
    }
  };

  const handleRemoveLibrary = (library) => {
    setLibraries((prevLibraries) => prevLibraries.filter((lib) => lib !== library));
  };

  return (
    <ThemeProvider theme={themes[theme] ?? hybrasylTheme}>
      <CssBaseline />
      <MainLayout navigate={handleNavigate}>
        <PageRenderer
          libraries={libraries}
          onAddLibrary={handleAddLibrary}
          onRemoveLibrary={handleRemoveLibrary}
        />
      </MainLayout>
      <UnsavedChangesDialog
        open={navDialogOpen}
        label={dirtyEditor?.label}
        onSave={handleNavSave}
        onDiscard={handleNavDiscard}
        onCancel={handleNavCancel}
      />
    </ThemeProvider>
  );
}

export default App;
