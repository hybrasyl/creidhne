import React, { useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { useRecoilState } from 'recoil';
import { themeState, librariesState, currentPageState, activeLibraryState } from './recoil/atoms'; // Import Recoil atoms
import lightTheme from './themes/light';
import darkTheme from './themes/dark';
import MainLayout from './components/MainLayout';
import PageRenderer from './components/PageRenderer';

function App() {
  const [theme, setTheme] = useRecoilState(themeState);
  const [libraries, setLibraries] = useRecoilState(librariesState);
  const [currentPage, setCurrentPage] = useRecoilState(currentPageState); // Manage current page with Recoil
  const [activeLibrary, setActiveLibrary] = useRecoilState(activeLibraryState);

  // Load settings on mount
  useEffect(() => {
    async function fetchSettings() {
      const settings = await window.electronAPI.loadSettings(); // Use IPC call to load settings
      setTheme(settings.theme === 'dark' ? 'dark' : 'light');
      setLibraries(settings.libraries || []);
      setActiveLibrary(settings.activeLibrary || null);
    }

    fetchSettings();
  }, [setTheme, setLibraries, setActiveLibrary]);

  // Save settings whenever theme or libraries change
  useEffect(() => {
    window.electronAPI.saveSettings({
      libraries,
      activeLibrary, // Save the active library
      theme,
    });
  }, [theme, libraries, activeLibrary]);

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
    <ThemeProvider theme={theme === 'dark' ? darkTheme : lightTheme}>
      <CssBaseline />
      <MainLayout navigate={setCurrentPage}> {/* Use setCurrentPage from Recoil */}
        <PageRenderer
          libraries={libraries}
          onAddLibrary={handleAddLibrary}
          onRemoveLibrary={handleRemoveLibrary}
        />
      </MainLayout>
    </ThemeProvider>
  );
}

export default App;
