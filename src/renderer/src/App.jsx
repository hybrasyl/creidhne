import React, { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import lightTheme from './themes/light';
import darkTheme from './themes/dark';
import MainLayout from './components/MainLayout';
import DashboardPage from './pages/DashboardPage';
import CastablesPage from './pages/CastablesPage';
import VariantsPage from './pages/VariantsPage';
import StringsPage from './pages/StringsPage';
import StatusesPage from './pages/StatusesPage';
import SpawngroupsPage from './pages/SpawngroupsPage';
import SettingsPage from './pages/SettingsPage';
import RecipesPage from './pages/RecipesPage';
import NPCsPage from './pages/NPCsPage';
import LootPage from './pages/LootPage';
import ItemsPage from './pages/ItemsPage';
import HelpersPage from './pages/HelpersPage';
import FormulasPage from './pages/FormulasPage';
import ElementsPage from './pages/ElementsPage';
import CreaturesPage from './pages/CreaturesPage';
import BehaviorsPage from './pages/BehaviorsPage';

function App() {
  const [theme, setTheme] = useState(lightTheme);
  const [libraries, setLibraries] = useState([]);
  const [currentPage, setCurrentPage] = useState('dashboard'); // State to track the current page

  // Load settings on mount
  useEffect(() => {
    async function fetchSettings() {
      const settings = await window.electronAPI.loadSettings(); // Use IPC call to load settings
      setTheme(settings.theme === 'dark' ? darkTheme : lightTheme);
      setLibraries(settings.libraries || []);
    }

    fetchSettings();
  }, []);

  // Save settings whenever theme or libraries change
  useEffect(() => {
    window.electronAPI.saveSettings({
      libraries,
      activeLibrary: null,
      theme: theme === darkTheme ? 'dark' : 'light',
    });
  }, [theme, libraries]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === lightTheme ? darkTheme : lightTheme));
  };

  const handleAddLibrary = async () => {
    const directoryPath = await window.electronAPI.openDirectory(); // Use IPC call to open directory
    if (directoryPath && !libraries.includes(directoryPath)) {
      setLibraries(prevLibraries => [...prevLibraries, directoryPath]);
    }
  };

  const handleRemoveLibrary = (library) => {
    setLibraries(prevLibraries => prevLibraries.filter(lib => lib !== library));
  };

  // Function to render the correct page based on currentPage state
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'castables':
        return <CastablesPage />;
      case 'variants':
        return <VariantsPage />;
      case 'strings':
        return <StringsPage />;
      case 'statuses':
        return <StatusesPage />;
      case 'spawngroups':
        return <SpawngroupsPage />;
      case 'settings':
        return (
          <SettingsPage
            onToggleTheme={toggleTheme}
            isDarkMode={theme === darkTheme}
            libraries={libraries}
            onAddLibrary={handleAddLibrary}
            onRemoveLibrary={handleRemoveLibrary}
          />
        );
      case 'recipes':
        return <RecipesPage />;
      case 'npcs':
        return <NPCsPage />;
      case 'loot':
        return <LootPage />;
      case 'items':
        return <ItemsPage />;
      case 'helpers':
        return <HelpersPage />;
      case 'formulas':
        return <FormulasPage />;
      case 'elements':
        return <ElementsPage />;
      case 'creatures':
        return <CreaturesPage />;
      case 'behaviors':
        return <BehaviorsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MainLayout onToggleTheme={toggleTheme} navigate={setCurrentPage}>
        {renderPage()}
      </MainLayout>
    </ThemeProvider>
  );
}

export default App;
