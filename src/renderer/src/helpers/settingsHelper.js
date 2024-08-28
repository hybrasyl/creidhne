import settings from 'electron-settings';

// Load settings from the configuration file
export async function loadSettings() {
  try {
    const libraries = await settings.get('libraries') || [];
    const activeLibrary = await settings.get('activeLibrary') || null;
    return { libraries, activeLibrary };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return { libraries: [], activeLibrary: null };
  }
}

// Save settings to the configuration file
export async function saveSettings(libraries, activeLibrary) {
  try {
    await settings.set('libraries', libraries);
    await settings.set('activeLibrary', activeLibrary);
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}
