import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { getCreidhneFilePath, ensureCreidhneDir } from './worldData.js'
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
import { loadFormulas, saveFormulas, importFormulas } from './formulasJson.js'
import { extractMeta } from './xmlCommentUtils.js'
import { parseBehaviorSetXml, serializeBehaviorSetXml } from './behaviorSetXml'
import { parseSpawngroupXml, serializeSpawngroupXml } from './spawngroupXml'
import { parseServerConfigXml, serializeServerConfigXml } from './serverConfigXml'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createSettingsManager } from './settingsManager'
import { listDir, readFile, writeFile, moveFile, archiveFile, readBinaryFile, checkClientPath } from './fsHandlers'
import { checkForUpdates } from './updateCheck.js'
import { loadReference } from './referenceLoader.js'
import {
  buildIndexInWorker,
  buildSectionInWorker,
  loadIndex,
  getIndexStatus,
  deleteIndex,
} from './indexService.js'
import { saveSection } from '@eriscorp/hybindex-ts'

// Settings in %APPDATA%/Erisco/Creidhne (roaming), cache in %LOCALAPPDATA%/Erisco/Creidhne (local)
const settingsPath = join(app.getPath('appData'), 'Erisco', 'Creidhne');
const cachePath = join(app.getPath('cache'), 'Erisco', 'Creidhne');
app.setPath('userData', cachePath);

