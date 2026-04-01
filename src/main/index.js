import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
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
import { exportCastablesExcelCSV } from './exportCastablesJson.js'
import { loadConstants, saveConstants } from './constantsJson.js'
import { extractMeta } from './xmlCommentUtils.js'
import { parseBehaviorSetXml, serializeBehaviorSetXml } from './behaviorSetXml'
import { parseSpawngroupXml, serializeSpawngroupXml } from './spawngroupXml'
import { parseServerConfigXml, serializeServerConfigXml } from './serverConfigXml'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createSettingsManager } from './settingsManager'
import { listDir, readFile, writeFile, moveFile, archiveFile } from './fsHandlers'

// Determine the path to use based on the operating system
let userDataPath;

if (process.platform === 'win32') {
  userDataPath = join(app.getPath('home'), 'AppData', 'Local', 'Erisco', 'Creidhne');
} else {
  userDataPath = join(app.getPath('appData'), 'Erisco', 'Creidhne');
}

// Set the userData path
app.setPath('userData', userDataPath);

const settingsManager = createSettingsManager(userDataPath)

//console.log('Settings directory:', join(app.getPath('appData'), 'Erisco', 'Creidhne'));

let closeConfirmed = false

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

  mainWindow.on('close', (e) => {
    if (!closeConfirmed) {
      e.preventDefault()
      mainWindow.webContents.send('app:check-close')
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
    if (window) window.webContents.send('app:check-close')
  })

  ipcMain.on('app:confirm-close', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) {
      closeConfirmed = true
      window.close()
    }
  })
  ipcMain.handle('dialog:openFile', handleFileOpen)
  ipcMain.handle('open-directory', handleDirectoryOpen)
  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('fs:listDir',   (_, dirPath)          => listDir(dirPath))
  ipcMain.handle('fs:readFile',  (_, filePath)          => readFile(filePath))
  ipcMain.handle('fs:writeFile', (_, filePath, content) => writeFile(filePath, content))

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

  ipcMain.handle('xml:loadSpawngroup', async (_, filePath) => {
    const xml = await fs.readFile(filePath, 'utf-8')
    return parseSpawngroupXml(xml)
  })

  ipcMain.handle('xml:saveSpawngroup', async (_, filePath, sgData) => {
    const xml = serializeSpawngroupXml(sgData)
    await fs.writeFile(filePath, xml, 'utf-8')
  })

  ipcMain.handle('xml:loadServerConfig', async (_, filePath) => {
    const xml = await fs.readFile(filePath, 'utf-8')
    return parseServerConfigXml(xml)
  })

  ipcMain.handle('xml:saveServerConfig', async (_, filePath, cfgData) => {
    const xml = serializeServerConfigXml(cfgData)
    await fs.writeFile(filePath, xml, 'utf-8')
  })

  ipcMain.handle('fs:moveFile',    (_, src, dest)          => moveFile(src, dest))
  ipcMain.handle('fs:archiveFile', (_, src, archiveDir)    => archiveFile(src, archiveDir))

  // Handling settings load and save
  ipcMain.handle('settings:load', () => settingsManager.load())

  ipcMain.handle('settings:save', (_, data) => settingsManager.save(data))

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
                const statusesMatch = /<Statuses>([\s\S]*?)<\/Statuses>/.exec(content)
                if (statusesMatch) {
                  if (!index.statusCasters) index.statusCasters = {}
                  const addRegex = /<Add[^>]*>([^<]+)<\/Add>/g
                  let am
                  while ((am = addRegex.exec(statusesMatch[1])) !== null) {
                    const key = am[1].trim().toLowerCase()
                    if (key) {
                      if (!index.statusCasters[key]) index.statusCasters[key] = []
                      if (!index.statusCasters[key].includes(name)) index.statusCasters[key].push(name)
                    }
                  }
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
          } else if (type === 'creatures') {
            const nameMatch = /\bName="([^"]+)"/.exec(content)
            if (nameMatch) {
              const name = nameMatch[1].trim()
              if (name && !names.includes(name)) names.push(name)
            }
            if (!index.creatureTypes) index.creatureTypes = []
            const typeRegex = /<Type[^>]+Name="([^"]+)"/g
            let tm
            while ((tm = typeRegex.exec(content)) !== null) {
              const tn = tm[1].trim()
              if (tn && !index.creatureTypes.includes(tn)) index.creatureTypes.push(tn)
            }
          } else if (attrName) {
            const match = new RegExp(`\\b${attrName}="([^"]+)"`).exec(content)
            if (match) {
              const name = match[1].trim()
              if (name && !names.includes(name)) names.push(name)
            }
          } else if (type === 'npcs') {
            const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
            if (nameMatch) {
              const npcName = nameMatch[1].trim()
              if (npcName && !names.includes(npcName)) names.push(npcName)
              const trainMatch = /<Train>([\s\S]*?)<\/Train>/.exec(content)
              if (trainMatch) {
                if (!index.castableTrainers) index.castableTrainers = {}
                const castableRegex = /<Castable[^>]+Name="([^"]+)"/g
                let cm
                while ((cm = castableRegex.exec(trainMatch[1])) !== null) {
                  const key = cm[1].trim().toLowerCase()
                  if (!index.castableTrainers[key]) index.castableTrainers[key] = []
                  if (!index.castableTrainers[key].includes(npcName)) index.castableTrainers[key].push(npcName)
                }
              }
              const vendMatch = /<Vend>([\s\S]*?)<\/Vend>/.exec(content)
              if (vendMatch) {
                if (!index.itemVendors) index.itemVendors = {}
                const vendItemRegex = /<Item[^>]+Name="([^"]+)"/g
                let vm
                while ((vm = vendItemRegex.exec(vendMatch[1])) !== null) {
                  const key = vm[1].trim().toLowerCase()
                  if (key) {
                    if (!index.itemVendors[key]) index.itemVendors[key] = []
                    if (!index.itemVendors[key].includes(npcName)) index.itemVendors[key].push(npcName)
                  }
                }
              }
            }
          } else if (type === 'lootsets') {
            const nameMatch = /\bName="([^"]+)"/.exec(content)
            if (nameMatch) {
              const lootSetName = nameMatch[1].trim()
              if (lootSetName && !names.includes(lootSetName)) names.push(lootSetName)
              if (!index.itemLootSets) index.itemLootSets = {}
              const itemsBlockRegex = /<Items[^>]*>([\s\S]*?)<\/Items>/g
              let ib
              while ((ib = itemsBlockRegex.exec(content)) !== null) {
                const itemRegex = /<Item[^>]*>([^<]+)<\/Item>/g
                let im
                while ((im = itemRegex.exec(ib[1])) !== null) {
                  const key = im[1].trim().toLowerCase()
                  if (key) {
                    if (!index.itemLootSets[key]) index.itemLootSets[key] = []
                    if (!index.itemLootSets[key].includes(lootSetName)) index.itemLootSets[key].push(lootSetName)
                  }
                }
              }
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

      if (type === 'castables') {
        const archivedNames = []
        try {
          const archivedDirPath = join(dirPath, '.ignore')
          const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
          for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
            const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
            const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
            if (nameMatch) {
              const name = nameMatch[1].trim()
              if (name && !archivedNames.includes(name)) archivedNames.push(name)
            }
          }
        } catch { /* .ignore may not exist */ }
        index.archivedCastables = archivedNames.sort()
      }
      if (type === 'creatures') {
        const archivedNames = []
        try {
          const archivedDirPath = join(dirPath, '.ignore')
          const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
          for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
            const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
            const nameMatch = /\bName="([^"]+)"/.exec(content)
            if (nameMatch) {
              const name = nameMatch[1].trim()
              if (name && !archivedNames.includes(name)) archivedNames.push(name)
            }
          }
        } catch { /* .ignore may not exist */ }
        index.archivedCreatures = archivedNames.sort()
      }
      if (type === 'creaturebehaviorsets') {
        const archivedNames = []
        try {
          const archivedDirPath = join(dirPath, '.ignore')
          const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
          for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
            const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
            const nameMatch = /\bName="([^"]+)"/.exec(content)
            if (nameMatch) {
              const name = nameMatch[1].trim()
              if (name && !archivedNames.includes(name)) archivedNames.push(name)
            }
          }
        } catch { /* .ignore may not exist */ }
        index.archivedCreaturebehaviorsets = archivedNames.sort()
      }
      if (type === 'spawngroups') {
        const archivedNames = []
        try {
          const archivedDirPath = join(dirPath, '.ignore')
          const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
          for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
            const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
            const nameMatch = /\bName="([^"]+)"/.exec(content)
            if (nameMatch) {
              const name = nameMatch[1].trim()
              if (name && !archivedNames.includes(name)) archivedNames.push(name)
            }
          }
        } catch { /* .ignore may not exist */ }
        index.archivedSpawngroups = archivedNames.sort()
      }
      if (type === 'lootsets') {
        const archivedNames = []
        try {
          const archivedDirPath = join(dirPath, '.ignore')
          const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
          for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
            const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
            const nameMatch = /\bName="([^"]+)"/.exec(content)
            if (nameMatch) {
              const name = nameMatch[1].trim()
              if (name && !archivedNames.includes(name)) archivedNames.push(name)
            }
          }
        } catch { /* .ignore may not exist */ }
        index.archivedLootsets = archivedNames.sort()
      }
      if (type === 'statuses') {
        const archivedNames = []
        try {
          const archivedDirPath = join(dirPath, '.ignore')
          const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
          for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
            const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
            const nameMatch = /\bName="([^"]+)"/.exec(content)
            if (nameMatch) {
              const name = nameMatch[1].trim()
              if (name && !archivedNames.includes(name)) archivedNames.push(name)
            }
          }
        } catch { /* .ignore may not exist */ }
        index.archivedStatuses = archivedNames.sort()
      }
      if (type === 'npcs') {
        const archivedNames = []
        try {
          const archivedDirPath = join(dirPath, '.ignore')
          const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
          for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
            const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
            const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
            if (nameMatch) {
              const name = nameMatch[1].trim()
              if (name && !archivedNames.includes(name)) archivedNames.push(name)
            }
          }
        } catch { /* .ignore may not exist */ }
        index.archivedNpcs = archivedNames.sort()
      }
      if (type === 'nations') {
        const archivedNames = []
        try {
          const archivedDirPath = join(dirPath, '.ignore')
          const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
          for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
            const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
            const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
            if (nameMatch) {
              const name = nameMatch[1].trim()
              if (name && !archivedNames.includes(name)) archivedNames.push(name)
            }
          }
        } catch { /* .ignore may not exist */ }
        index.archivedNations = archivedNames.sort()
      }
      if (type === 'items') {
        const archivedNames = []
        try {
          const archivedDirPath = join(dirPath, '.ignore')
          const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
          for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
            const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
            const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
            if (nameMatch) {
              const name = nameMatch[1].trim()
              if (name && !archivedNames.includes(name)) archivedNames.push(name)
            }
          }
        } catch { /* .ignore may not exist */ }
        index.archivedItems = archivedNames.sort()
      }
      if (type === 'variantgroups') {
        const archivedNames = []
        try {
          const archivedDirPath = join(dirPath, '.ignore')
          const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
          for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
            const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
            const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
            if (nameMatch) {
              const name = nameMatch[1].trim()
              if (name && !archivedNames.includes(name)) archivedNames.push(name)
            }
          }
        } catch { /* .ignore may not exist */ }
        index.archivedVariantgroups = archivedNames.sort()
      }
      if (type === 'recipes') {
        const archivedNames = []
        try {
          const archivedDirPath = join(dirPath, '.ignore')
          const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
          for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
            const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
            const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
            if (nameMatch) {
              const name = nameMatch[1].trim()
              if (name && !archivedNames.includes(name)) archivedNames.push(name)
            }
          }
        } catch { /* .ignore may not exist */ }
        index.archivedRecipes = archivedNames.sort()
      }
      if (type === 'elementtables') {
        const archivedNames = []
        try {
          const archivedDirPath = join(dirPath, '.ignore')
          const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
          for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
            const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
            const nameMatch = /\bName="([^"]+)"/.exec(content)
            if (nameMatch) {
              const name = nameMatch[1].trim()
              if (name && !archivedNames.includes(name)) archivedNames.push(name)
            }
          }
        } catch { /* .ignore may not exist */ }
        index.archivedElementtables = archivedNames.sort()
      }
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

    const scanCatDetails = async (dir) => {
      const catMap = {}
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries.filter(e => e.isFile() && e.name.endsWith('.xml'))) {
          const content = await fs.readFile(join(dir, entry.name), 'utf-8')
          const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content) || /\bName="([^"]+)"/.exec(content)
          const itemName = nameMatch ? nameMatch[1].trim() : entry.name.replace(/\.xml$/i, '')
          const catSection = /<Categories[^>]*>([\s\S]*?)<\/Categories>/.exec(content)
          if (!catSection) continue
          const body = catSection[1]
          const catElemRegex = /<Category\b[^>]*>([^<]+)<\/Category>/g
          const catAttrRegex = /<Category\b[^>]*\bName="([^"]+)"/g
          let m
          while ((m = catElemRegex.exec(body)) !== null) { const c = m[1].trim(); if (c) { if (!catMap[c]) catMap[c] = { count: 0, usedBy: [] }; catMap[c].count++; if (catMap[c].usedBy.length < 5) catMap[c].usedBy.push(itemName) } }
          while ((m = catAttrRegex.exec(body)) !== null) { const c = m[1].trim(); if (c) { if (!catMap[c]) catMap[c] = { count: 0, usedBy: [] }; catMap[c].count++; if (catMap[c].usedBy.length < 5) catMap[c].usedBy.push(itemName) } }
        }
      } catch { /* dir may not exist */ }
      return Object.entries(catMap)
        .map(([name, { count, usedBy }]) => ({ name, count, usedBy: count < 5 ? usedBy : [] }))
        .sort((a, b) => a.name.localeCompare(b.name))
    }
    const itemCatDetails      = await scanCatDetails(join(libraryPath, 'items'))
    const castableCatDetails  = await scanCatDetails(join(libraryPath, 'castables'))
    const statusCatDetails    = await scanCatDetails(join(libraryPath, 'statuses'))
    index.itemCategories          = itemCatDetails.map(c => c.name)
    index.castableCategories      = castableCatDetails.map(c => c.name)
    index.statusCategories        = statusCatDetails.map(c => c.name)
    index.itemCategoryDetails     = itemCatDetails
    index.castableCategoryDetails = castableCatDetails
    index.statusCategoryDetails   = statusCatDetails

    const vendorTabsSet = new Set()
    try {
      const itemsDir = join(libraryPath, 'items')
      for (const entry of (await fs.readdir(itemsDir, { withFileTypes: true })).filter(e => e.isFile() && e.name.endsWith('.xml'))) {
        const content = await fs.readFile(join(itemsDir, entry.name), 'utf-8')
        const shopTabRegex = /\bShopTab="([^"]+)"/g
        let m
        while ((m = shopTabRegex.exec(content)) !== null) { if (m[1].trim()) vendorTabsSet.add(m[1].trim()) }
      }
    } catch { /* dir may not exist */ }
    index.vendorTabs = [...vendorTabsSet].sort()

    const npcJobsSet = new Set()
    try {
      const npcsDir = join(libraryPath, 'npcs')
      for (const entry of (await fs.readdir(npcsDir, { withFileTypes: true })).filter(e => e.isFile() && e.name.endsWith('.xml'))) {
        const namePart = entry.name.replace(/\.xml$/i, '')
        const idx = namePart.indexOf('_')
        if (idx > 0) {
          const prefix = namePart.slice(0, idx)
          if (prefix && prefix.toLowerCase() !== 'npc') npcJobsSet.add(prefix)
        }
      }
    } catch { /* dir may not exist */ }
    index.npcJobs = [...npcJobsSet].sort()

    const cookieNamesSet = new Set()
    const cookieRegexBuild = /\w+\.setcookie\s*\(\s*"([^"]+)"/gi
    const scanCookieNames = async (dir) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const full = join(dir, entry.name)
          if (entry.isDirectory()) await scanCookieNames(full)
          else if (entry.isFile() && entry.name.endsWith('.lua')) {
            const content = await fs.readFile(full, 'utf-8')
            cookieRegexBuild.lastIndex = 0
            let m
            while ((m = cookieRegexBuild.exec(content)) !== null) {
              if (m[1]) cookieNamesSet.add(m[1])
            }
          }
        }
      } catch { /* dir may not exist */ }
    }
    await scanCookieNames(scriptsDir)
    index.cookieNames = [...cookieNamesSet].sort()

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
              const statusesMatch = /<Statuses>([\s\S]*?)<\/Statuses>/.exec(content)
              if (statusesMatch) {
                const addMatch = /<Add>([\s\S]*?)<\/Add>/.exec(statusesMatch[1])
                if (addMatch) {
                  if (!result.statusCasters) result.statusCasters = {}
                  const statusRegex = /<Status[^>]*>([^<]+)<\/Status>/g
                  let sm
                  while ((sm = statusRegex.exec(addMatch[1])) !== null) {
                    const key = sm[1].trim().toLowerCase()
                    if (key) {
                      if (!result.statusCasters[key]) result.statusCasters[key] = []
                      if (!result.statusCasters[key].includes(name)) result.statusCasters[key].push(name)
                    }
                  }
                }
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
        } else if (section === 'creatures') {
          const nameMatch = /\bName="([^"]+)"/.exec(content)
          if (nameMatch) {
            const name = nameMatch[1].trim()
            if (name && !names.includes(name)) names.push(name)
          }
          if (!result.creatureTypes) result.creatureTypes = []
          const typeRegex = /<Type[^>]+Name="([^"]+)"/g
          let tm
          while ((tm = typeRegex.exec(content)) !== null) {
            const tn = tm[1].trim()
            if (tn && !result.creatureTypes.includes(tn)) result.creatureTypes.push(tn)
          }
        } else if (attrName) {
          const match = new RegExp(`\\b${attrName}="([^"]+)"`).exec(content)
          if (match) {
            const name = match[1].trim()
            if (name && !names.includes(name)) names.push(name)
          }
        } else if (section === 'npcs') {
          const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
          if (nameMatch) {
            const npcName = nameMatch[1].trim()
            if (npcName && !names.includes(npcName)) names.push(npcName)
            const trainMatch = /<Train>([\s\S]*?)<\/Train>/.exec(content)
            if (trainMatch) {
              if (!result.castableTrainers) result.castableTrainers = {}
              const castableRegex = /<Castable[^>]+Name="([^"]+)"/g
              let cm
              while ((cm = castableRegex.exec(trainMatch[1])) !== null) {
                const key = cm[1].trim().toLowerCase()
                if (!result.castableTrainers[key]) result.castableTrainers[key] = []
                if (!result.castableTrainers[key].includes(npcName)) result.castableTrainers[key].push(npcName)
              }
            }
            const vendMatch = /<Vend>([\s\S]*?)<\/Vend>/.exec(content)
            if (vendMatch) {
              if (!result.itemVendors) result.itemVendors = {}
              const vendItemRegex = /<Item[^>]+Name="([^"]+)"/g
              let vm
              while ((vm = vendItemRegex.exec(vendMatch[1])) !== null) {
                const key = vm[1].trim().toLowerCase()
                if (key) {
                  if (!result.itemVendors[key]) result.itemVendors[key] = []
                  if (!result.itemVendors[key].includes(npcName)) result.itemVendors[key].push(npcName)
                }
              }
            }
          }
        } else if (section === 'lootsets') {
          const nameMatch = /\bName="([^"]+)"/.exec(content)
          if (nameMatch) {
            const lootSetName = nameMatch[1].trim()
            if (lootSetName && !names.includes(lootSetName)) names.push(lootSetName)
            if (!result.itemLootSets) result.itemLootSets = {}
            const itemsBlockRegex = /<Items[^>]*>([\s\S]*?)<\/Items>/g
            let ib
            while ((ib = itemsBlockRegex.exec(content)) !== null) {
              const itemRegex = /<Item[^>]*>([^<]+)<\/Item>/g
              let im
              while ((im = itemRegex.exec(ib[1])) !== null) {
                const key = im[1].trim().toLowerCase()
                if (key) {
                  if (!result.itemLootSets[key]) result.itemLootSets[key] = []
                  if (!result.itemLootSets[key].includes(lootSetName)) result.itemLootSets[key].push(lootSetName)
                }
              }
            }
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

    if (section === 'castables') {
      const archivedNames = []
      try {
        const archivedDirPath = join(dirPath, '.ignore')
        const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
        for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
          const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
          const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
          if (nameMatch) {
            const name = nameMatch[1].trim()
            if (name && !archivedNames.includes(name)) archivedNames.push(name)
          }
        }
      } catch { /* .ignore may not exist */ }
      result.archivedCastables = archivedNames.sort()
    }
    if (section === 'creatures') {
      const archivedNames = []
      try {
        const archivedDirPath = join(dirPath, '.ignore')
        const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
        for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
          const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
          const nameMatch = /\bName="([^"]+)"/.exec(content)
          if (nameMatch) {
            const name = nameMatch[1].trim()
            if (name && !archivedNames.includes(name)) archivedNames.push(name)
          }
        }
      } catch { /* .ignore may not exist */ }
      result.archivedCreatures = archivedNames.sort()
    }
    if (section === 'creaturebehaviorsets') {
      const archivedNames = []
      try {
        const archivedDirPath = join(dirPath, '.ignore')
        const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
        for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
          const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
          const nameMatch = /\bName="([^"]+)"/.exec(content)
          if (nameMatch) {
            const name = nameMatch[1].trim()
            if (name && !archivedNames.includes(name)) archivedNames.push(name)
          }
        }
      } catch { /* .ignore may not exist */ }
      result.archivedCreaturebehaviorsets = archivedNames.sort()
    }
    if (section === 'spawngroups') {
      const archivedNames = []
      try {
        const archivedDirPath = join(dirPath, '.ignore')
        const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
        for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
          const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
          const nameMatch = /\bName="([^"]+)"/.exec(content)
          if (nameMatch) {
            const name = nameMatch[1].trim()
            if (name && !archivedNames.includes(name)) archivedNames.push(name)
          }
        }
      } catch { /* .ignore may not exist */ }
      result.archivedSpawngroups = archivedNames.sort()
    }
    if (section === 'lootsets') {
      const archivedNames = []
      try {
        const archivedDirPath = join(dirPath, '.ignore')
        const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
        for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
          const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
          const nameMatch = /\bName="([^"]+)"/.exec(content)
          if (nameMatch) {
            const name = nameMatch[1].trim()
            if (name && !archivedNames.includes(name)) archivedNames.push(name)
          }
        }
      } catch { /* .ignore may not exist */ }
      result.archivedLootsets = archivedNames.sort()
    }
    if (section === 'statuses') {
      const archivedNames = []
      try {
        const archivedDirPath = join(dirPath, '.ignore')
        const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
        for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
          const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
          const nameMatch = /\bName="([^"]+)"/.exec(content)
          if (nameMatch) {
            const name = nameMatch[1].trim()
            if (name && !archivedNames.includes(name)) archivedNames.push(name)
          }
        }
      } catch { /* .ignore may not exist */ }
      result.archivedStatuses = archivedNames.sort()
    }
    if (section === 'npcs') {
      const archivedNames = []
      try {
        const archivedDirPath = join(dirPath, '.ignore')
        const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
        for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
          const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
          const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
          if (nameMatch) {
            const name = nameMatch[1].trim()
            if (name && !archivedNames.includes(name)) archivedNames.push(name)
          }
        }
      } catch { /* .ignore may not exist */ }
      result.archivedNpcs = archivedNames.sort()
    }
    if (section === 'nations') {
      const archivedNames = []
      try {
        const archivedDirPath = join(dirPath, '.ignore')
        const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
        for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
          const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
          const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
          if (nameMatch) {
            const name = nameMatch[1].trim()
            if (name && !archivedNames.includes(name)) archivedNames.push(name)
          }
        }
      } catch { /* .ignore may not exist */ }
      result.archivedNations = archivedNames.sort()
    }
    if (section === 'items') {
      const archivedNames = []
      try {
        const archivedDirPath = join(dirPath, '.ignore')
        const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
        for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
          const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
          const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
          if (nameMatch) {
            const name = nameMatch[1].trim()
            if (name && !archivedNames.includes(name)) archivedNames.push(name)
          }
        }
      } catch { /* .ignore may not exist */ }
      result.archivedItems = archivedNames.sort()
    }
    if (section === 'variantgroups') {
      const archivedNames = []
      try {
        const archivedDirPath = join(dirPath, '.ignore')
        const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
        for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
          const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
          const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
          if (nameMatch) {
            const name = nameMatch[1].trim()
            if (name && !archivedNames.includes(name)) archivedNames.push(name)
          }
        }
      } catch { /* .ignore may not exist */ }
      result.archivedVariantgroups = archivedNames.sort()
    }
    if (section === 'recipes') {
      const archivedNames = []
      try {
        const archivedDirPath = join(dirPath, '.ignore')
        const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
        for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
          const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
          const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
          if (nameMatch) {
            const name = nameMatch[1].trim()
            if (name && !archivedNames.includes(name)) archivedNames.push(name)
          }
        }
      } catch { /* .ignore may not exist */ }
      result.archivedRecipes = archivedNames.sort()
    }
    if (section === 'elementtables') {
      const archivedNames = []
      try {
        const archivedDirPath = join(dirPath, '.ignore')
        const archivedEntries = await fs.readdir(archivedDirPath, { withFileTypes: true })
        for (const file of archivedEntries.filter((e) => e.isFile() && e.name.endsWith('.xml'))) {
          const content = await fs.readFile(join(archivedDirPath, file.name), 'utf-8')
          const nameMatch = /\bName="([^"]+)"/.exec(content)
          if (nameMatch) {
            const name = nameMatch[1].trim()
            if (name && !archivedNames.includes(name)) archivedNames.push(name)
          }
        }
      } catch { /* .ignore may not exist */ }
      result.archivedElementtables = archivedNames.sort()
    }

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

  // --- Constants (XSD simple types, categories, cookies) ---

  ipcMain.handle('constants:loadXsdTypes', async () => {
    const xsdDir = join(app.getAppPath(), 'xsd', 'src', 'XSD')
    const result = []
    try {
      const files = await fs.readdir(xsdDir)
      for (const fileName of files.filter(f => f.endsWith('.xsd'))) {
        const content = await fs.readFile(join(xsdDir, fileName), 'utf-8')
        const simpleTypeRegex = /<xs:simpleType\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/xs:simpleType>/g
        let match
        while ((match = simpleTypeRegex.exec(content)) !== null) {
          const name = match[1]
          const body = match[2]
          const enumRegex = /<xs:enumeration\s+value="([^"]+)"/g
          const values = []
          let em
          while ((em = enumRegex.exec(body)) !== null) values.push(em[1])
          if (values.length === 0) continue
          const isList = /<xs:list/.test(body)
          result.push({ name, values, isList, sourceFile: fileName.replace('.xsd', '') })
        }
      }
    } catch (e) {
      console.error('Error loading XSD types:', e)
    }
    return result.sort((a, b) => a.name.localeCompare(b.name))
  })

  // Helper: read index, apply updater fn, write back
  const updateIndex = async (libraryPath, updater) => {
    const indexPath = getIndexPath(libraryPath)
    let idx = {}
    try { idx = JSON.parse(await fs.readFile(indexPath, 'utf-8')) } catch { /* no index yet */ }
    await fs.mkdir(getIndexDir(), { recursive: true })
    await fs.writeFile(indexPath, JSON.stringify(updater(idx), null, 2), 'utf-8')
  }

  ipcMain.handle('constants:scanCategories', async (_, libraryPath) => {
    const result = { items: [], castables: [], statuses: [] }
    const scanDir = async (dir, target) => {
      const catMap = {}
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries.filter(e => e.isFile() && e.name.endsWith('.xml'))) {
          const content = await fs.readFile(join(dir, entry.name), 'utf-8')
          const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content) || /\bName="([^"]+)"/.exec(content)
          const itemName = nameMatch ? nameMatch[1].trim() : entry.name.replace(/\.xml$/i, '')
          const catSection = /<Categories[^>]*>([\s\S]*?)<\/Categories>/.exec(content)
          if (!catSection) continue
          const body = catSection[1]
          const cats = new Set()
          const catElemRegex = /<Category\b[^>]*>([^<]+)<\/Category>/g
          const catAttrRegex = /<Category\b[^>]*\bName="([^"]+)"/g
          let m
          while ((m = catElemRegex.exec(body)) !== null) { const c = m[1].trim(); if (c) cats.add(c) }
          while ((m = catAttrRegex.exec(body)) !== null) { const c = m[1].trim(); if (c) cats.add(c) }
          for (const cat of cats) {
            if (!catMap[cat]) catMap[cat] = { count: 0, usedBy: [] }
            catMap[cat].count++
            if (catMap[cat].usedBy.length < 5) catMap[cat].usedBy.push(itemName)
          }
        }
      } catch { /* dir may not exist */ }
      target.push(...Object.entries(catMap)
        .map(([name, { count, usedBy }]) => ({ name, count, usedBy: count < 5 ? usedBy : [] }))
        .sort((a, b) => a.name.localeCompare(b.name)))
    }
    await scanDir(join(libraryPath, 'items'), result.items)
    await scanDir(join(libraryPath, 'castables'), result.castables)
    await scanDir(join(libraryPath, 'statuses'), result.statuses)
    try {
      await updateIndex(libraryPath, idx => ({
        ...idx,
        itemCategories:          result.items.map(c => c.name),
        castableCategories:      result.castables.map(c => c.name),
        statusCategories:        result.statuses.map(c => c.name),
        itemCategoryDetails:     result.items,
        castableCategoryDetails: result.castables,
        statusCategoryDetails:   result.statuses,
      }))
    } catch { /* non-fatal */ }
    return result
  })

  ipcMain.handle('constants:scanVendorTabs', async (_, libraryPath) => {
    const tabMap = {}
    try {
      const itemsDir = join(libraryPath, 'items')
      const entries = await fs.readdir(itemsDir, { withFileTypes: true })
      for (const entry of entries.filter(e => e.isFile() && e.name.endsWith('.xml'))) {
        const content = await fs.readFile(join(itemsDir, entry.name), 'utf-8')
        const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
        const itemName = nameMatch ? nameMatch[1].trim() : entry.name.replace(/\.xml$/i, '')
        const shopTabRegex = /\bShopTab="([^"]+)"/g
        let m
        while ((m = shopTabRegex.exec(content)) !== null) {
          const val = m[1].trim()
          if (!val) continue
          if (!tabMap[val]) tabMap[val] = { count: 0, usedBy: [] }
          tabMap[val].count++
          if (tabMap[val].usedBy.length < 5) tabMap[val].usedBy.push(itemName)
        }
      }
    } catch { /* dir may not exist */ }
    const details = Object.entries(tabMap)
      .map(([name, { count, usedBy }]) => ({ name, count, usedBy: count < 5 ? usedBy : [] }))
      .sort((a, b) => a.name.localeCompare(b.name))
    try {
      await updateIndex(libraryPath, idx => ({
        ...idx,
        vendorTabs:        details.map(t => t.name),
        vendorTabDetails:  details,
      }))
    } catch { /* non-fatal */ }
    return details
  })

  ipcMain.handle('constants:scanNpcJobs', async (_, libraryPath) => {
    const jobMap = {}
    try {
      const npcsDir = join(libraryPath, 'npcs')
      const entries = await fs.readdir(npcsDir, { withFileTypes: true })
      for (const entry of entries.filter(e => e.isFile() && e.name.endsWith('.xml'))) {
        const namePart = entry.name.replace(/\.xml$/i, '')
        const underscoreIdx = namePart.indexOf('_')
        if (underscoreIdx <= 0) continue
        const prefix = namePart.slice(0, underscoreIdx)
        if (!prefix || prefix.toLowerCase() === 'npc') continue
        const content = await fs.readFile(join(npcsDir, entry.name), 'utf-8')
        const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
        const npcName = nameMatch ? nameMatch[1].trim() : namePart
        if (!jobMap[prefix]) jobMap[prefix] = { count: 0, usedBy: [] }
        jobMap[prefix].count++
        if (jobMap[prefix].usedBy.length < 5) jobMap[prefix].usedBy.push(npcName)
      }
    } catch { /* dir may not exist */ }
    const details = Object.entries(jobMap)
      .map(([name, { count, usedBy }]) => ({ name, count, usedBy: count < 5 ? usedBy : [] }))
      .sort((a, b) => a.name.localeCompare(b.name))
    try {
      await updateIndex(libraryPath, idx => ({
        ...idx,
        npcJobs:        details.map(j => j.name),
        npcJobDetails:  details,
      }))
    } catch { /* non-fatal */ }
    return details
  })

  ipcMain.handle('constants:scanCookies', async (_, libraryPath) => {
    const scriptsDir = join(libraryPath, '..', 'scripts')
    const cookies = []
    const cookieRegex = /\w+\.setcookie\s*\(\s*"([^"]+)"/gi
    const scanDir = async (dir, base) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const full = join(dir, entry.name)
          if (entry.isDirectory()) await scanDir(full, base)
          else if (entry.isFile() && entry.name.endsWith('.lua')) {
            const content = await fs.readFile(full, 'utf-8')
            const relPath = full.slice(base.length + 1).replace(/\\/g, '/')
            cookieRegex.lastIndex = 0
            let m
            while ((m = cookieRegex.exec(content)) !== null) {
              const name = m[1]
              if (name && !cookies.some(c => c.name === name && c.sourceFile === relPath)) {
                cookies.push({ name, sourceFile: relPath })
              }
            }
          }
        }
      } catch { /* dir may not exist */ }
    }
    await scanDir(scriptsDir, scriptsDir)
    cookies.sort((a, b) => a.name.localeCompare(b.name))
    try {
      await updateIndex(libraryPath, idx => ({
        ...idx,
        cookieNames: [...new Set(cookies.map(c => c.name))].sort(),
      }))
    } catch { /* non-fatal */ }
    return cookies
  })

  ipcMain.handle('constants:addValue', async (_, libraryPath, type, value) => {
    if (!libraryPath || !type || !value) return null
    try {
      const constants = await loadConstants(libraryPath)
      const existing = constants[type] || []
      if (!existing.includes(value)) {
        constants[type] = [...existing, value].sort()
        await saveConstants(libraryPath, constants)
      }
      return constants
    } catch (e) {
      console.error('Error adding constant value:', e)
      return null
    }
  })

  ipcMain.handle('constants:loadUserConstants', async (_, libraryPath) => {
    if (!libraryPath) return { vendorTabs: [], itemCategories: [], castableCategories: [], statusCategories: [], cookies: [], npcJobs: [] }
    return loadConstants(libraryPath)
  })

  ipcMain.handle('constants:saveUserConstants', async (_, libraryPath, data) => {
    if (!libraryPath) return
    await saveConstants(libraryPath, data)
  })

  ipcMain.handle('dialog:saveFile', async (_, defaultName, content) => {
    const window = BrowserWindow.getFocusedWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(window, {
      defaultPath: defaultName,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    })
    if (canceled || !filePath) return { canceled: true }
    await fs.writeFile(filePath, content, 'utf-8')
    return { canceled: false, filePath }
  })

  ipcMain.handle('export:castablesCSV', async (_, libraryPath) => {
    const castDir = join(libraryPath, 'castables')

    let castableTrainers = {}
    try {
      const content = await fs.readFile(getIndexPath(libraryPath), 'utf-8')
      castableTrainers = JSON.parse(content).castableTrainers || {}
    } catch { /* no index — trainers will be empty */ }

    const ALL_CLASSES = ['Warrior', 'Wizard', 'Priest', 'Rogue', 'Monk', 'Peasant']

    function deriveIcon(book, icon) {
      const isSpell = book.includes('Spell')
      return isSpell ? `spell${icon}.png` : `skill${icon}.png`
    }

    function deriveType(book) {
      switch (book) {
        case 'PrimarySkill':   case 'SecondarySkill':  return 'Skill'
        case 'PrimarySpell':   case 'SecondarySpell':  return 'Spell'
        case 'UtilitySkill':  return 'Utility Skill'
        case 'UtilitySpell':  return 'Utility Spell'
        default: return book
      }
    }

    function deriveClass(cls) {
      if (!cls) return 'Universal'
      const words = cls.split(/\s+/).filter(Boolean)
      if (words.length === 0 || ALL_CLASSES.every(c => words.includes(c))) return 'Universal'
      return cls
    }

    function formatMats(req) {
      if (!req) return 'No Cost'
      const parts = []
      if (req.gold) parts.push(`${req.gold} gold`)
      for (const item of (req.items || [])) {
        const qty = Number(item.quantity) > 1 ? `${item.quantity} ` : ''
        parts.push(`${qty}${item.itemName}`)
      }
      return parts.length > 0 ? parts.join(', ') : 'No Cost'
    }

    function formatCastCost(castCosts) {
      if (!castCosts || castCosts.length === 0) return ''
      return castCosts.map(cost => {
        if (cost.type === 'Item') return `${cost.quantity || 1} ${cost.itemName}`
        const val = String(cost.value || '')
        const hpMatch  = /SOURCEBASEHP\s*\*\s*([\d.]+)/.exec(val)
        const mpMatch  = /SOURCEBASEMP\s*\*\s*([\d.]+)/.exec(val)
        const gldMatch = /SOURCEGOLD\s*\*\s*([\d.]+)/.exec(val)
        if (hpMatch)  return `${Math.round(Number(hpMatch[1])  * 100)}% of Base Health`
        if (mpMatch)  return `${Math.round(Number(mpMatch[1])  * 100)}% of Base Mana`
        if (gldMatch) return `${Math.round(Number(gldMatch[1]) * 100)}% of Gold`
        if (/^SOURCEBASEHP$/i.test(val)) return '100% of Base Health'
        if (/^SOURCEBASEMP$/i.test(val)) return '100% of Base Mana'
        if (/^SOURCEGOLD$/i.test(val))   return '100% of Gold'
        if (cost.type === 'Hp')   return `${val} HP`
        if (cost.type === 'Mp')   return `${val} Mana`
        if (cost.type === 'Gold') return `${val} Gold`
        return val
      }).join(', ')
    }

    function esc(val) {
      const s = String(val ?? '')
      return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? `"${s.replace(/"/g, '""')}"` : s
    }

    const header = 'Name,Icon,Description,Class,Subclass,Location,StatStr,StatInt,StatWis,StatDex,StatCon,Mats,Level,Type,CastCost,Cooldown'
    const rows = [header]

    let entries = []
    try {
      entries = await fs.readdir(castDir, { withFileTypes: true })
    } catch {
      return { error: 'Could not read castables directory' }
    }

    for (const entry of entries.filter(e => e.isFile() && e.name.endsWith('.xml'))) {
      try {
        const xmlString = await fs.readFile(join(castDir, entry.name), 'utf-8')
        const meta = extractMeta(xmlString)
        if (meta.isTest || meta.isGM) continue
        const castable = await parseCastableXml(xmlString)
        const req = castable.requirements[0] || null
        const trainers = castableTrainers[castable.name.toLowerCase()] || []
        let location = ''
        if (trainers.length > 0) location = trainers.join(', ')
        else if (meta.givenViaScript) location = 'Awarded by a Quest'
        const classLabel = deriveClass(castable.class)
        const subclass = meta.specialty || classLabel
        rows.push([
          esc(castable.name),
          esc(deriveIcon(castable.book, castable.icon)),
          esc(castable.descriptions[0]?.text || ''),
          esc(classLabel),
          esc(subclass),
          esc(location),
          esc(req?.str  || '3'),
          esc(req?.int  || '3'),
          esc(req?.wis  || '3'),
          esc(req?.dex  || '3'),
          esc(req?.con  || '3'),
          esc(formatMats(req)),
          esc(req?.levelMin || '1'),
          esc(deriveType(castable.book)),
          esc(formatCastCost(castable.castCosts)),
          esc(castable.cooldown || ''),
        ].join(','))
      } catch { /* skip malformed file */ }
    }

    return { csv: rows.join('\r\n') }
  })

  ipcMain.handle('export:castablesJSON', async (_, libraryPath) => {
    return exportCastablesExcelCSV(libraryPath)
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
