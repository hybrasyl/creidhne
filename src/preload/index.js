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
  closeWindow: () => ipcRenderer.send('close-window')
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
