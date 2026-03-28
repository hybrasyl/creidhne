import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname } from 'path'
import { promises as fs } from 'fs'
import { createHash } from 'crypto'
import { parseItemXml, serializeItemXml } from './itemXml'
import { parseRecipeXml, serializeRecipeXml } from './recipeXml'
import { parseNpcXml, serializeNpcXml } from './npcXml'
import { parseNationXml, serializeNationXml } from './nationXml'
import { parseLootXml, serializeLootXml } from './lootXml'
import { parseVariantXml, serializeVariantXml } from './variantXml'
import { parseLocalizationXml, serializeLocalizationXml } from './localizationXml'
import { parseCreatureXml, serializeCreatureXml } from './creatureXml'
import { parseElementTableXml, serializeElementTableXml } from './elementTableXml'
import { parseStatusXml, serializeStatusXml } from './statusXml'
import { parseCastableXml, serializeCastableXml } from './castableXml'
import { parseBehaviorSetXml, serializeBehaviorSetXml } from './behaviorSetXml'
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
    icon: join(__dirname, '../../resources/icon.png'),
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

  ipcMain.handle('xml:loadRecipe', async (_, filePath) => {
    const xml = await fs.readFile(filePath, 'utf-8')
    return parseRecipeXml(xml)
  })

  ipcMain.handle('xml:saveRecipe', async (_, filePath, recipeData) => {
    const xml = serializeRecipeXml(recipeData)
    await fs.writeFile(filePath, xml, 'utf-8')
  })

  ipcMain.handle('xml:loadNpc', async (_, filePath) => {
    const xml = await fs.readFile(filePath, 'utf-8')
    return parseNpcXml(xml)
  })

  ipcMain.handle('xml:saveNpc', async (_, filePath, npcData) => {
    const xml = serializeNpcXml(npcData)
    await fs.writeFile(filePath, xml, 'utf-8')
  })

  ipcMain.handle('xml:loadNation', async (_, filePath) => {
    const xml = await fs.readFile(filePath, 'utf-8')
    return parseNationXml(xml)
  })

  ipcMain.handle('xml:saveNation', async (_, filePath, nationData) => {
    const xml = serializeNationXml(nationData)
    await fs.writeFile(filePath, xml, 'utf-8')
  })

  ipcMain.handle('xml:loadLoot', async (_, filePath) => {
    const xml = await fs.readFile(filePath, 'utf-8')
    return parseLootXml(xml)
  })

  ipcMain.handle('xml:saveLoot', async (_, filePath, lootData) => {
    const xml = serializeLootXml(lootData)
    await fs.writeFile(filePath, xml, 'utf-8')
  })

  ipcMain.handle('xml:loadVariantGroup', async (_, filePath) => {
    const xml = await fs.readFile(filePath, 'utf-8')
    return parseVariantXml(xml)
  })

  ipcMain.handle('xml:saveVariantGroup', async (_, filePath, variantGroupData) => {
    const xml = serializeVariantXml(variantGroupData)
    await fs.writeFile(filePath, xml, 'utf-8')
  })

  ipcMain.handle('xml:loadLocalization', async (_, filePath) => {
    const xml = await fs.readFile(filePath, 'utf-8')
    return parseLocalizationXml(xml)
  })

  ipcMain.handle('xml:saveLocalization', async (_, filePath, localizationData) => {
    const xml = serializeLocalizationXml(localizationData)
    await fs.writeFile(filePath, xml, 'utf-8')
  })

  ipcMain.handle('xml:loadCreature', async (_, filePath) => {
    const xml = await fs.readFile(filePath, 'utf-8')
    return parseCreatureXml(xml)
  })

  ipcMain.handle('xml:saveCreature', async (_, filePath, creatureData) => {
    const xml = serializeCreatureXml(creatureData)
    await fs.writeFile(filePath, xml, 'utf-8')
  })

  ipcMain.handle('xml:loadElementTable', async (_, filePath) => {
    const xml = await fs.readFile(filePath, 'utf-8')
    return parseElementTableXml(xml)
  })

  ipcMain.handle('xml:saveElementTable', async (_, filePath, tableData) => {
    const xml = serializeElementTableXml(tableData)
    await fs.writeFile(filePath, xml, 'utf-8')
  })

  ipcMain.handle('xml:loadStatus', async (_, filePath) => {
    const xml = await fs.readFile(filePath, 'utf-8')
    return parseStatusXml(xml)
  })

  ipcMain.handle('xml:saveStatus', async (_, filePath, statusData) => {
    const xml = serializeStatusXml(statusData)
    await fs.writeFile(filePath, xml, 'utf-8')
  })

  ipcMain.handle('xml:loadCastable', async (_, filePath) => {
    const xml = await fs.readFile(filePath, 'utf-8')
    return parseCastableXml(xml)
  })

  ipcMain.handle('xml:saveCastable', async (_, filePath, castableData) => {
    const xml = serializeCastableXml(castableData)
    await fs.writeFile(filePath, xml, 'utf-8')
  })

  ipcMain.handle('xml:loadBehaviorSet', async (_, filePath) => {
    const xml = await fs.readFile(filePath, 'utf-8')
    return parseBehaviorSetXml(xml)
  })

  ipcMain.handle('xml:saveBehaviorSet', async (_, filePath, bvsData) => {
    const xml = serializeBehaviorSetXml(bvsData)
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

  ipcMain.handle('fs:archiveFile', async (_, src, archiveDir) => {
    const baseName = src.split(/[\\/]/).pop()
    const ext  = baseName.toLowerCase().endsWith('.xml') ? '.xml' : ''
    const stem = ext ? baseName.slice(0, -ext.length) : baseName
    await fs.mkdir(archiveDir, { recursive: true })
    let dest = join(archiveDir, baseName)
    let counter = 1
    while (true) {
      try {
        await fs.access(dest)
        dest = join(archiveDir, `${stem}_${counter}${ext}`)
        counter++
      } catch {
        break
      }
    }
    await fs.rename(src, dest)
    return { success: true, archivedAs: dest.split(/[\\/]/).pop() }
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

  ipcMain.handle('settings:save', async (_, data) => {
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

  // --- Library index (persistent, per-library) ---

  const INDEX_DIRS = [
    'castables', 'creatures', 'creaturebehaviorsets', 'elementtables', 'items',
    'localizations', 'lootsets', 'maps', 'nations', 'npcs', 'recipes',
    'serverconfigs', 'spawngroups', 'statuses', 'variantgroups', 'worldmaps',
  ]
  // Types that store the identifier as an attribute on the root element.
  // Value is the attribute name to extract. All others use <Name> child element.
  const ATTR_NAME_MAP = {
    statuses:             'Name',
    creatures:            'Name',
    creaturebehaviorsets: 'Name',
    elementtables:        'Name',
    lootsets:             'Name',
    serverconfigs:        'Name',
    spawngroups:          'Name',
    localizations:        'Locale',
  }
  const ELEM_NAME_REGEX = /<Name>([^<]+)<\/Name>/g

  const getIndexDir = () => join(app.getPath('userData'), 'indexes')
  const getIndexPath = (libraryPath) => {
    const hash = createHash('sha256').update(libraryPath).digest('hex').slice(0, 16)
    return join(getIndexDir(), `${hash}.json`)
  }

  async function walkDir(dir, ext, base, results = []) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const e of entries) {
        const full = join(dir, e.name)
        if (e.isDirectory()) await walkDir(full, ext, base, results)
        else if (e.isFile() && e.name.endsWith(ext)) {
          results.push(full.slice(base.length + 1).replace(/\\/g, '/').replace(/\.[^.]+$/, ''))
        }
      }
    } catch { /* dir may not exist */ }
    return results
  }

  ipcMain.handle('index:build', async (_, libraryPath) => {
    const index = { libraryPath, builtAt: new Date().toISOString() }

    for (const type of INDEX_DIRS) {
      const dirPath = join(libraryPath, type)
      const names = []
      const attrName = ATTR_NAME_MAP[type]
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        for (const file of entries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
          const content = await fs.readFile(join(dirPath, file.name), 'utf-8')
          if (type === 'castables') {
            // Extract first <Name> element and root Class attribute per file
            const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
            if (nameMatch) {
              const name = nameMatch[1].trim()
              if (name && !names.includes(name)) {
                names.push(name)
                const classMatch = /<Castable[^>]+Class="([^"]*)"/.exec(content)
                if (classMatch) {
                  if (!index.castableClasses) index.castableClasses = {}
                  index.castableClasses[name] = classMatch[1].trim()
                }
              }
            }
          } else if (type === 'localizations') {
            // Extract Locale name for the names list
            const localeMatch = /\bLocale="([^"]+)"/.exec(content)
            if (localeMatch) {
              const name = localeMatch[1].trim()
              if (name && !names.includes(name)) names.push(name)
            }
            // Extract NPC response call → response text map
            const npcCallRegex = /<Response[^>]+Call="([^"]+)"[^>]*>([^<]*)<\/Response>/g
            let callMatch
            while ((callMatch = npcCallRegex.exec(content)) !== null) {
              const call = callMatch[1].trim()
              const response = callMatch[2].trim()
              if (call) {
                if (!index.npcResponseCalls) index.npcResponseCalls = {}
                index.npcResponseCalls[call] = response
              }
            }
            // Extract string keys from Common, Merchant, MonsterSpeak
            if (!index.npcStringKeys) index.npcStringKeys = []
            for (const [tag, label] of [['Common', 'Common'], ['Merchant', 'Merchant'], ['MonsterSpeak', 'Monster']]) {
              const sectionMatch = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`).exec(content)
              if (!sectionMatch) continue
              const strRegex = /<String[^>]+Key="([^"]+)"[^>]*>([^<]*)<\/String>/g
              let sm
              while ((sm = strRegex.exec(sectionMatch[0])) !== null) {
                const key = sm[1].trim()
                const message = sm[2].trim()
                if (key && !index.npcStringKeys.some((s) => s.key === key && s.category === label)) {
                  index.npcStringKeys.push({ key, message, category: label })
                }
              }
            }
          } else if (attrName) {
            const match = new RegExp(`\\b${attrName}="([^"]+)"`).exec(content)
            if (match) {
              const name = match[1].trim()
              if (name && !names.includes(name)) names.push(name)
            }
          } else if (type === 'variantgroups') {
            // Only the first <Name> is the group name; nested <Variant><Name> are variant names
            const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
            if (nameMatch) {
              const name = nameMatch[1].trim()
              if (name && !names.includes(name)) names.push(name)
            }
          } else {
            ELEM_NAME_REGEX.lastIndex = 0
            let match
            while ((match = ELEM_NAME_REGEX.exec(content)) !== null) {
              const name = match[1].trim()
              if (name && !names.includes(name)) names.push(name)
            }
          }
        }
        names.sort()
      } catch { /* dir may not exist */ }
      index[type] = names
    }

    // Collect element row names from all element table files
    const elementNamesSet = new Set()
    try {
      const etDir = join(libraryPath, 'elementtables')
      const etEntries = await fs.readdir(etDir, { withFileTypes: true })
      for (const file of etEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
        const content = await fs.readFile(join(etDir, file.name), 'utf-8')
        const elemRegex = /<Source[^>]+Element="([^"]+)"/g
        let m
        while ((m = elemRegex.exec(content)) !== null) {
          if (m[1].trim()) elementNamesSet.add(m[1].trim())
        }
      }
    } catch { /* dir may not exist */ }
    index.elementnames = [...elementNamesSet].sort()

    const scriptsDir = join(libraryPath, '..', 'scripts')
    index.scripts = (await walkDir(scriptsDir, '.lua', scriptsDir)).sort()

    await fs.mkdir(getIndexDir(), { recursive: true })
    await fs.writeFile(getIndexPath(libraryPath), JSON.stringify(index, null, 2), 'utf-8')
    return { success: true, builtAt: index.builtAt }
  })

  ipcMain.handle('index:buildSection', async (_, libraryPath, section) => {
    const attrName = ATTR_NAME_MAP[section]
    const dirPath = join(libraryPath, section)
    const names = []
    const result = {}

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      for (const file of entries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
        const content = await fs.readFile(join(dirPath, file.name), 'utf-8')
        if (section === 'castables') {
          const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
          if (nameMatch) {
            const name = nameMatch[1].trim()
            if (name && !names.includes(name)) {
              names.push(name)
              const classMatch = /<Castable[^>]+Class="([^"]*)"/.exec(content)
              if (classMatch) {
                if (!result.castableClasses) result.castableClasses = {}
                result.castableClasses[name] = classMatch[1].trim()
              }
            }
          }
        } else if (section === 'localizations') {
          const localeMatch = /\bLocale="([^"]+)"/.exec(content)
          if (localeMatch) {
            const name = localeMatch[1].trim()
            if (name && !names.includes(name)) names.push(name)
          }
          const npcCallRegex = /<Response[^>]+Call="([^"]+)"[^>]*>([^<]*)<\/Response>/g
          let callMatch
          while ((callMatch = npcCallRegex.exec(content)) !== null) {
            const call = callMatch[1].trim()
            const response = callMatch[2].trim()
            if (call) {
              if (!result.npcResponseCalls) result.npcResponseCalls = {}
              result.npcResponseCalls[call] = response
            }
          }
          // Extract string keys from Common, Merchant, MonsterSpeak
          if (!result.npcStringKeys) result.npcStringKeys = []
          for (const [tag, label] of [['Common', 'Common'], ['Merchant', 'Merchant'], ['MonsterSpeak', 'Monster']]) {
            const sectionMatch = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`).exec(content)
            if (!sectionMatch) continue
            const strRegex = /<String[^>]+Key="([^"]+)"[^>]*>([^<]*)<\/String>/g
            let sm
            while ((sm = strRegex.exec(sectionMatch[0])) !== null) {
              const key = sm[1].trim()
              const message = sm[2].trim()
              if (key && !result.npcStringKeys.some((s) => s.key === key && s.category === label)) {
                result.npcStringKeys.push({ key, message, category: label })
              }
            }
          }
        } else if (section === 'elementtables') {
          // Extract table Name attribute
          const match = /\bName="([^"]+)"/.exec(content)
          if (match) {
            const name = match[1].trim()
            if (name && !names.includes(name)) names.push(name)
          }
          // Also collect element row names for the elementnames index key
          if (!result.elementnames) result.elementnames = []
          const elemRegex = /<Source[^>]+Element="([^"]+)"/g
          let em
          while ((em = elemRegex.exec(content)) !== null) {
            if (em[1].trim() && !result.elementnames.includes(em[1].trim())) result.elementnames.push(em[1].trim())
          }
        } else if (attrName) {
          const match = new RegExp(`\\b${attrName}="([^"]+)"`).exec(content)
          if (match) {
            const name = match[1].trim()
            if (name && !names.includes(name)) names.push(name)
          }
        } else if (section === 'variantgroups') {
          const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
          if (nameMatch) {
            const name = nameMatch[1].trim()
            if (name && !names.includes(name)) names.push(name)
          }
        } else {
          ELEM_NAME_REGEX.lastIndex = 0
          let match
          while ((match = ELEM_NAME_REGEX.exec(content)) !== null) {
            const name = match[1].trim()
            if (name && !names.includes(name)) names.push(name)
          }
        }
      }
      names.sort()
    } catch { /* dir may not exist */ }

    result[section] = names
    if (result.elementnames) result.elementnames.sort()

    // Merge into persisted index so Dashboard stats stay current
    try {
      const indexPath = getIndexPath(libraryPath)
      let existing = {}
      try { existing = JSON.parse(await fs.readFile(indexPath, 'utf-8')) } catch { /* no index yet */ }
      await fs.mkdir(getIndexDir(), { recursive: true })
      await fs.writeFile(indexPath, JSON.stringify({ ...existing, ...result }, null, 2), 'utf-8')
    } catch { /* persist failure is non-fatal */ }

    return result
  })

  ipcMain.handle('index:load', async (_, libraryPath) => {
    try {
      const content = await fs.readFile(getIndexPath(libraryPath), 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  })

  ipcMain.handle('index:status', async (_, libraryPath) => {
    try {
      const content = await fs.readFile(getIndexPath(libraryPath), 'utf-8')
      const { builtAt } = JSON.parse(content)
      return { exists: true, builtAt }
    } catch {
      return { exists: false }
    }
  })

  ipcMain.handle('index:delete', async (_, libraryPath) => {
    try { await fs.unlink(getIndexPath(libraryPath)) } catch { /* may not exist */ }
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
