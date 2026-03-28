import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// Custom APIs for renderer
const api = {};

// Expose Electron APIs to the renderer process
contextBridge.exposeInMainWorld('electron', electronAPI);
contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  openDirectory: () => ipcRenderer.invoke('open-directory'),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  listDir: (dirPath) => ipcRenderer.invoke('fs:listDir', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  loadItem: (filePath) => ipcRenderer.invoke('xml:loadItem', filePath),
  saveItem: (filePath, itemData) => ipcRenderer.invoke('xml:saveItem', filePath, itemData),
  loadRecipe: (filePath) => ipcRenderer.invoke('xml:loadRecipe', filePath),
  saveRecipe: (filePath, recipeData) => ipcRenderer.invoke('xml:saveRecipe', filePath, recipeData),
  loadNpc: (filePath) => ipcRenderer.invoke('xml:loadNpc', filePath),
  saveNpc: (filePath, npcData) => ipcRenderer.invoke('xml:saveNpc', filePath, npcData),
  loadNation: (filePath) => ipcRenderer.invoke('xml:loadNation', filePath),
  saveNation: (filePath, nationData) => ipcRenderer.invoke('xml:saveNation', filePath, nationData),
  loadLoot: (filePath) => ipcRenderer.invoke('xml:loadLoot', filePath),
  saveLoot: (filePath, lootData) => ipcRenderer.invoke('xml:saveLoot', filePath, lootData),
  loadVariantGroup: (filePath) => ipcRenderer.invoke('xml:loadVariantGroup', filePath),
  saveVariantGroup: (filePath, variantGroupData) => ipcRenderer.invoke('xml:saveVariantGroup', filePath, variantGroupData),
  loadLocalization: (filePath) => ipcRenderer.invoke('xml:loadLocalization', filePath),
  saveLocalization: (filePath, localizationData) => ipcRenderer.invoke('xml:saveLocalization', filePath, localizationData),
  loadCreature: (filePath) => ipcRenderer.invoke('xml:loadCreature', filePath),
  saveCreature: (filePath, creatureData) => ipcRenderer.invoke('xml:saveCreature', filePath, creatureData),
  loadElementTable: (filePath) => ipcRenderer.invoke('xml:loadElementTable', filePath),
  saveElementTable: (filePath, tableData) => ipcRenderer.invoke('xml:saveElementTable', filePath, tableData),
  loadStatus: (filePath) => ipcRenderer.invoke('xml:loadStatus', filePath),
  saveStatus: (filePath, statusData) => ipcRenderer.invoke('xml:saveStatus', filePath, statusData),
  loadCastable: (filePath) => ipcRenderer.invoke('xml:loadCastable', filePath),
  saveCastable: (filePath, castableData) => ipcRenderer.invoke('xml:saveCastable', filePath, castableData),
  loadBehaviorSet: (filePath) => ipcRenderer.invoke('xml:loadBehaviorSet', filePath),
  saveBehaviorSet: (filePath, bvsData) => ipcRenderer.invoke('xml:saveBehaviorSet', filePath, bvsData),
  loadSpawngroup: (filePath) => ipcRenderer.invoke('xml:loadSpawngroup', filePath),
  saveSpawngroup: (filePath, sgData) => ipcRenderer.invoke('xml:saveSpawngroup', filePath, sgData),
  moveFile: (src, dest) => ipcRenderer.invoke('fs:moveFile', src, dest),
  archiveFile: (src, archiveDir) => ipcRenderer.invoke('fs:archiveFile', src, archiveDir),
  buildIndex: (libraryPath) => ipcRenderer.invoke('index:build', libraryPath),
  buildIndexSection: (libraryPath, section) => ipcRenderer.invoke('index:buildSection', libraryPath, section),
  loadIndex: (libraryPath) => ipcRenderer.invoke('index:load', libraryPath),
  getIndexStatus: (libraryPath) => ipcRenderer.invoke('index:status', libraryPath),
  deleteIndex: (libraryPath) => ipcRenderer.invoke('index:delete', libraryPath),
});

// If context isolation is disabled, add to the DOM global directly
if (!process.contextIsolated) {
  window.electron = electronAPI;
  window.api = api;
  window.electronAPI = {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    openDirectory: () => ipcRenderer.invoke('open-directory'),
    loadSettings: () => ipcRenderer.invoke('settings:load'),  // Use IPC to load settings
    saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),  // Use IPC to save settings
    getUserDataPath: () => ipcRenderer.invoke('get-user-data-path')
  };
}
