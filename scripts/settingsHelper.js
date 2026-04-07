import settings from 'electron-settings';

// Load settings from the configuration file
export async function loadSettings() {
  try {
    const libraries = await settings.get('libraries') || [];
    const activeLibrary = await settings.get('activeLibrary') || null;
    const theme = await settings.get('theme') || 'light'; // Load theme setting
    return { libraries, activeLibrary, theme };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return { libraries: [], activeLibrary: null, theme: 'light' };
  }
}

// Save settings to the configuration file
export async function saveSettings(libraries, activeLibrary, theme) {
  try {
    await settings.set('libraries', libraries);
    await settings.set('activeLibrary', activeLibrary);
    await settings.set('theme', theme); // Save theme setting
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}
