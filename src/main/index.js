import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname } from 'path'
import { promises as fs } from 'fs'
import { parseItemXml, serializeItemXml } from './itemXml'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import settings from 'electron-settings'

// Determine the path to use based on the operating system
let userDataPath;

if (process.platform === 'win32') {
  userDataPath = join(app.getPath('home'), 'AppData', 'Local', 'Erisco', 'Creidhne');
} else {
  userDataPath = join(app.getPath('appData'), 'Erisco', 'Creidhne');
}

// Set the userData path
app.setPath('userData', userDataPath);

// Get the path to the icon based on the environment
const iconPath = join(
  __dirname,
  process.env.NODE_ENV === 'production' ? '../resources/icon.png' : '../../resources/icon.png'
)

// Configuration for electron-settings
settings.configure({
  atomicSave: true,
  //dir: join(app.getPath('userData'), 'Erisco', 'Creidhne'),
  fileName: 'settings.json',
  numSpaces: 2,
  prettify: true
})

//console.log('Settings directory:', join(app.getPath('appData'), 'Erisco', 'Creidhne'));

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html')).catch((err) => {
      console.error('Failed to load file:', err)
    })
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('minimize-window', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) window.minimize()
  })

  ipcMain.on('maximize-window', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
    }
  })

  ipcMain.on('close-window', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) window.close()
  })
  ipcMain.handle('dialog:openFile', handleFileOpen)
  ipcMain.handle('open-directory', handleDirectoryOpen)

  ipcMain.handle('fs:listDir', async (_, dirPath) => {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      return entries
        .filter((e) => e.isFile() && e.name.endsWith('.xml'))
        .map((e) => ({ name: e.name, path: join(dirPath, e.name) }))
    } catch {
      return []
    }
  })

  ipcMain.handle('fs:readFile', async (_, filePath) => {
    return fs.readFile(filePath, 'utf-8')
  })

  ipcMain.handle('fs:writeFile', async (_, filePath, content) => {
    await fs.writeFile(filePath, content, 'utf-8')
  })

  ipcMain.handle('xml:loadItem', async (_, filePath) => {
    const xml = await fs.readFile(filePath, 'utf-8')
    return parseItemXml(xml)
  })

  ipcMain.handle('xml:saveItem', async (_, filePath, itemData) => {
    const xml = serializeItemXml(itemData)
    await fs.writeFile(filePath, xml, 'utf-8')
  })

  ipcMain.handle('fs:moveFile', async (_, src, dest) => {
    try {
      await fs.access(dest)
      return { conflict: true }
    } catch {
      // dest does not exist, safe to move
    }
    await fs.mkdir(dirname(dest), { recursive: true })
    await fs.rename(src, dest)
    return { success: true }
  })

  // Handling settings load and save
  ipcMain.handle('settings:load', async () => {
    try {
      const libraries = (await settings.get('libraries')) || []
      const activeLibrary = (await settings.get('activeLibrary')) || null
      const theme = (await settings.get('theme')) || 'light' // Add theme handling
      return { libraries, activeLibrary, theme }
    } catch (error) {
      console.error('Failed to load settings:', error)
      return { libraries: [], activeLibrary: null, theme: 'light' }
    }
  })

  ipcMain.handle('settings:save', async (event, data) => {
    try {
      await settings.set('libraries', data.libraries)
      await settings.set('activeLibrary', data.activeLibrary)
      await settings.set('theme', data.theme) // Save theme
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  })

  ipcMain.handle('get-user-data-path', async () => {
    return app.getPath('userData')
  })

  const LIBRARY_INDEX_DIRS = [
    'castables', 'creatures', 'creaturebehaviorsets', 'elementtables', 'items',
    'localizations', 'lootsets', 'maps', 'nations', 'npcs',
    'serverconfigs', 'spawngroups', 'statuses', 'variantgroups', 'worldmaps',
  ]
  const NAME_REGEX = /<Name>([^<]+)<\/Name>/g

  ipcMain.handle('library:buildIndex', async (_, libraryPath) => {
    const result = {}
    for (const type of LIBRARY_INDEX_DIRS) {
      const dirPath = join(libraryPath, type)
      const names = []
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        const xmlFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.xml'))
        for (const file of xmlFiles) {
          const content = await fs.readFile(join(dirPath, file.name), 'utf-8')
          NAME_REGEX.lastIndex = 0
          let match
          while ((match = NAME_REGEX.exec(content)) !== null) {
            const name = match[1].trim()
            if (name && !names.includes(name)) names.push(name)
          }
        }
        names.sort()
      } catch { /* dir may not exist */ }
      result[type] = names
    }
    return result
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// File handling functions
async function handleFileOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog({})
  if (!canceled) {
    return filePaths[0]
  }
}

async function handleDirectoryOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (!canceled) {
    return filePaths[0]
  }
}
