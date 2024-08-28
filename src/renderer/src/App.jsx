import React, { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
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
import { loadSettings, saveSettings } from './helpers/settingsHelper';

function App() {
  const [theme, setTheme] = useState(lightTheme);
  const [libraries, setLibraries] = useState([]);

  // Load settings on mount
  useEffect(() => {
    async function fetchSettings() {
      const settings = await loadSettings();
      setTheme(settings.theme === 'dark' ? darkTheme : lightTheme);
      setLibraries(settings.libraries || []);
    }

    fetchSettings();
  }, []);

  // Save settings whenever theme or libraries change
  useEffect(() => {
    saveSettings({ theme: theme === darkTheme ? 'dark' : 'light', libraries });
  }, [theme, libraries]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === lightTheme ? darkTheme : lightTheme));
  };

  const handleAddLibrary = async () => {
    const directoryPath = await window.electronAPI.openDirectory();
    if (directoryPath && !libraries.includes(directoryPath)) {
      setLibraries(prevLibraries => [...prevLibraries, directoryPath]);
    }
  };

  const handleRemoveLibrary = (library) => {
    setLibraries(prevLibraries => prevLibraries.filter(lib => lib !== library));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <MainLayout onToggleTheme={toggleTheme}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/npcs" element={<NPCsPage />} />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  onToggleTheme={toggleTheme}
                  isDarkMode={theme === darkTheme}
                  libraries={libraries}
                  onAddLibrary={handleAddLibrary}
                  onRemoveLibrary={handleRemoveLibrary}
                />
              }
            />
            <Route path="/elements" element={<ElementsPage />} />
            <Route path="/formulas" element={<FormulasPage />} />
            <Route path="/helpers" element={<HelpersPage />} />
            <Route path="/items" element={<ItemsPage />} />
            <Route path="/loot" element={<LootPage />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/spawngroups" element={<SpawngroupsPage />} />
            <Route path="/statuses" element={<StatusesPage />} />
            <Route path="/strings" element={<StringsPage />} />
            <Route path="/variants" element={<VariantsPage />} />
            <Route path="/behaviors" element={<BehaviorsPage />} />
            <Route path="/castables" element={<CastablesPage />} />
            <Route path="/creatures" element={<CreaturesPage />} />
          </Routes>
        </MainLayout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