const settingsManager = createSettingsManager(settingsPath)

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
  ipcMain.handle('app:checkForUpdates', () => checkForUpdates(app.getVersion()))
  ipcMain.handle('reference:load', (_, libraryPath, type, name) => loadReference(libraryPath, type, name))

  ipcMain.handle('fs:listDir',         (_, dirPath)          => listDir(dirPath))
  ipcMain.handle('fs:readFile',        (_, filePath)          => readFile(filePath))
  ipcMain.handle('fs:writeFile',       (_, filePath, content) => writeFile(filePath, content))
  ipcMain.handle('fs:readBinaryFile',  (_, filePath)          => readBinaryFile(filePath))
  ipcMain.handle('fs:checkClientPath', (_, clientPath)        => checkClientPath(clientPath))

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
    return settingsPath
  })

  // --- Library index (via @eriscorp/hybindex-ts utilityProcess worker) ---

  ipcMain.handle('index:build', async (_, libraryPath) => {
    const index = await buildIndexInWorker(libraryPath)
    return { success: true, builtAt: index.builtAt }
  })

  ipcMain.handle('index:buildSection', (_, libraryPath, section) => buildSectionInWorker(libraryPath, section))

  ipcMain.handle('index:load',   (_, libraryPath) => loadIndex(libraryPath))
  ipcMain.handle('index:status', (_, libraryPath) => getIndexStatus(libraryPath))
  ipcMain.handle('index:delete', (_, libraryPath) => deleteIndex(libraryPath))

  // Bulk-add a category to each of the given castables (by display Name).
  // Used by the Spell Books tab in Constants: after persisting the spellbook
  // definition to constants.json, propagate the spellbook's name as a category
  // onto each listed castable's XML. Returns a per-castable result summary.
  // ── Lua environment setup ──────────────────────────────────────────────────
  // Copies the bundled Hybrasyl Lua type stubs into the active library's
  // world/scripts/.hybrasyl-types/ and writes a .luarc.json next to it so
  // the sumneko Lua language server (used by VS Code) picks up IntelliSense.
  ipcMain.handle('lua:setupEnvironment', async (_, libraryPath) => {
    if (!libraryPath) return { ok: false, error: 'No active library' }
    try {
      const scriptsDir = join(libraryPath, '..', 'scripts')
      const typesDir = join(scriptsDir, '.hybrasyl-types')
      const luarcDest = join(scriptsDir, '.luarc.json')

      // Source: bundled stubs from the app resources
      const stubsSrc = join(app.getAppPath(), 'lua-stubs')
      const luarcSrc = join(app.getAppPath(), 'resources', 'lua-annotations', '.luarc.json')

      await fs.mkdir(typesDir, { recursive: true })

      // Copy every .lua stub
      const stubs = (await fs.readdir(stubsSrc)).filter(f => f.endsWith('.lua'))
      for (const stub of stubs) {
        await fs.copyFile(join(stubsSrc, stub), join(typesDir, stub))
      }

      // Write .luarc.json (overwrite if exists — regenerated from bundled template)
      await fs.copyFile(luarcSrc, luarcDest)

      return { ok: true, stubsCopied: stubs.length, typesDir, luarcDest }
    } catch (err) {
      return { ok: false, error: err?.message || String(err) }
    }
  })

  // Open a world script file in the OS default application (typically VS Code
  // or whatever the user has registered for .lua). Accepts a relative path
  // under world/scripts/ (e.g. "castables/SkillWindblade" or "npc/Piet/Narve")
  // — no extension. Returns { ok, path } on success, { ok: false, error } on
  // failure (file missing, no library, etc.).
  ipcMain.handle('script:open', async (_, libraryPath, relativePath) => {
    if (!libraryPath || !relativePath) return { ok: false, error: 'Missing libraryPath or relativePath' }
    const scriptPath = join(libraryPath, '..', 'scripts', `${relativePath}.lua`)
    try {
      await fs.access(scriptPath)
    } catch {
      return { ok: false, error: `Script not found: ${scriptPath}` }
    }
    // Open the scripts FOLDER as a VS Code workspace + the file. This ensures
    // sumneko finds .luarc.json at the workspace root (which lives at
    // world/scripts/.luarc.json). If a window for this folder already exists,
    // VS Code reuses it; otherwise a new window opens.
    const scriptsDir = join(libraryPath, '..', 'scripts')
    try {
      const { spawn } = require('child_process')
      // Use shell: true so Windows resolves code.cmd (batch wrapper).
      // --new-window forces a separate window rooted at the scripts dir
      // so sumneko finds .luarc.json at the workspace root.
      const child = spawn('code', ['--new-window', scriptsDir, '--goto', scriptPath], {
        shell: true,
        detached: true,
        stdio: 'ignore',
      })
      child.unref()
      return { ok: true, path: scriptPath }
    } catch {
      // Fallback: OS default handler for .lua
      const failReason = await shell.openPath(scriptPath)
      if (failReason) return { ok: false, error: failReason }
      return { ok: true, path: scriptPath }
    }
  })

  ipcMain.handle('castable:addCategoryBulk', async (_, libraryPath, castableNames, categoryName) => {
    if (!libraryPath || !Array.isArray(castableNames) || !categoryName) {
      return { updated: [], unchanged: [], failed: [{ name: '(invalid args)', error: 'Missing libraryPath, castableNames, or categoryName' }] }
    }
    const index = await loadIndex(libraryPath)
    const filenames = index?.castableFilenames || {}
    const updated = []
    const unchanged = []
    const failed = []
    for (const name of castableNames) {
      const filename = filenames[name]
      if (!filename) { failed.push({ name, error: 'Not found in index' }); continue }
      const filePath = join(libraryPath, 'castables', filename)
      try {
        const xml = await fs.readFile(filePath, 'utf-8')
        const castable = await parseCastableXml(xml)
        const categories = Array.isArray(castable.categories) ? [...castable.categories] : []
        if (categories.includes(categoryName)) { unchanged.push(name); continue }
        categories.push(categoryName)
        const next = { ...castable, categories }
        const outXml = serializeCastableXml(next)
        await fs.writeFile(filePath, outXml, 'utf-8')
        updated.push(name)
      } catch (err) {
        failed.push({ name, error: err?.message || String(err) })
      }
    }
    return { updated, unchanged, failed }
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

  // Merge a set of index fields into the per-type files via hybindex-ts.
  // Each field routes to its owning file via FIELD_TO_FILE; the type argument
  // only affects the _meta.builtAt bump — any type works for aggregates.
  const updateIndexFields = async (libraryPath, fields) => {
    if (!fields || !Object.keys(fields).length) return
    await saveSection(libraryPath, 'castables', fields)
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
      await updateIndexFields(libraryPath, {
        itemCategories:          result.items.map(c => c.name),
        castableCategories:      result.castables.map(c => c.name),
        statusCategories:        result.statuses.map(c => c.name),
        itemCategoryDetails:     result.items,
        castableCategoryDetails: result.castables,
        statusCategoryDetails:   result.statuses,
      })
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
      await updateIndexFields(libraryPath, {
        vendorTabs:        details.map(t => t.name),
        vendorTabDetails:  details,
      })
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
      await updateIndexFields(libraryPath, {
        npcJobs:        details.map(j => j.name),
        npcJobDetails:  details,
      })
    } catch { /* non-fatal */ }
    return details
  })

  ipcMain.handle('constants:scanCreatureFamilies', async (_, libraryPath) => {
    const familyMap = {}
    try {
      const creaturesDir = join(libraryPath, 'creatures')
      const entries = await fs.readdir(creaturesDir, { withFileTypes: true })
      for (const entry of entries.filter(e => e.isFile() && e.name.endsWith('.xml'))) {
        const namePart = entry.name.replace(/\.xml$/i, '')
        const underscoreIdx = namePart.indexOf('_')
        if (underscoreIdx <= 0) continue
        const prefix = namePart.slice(0, underscoreIdx)
        if (!prefix) continue
        if (!familyMap[prefix]) familyMap[prefix] = { count: 0, usedBy: [] }
        familyMap[prefix].count++
        try {
          const content = await fs.readFile(join(creaturesDir, entry.name), 'utf-8')
          const nameMatch = /Name="([^"]+)"/.exec(content)
          const creatureName = nameMatch ? nameMatch[1].trim() : namePart
          if (familyMap[prefix].usedBy.length < 5) familyMap[prefix].usedBy.push(creatureName)
        } catch { /* skip name for this file */ }
      }
    } catch { /* dir may not exist */ }
    const details = Object.entries(familyMap)
      .map(([name, { count, usedBy }]) => ({ name, count, usedBy: count < 5 ? usedBy : [] }))
      .sort((a, b) => a.name.localeCompare(b.name))
    try {
      await updateIndexFields(libraryPath, {
        creatureFamilies:        details.map(f => f.name),
        creatureFamilyDetails:   details,
      })
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
      await updateIndexFields(libraryPath, {
        cookieNames: [...new Set(cookies.map(c => c.name))].sort(),
      })
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
    if (!libraryPath) return { vendorTabs: [], itemCategories: [], castableCategories: [], statusCategories: [], cookies: [], npcJobs: [], creatureFamilies: [] }
    return loadConstants(libraryPath)
  })

  ipcMain.handle('constants:saveUserConstants', async (_, libraryPath, data) => {
    if (!libraryPath) return
    await saveConstants(libraryPath, data)
  })

  // --- Formulas ---

  ipcMain.handle('formulas:load', async (_, libraryPath) => {
    if (!libraryPath) return { settings: {}, patterns: [], formulas: [] }
    return loadFormulas(libraryPath)
  })

  ipcMain.handle('formulas:save', async (_, libraryPath, data) => {
    if (!libraryPath) return
    await saveFormulas(libraryPath, data)
  })

  ipcMain.handle('formulas:import', async (_, libraryPath) => {
    if (!libraryPath) return null
    const window = BrowserWindow.getFocusedWindow()
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Import Formula Library',
      filters: [{ name: 'Lua Files', extensions: ['lua'] }],
      properties: ['openFile'],
    })
    if (canceled || !filePaths[0]) return null
    const existing = await loadFormulas(libraryPath)
    return importFormulas(filePaths[0], existing)
  })

  ipcMain.handle('formulas:castableInfo', async (_, libraryPath, castableName) => {
    if (!libraryPath || !castableName) return null
    try {
      // Try the index filename map first
      let filename = null
      try {
        const indexData = await loadIndex(libraryPath)
        filename = indexData?.castableFilenames?.[castableName]
      } catch { /* index not available */ }

      // Fallback: scan directory files for matching <Name> element
      if (!filename) {
        const castDir = join(libraryPath, 'castables')
        const entries = await fs.readdir(castDir)
        const nameLower = castableName.toLowerCase()
        for (const entry of entries.filter((e) => e.endsWith('.xml'))) {
          const content = await fs.readFile(join(castDir, entry), 'utf-8')
          const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
          if (nameMatch && nameMatch[1].trim().toLowerCase() === nameLower) {
            filename = entry
            break
          }
        }
      }

      if (!filename) return null
      const filePath = join(libraryPath, 'castables', filename)
      const xml = await fs.readFile(filePath, 'utf-8')
      const castable = await parseCastableXml(xml)
      return {
        lines: castable.lines ? Number(castable.lines) : null,
        cooldown: castable.cooldown ? Number(castable.cooldown) : null,
        book: castable.book || null,
      }
    } catch {
      return null
    }
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
      const indexData = await loadIndex(libraryPath)
      castableTrainers = indexData?.castableTrainers || {}
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
