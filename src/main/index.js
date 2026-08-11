import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { basename, join } from 'path'
import { promises as fs, existsSync, mkdirSync, copyFileSync } from 'fs'
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
import { resolveSpellbook, nextCategories, sameCategorySet, affectedCastables } from './spellbook'
import { runCastableExport } from './exportCastables.js'
import { loadConstants, saveConstants } from './constantsJson.js'
import { loadFormulas, saveFormulas, importFormulas } from './formulasJson.js'
import { parseBehaviorSetXml, serializeBehaviorSetXml } from './behaviorSetXml'
import { parseSpawngroupXml, serializeSpawngroupXml } from './spawngroupXml'
import { parseServerConfigXml, serializeServerConfigXml } from './serverConfigXml'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createSettingsManager } from './settingsManager'
import { launchCompanion } from './launchCompanion.js'
import { createSplashWindow } from './splash.js'
import { assertInside, assertInsideAnyRoot } from './pathSafety.js'
import { applySettingsRoots, bless, allRoots } from './handlerContext.js'
import { parseOrLog } from './schemaLog.js'
import {
  settingsSchema,
  constantsSchema,
  constantsAddValueSchema,
  formulasSchema,
  rendererErrorSchema,
  openIssueSchema,
  copyReportSchema
} from './schemas/index.js'
import { initSessionLog, captureError, getLogsDir } from './sessionLog.js'
import { installGlobalErrorHandlers } from './errorHandlers.js'
import {
  initWindowSecurity,
  registerTrustedWindow,
  hardenWindow,
  guardIpc
} from './windowSecurity.js'
import { buildDiagnostics, openIssue, copyReport } from './diagnostics.js'
import {
  listSection,
  readFile,
  writeFile,
  moveFile,
  archiveFile,
  archiveFiles,
  unarchiveFiles,
  duplicateFile,
  readClientFile,
  checkClientPath
} from './fsHandlers'
import { checkForUpdates } from './updateCheck.js'
import { loadReference } from './referenceLoader.js'
import {
  buildIndexInWorker,
  buildSectionInWorker,
  loadIndex,
  getIndexStatus,
  deleteIndex
} from './indexService.js'
import { saveSection } from '@eriscorp/hybindex-ts'
import {
  loadPacks,
  listActivePacks,
  listCoveredIds,
  resolveAsset,
  resolveAssetUrl
} from './assetPacks/index.js'

// Local per-user app-data root. On Windows, Electron's app.getPath('cache')
// actually returns the ROAMING dir (Windows has no standard per-user cache dir,
// so Chromium falls back to %APPDATA%) — so resolve %LOCALAPPDATA% explicitly.
// macOS/Linux have no roaming concept; appData is already the right local dir.
function localAppDataDir() {
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA || join(app.getPath('home'), 'AppData', 'Local')
  }
  return app.getPath('appData')
}

// Settings + cache both under %LOCALAPPDATA%/Erisco/Creidhne (local). Settings
// previously lived in %APPDATA% (roaming); migrate once below so users keep
// their libraries/preferences. (The world index lives separately, under
// %LOCALAPPDATA%/Erisco/hybindex, managed by @eriscorp/hybindex-ts.)
const localBase = join(localAppDataDir(), 'Erisco', 'Creidhne')
const settingsPath = localBase
const cachePath = localBase
app.setPath('userData', cachePath)

// Single instance. A second copy would run a second world index, a second
// settings writer and a second session-log rotation over the same local app-data
// dir, which race each other and lose edits. The lock is keyed on the userData
// dir, so it must be requested *after* the setPath above.
//
// `app.exit(0)`, not `app.quit()`: everything below this line is module-scope
// side effect (the roaming migration copies files, initSessionLog touches and
// rotates the log set). `quit()` is async, so the losing instance would run all
// of it before the event loop got the chance to tear the process down. `exit()`
// stops here, which is what "did nothing" has to mean.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) app.exit(0)

// One-time roaming → local settings migration. Runs before the settings
// manager first reads, so a returning user's settings.json (libraries,
// activeLibrary, theme, clientPath/taliesinPath) carries over instead of
// resetting to defaults. Best-effort: any failure falls through to defaults.
function migrateSettingsFromRoaming() {
  try {
    const oldDir = join(app.getPath('appData'), 'Erisco', 'Creidhne')
    if (oldDir === settingsPath) return // same location (e.g. non-Windows) — nothing to do
    const newPrimary = join(settingsPath, 'settings.json')
    if (existsSync(newPrimary)) return // already migrated or fresh local settings exist
    const oldPrimary = join(oldDir, 'settings.json')
    if (!existsSync(oldPrimary)) return // nothing to migrate
    mkdirSync(settingsPath, { recursive: true })
    copyFileSync(oldPrimary, newPrimary)
    const oldBackup = join(oldDir, 'settings.bak.json')
    if (existsSync(oldBackup)) copyFileSync(oldBackup, join(settingsPath, 'settings.bak.json'))
  } catch {
    /* best effort — settings manager will fall back to defaults */
  }
}
migrateSettingsFromRoaming()

const settingsManager = createSettingsManager(settingsPath)

// Diagnostics: session logs live in a `logs/` subfolder of the local app-data dir
// (a clean "Reveal logs folder" target, separate from settings.json). Install the
// global error nets synchronously and early so a crash during startup is captured;
// kick off the session-file setup (touch + keep-5 rotation) best-effort.
const logsDir = join(localBase, 'logs')
installGlobalErrorHandlers(captureError)
void initSessionLog(logsDir)

// Gate every renderer-supplied path through the session's allowed roots
// (libraries + clientPath from settings, plus anything the user picked
// through a dialog this session). Throws on any path that isn't inside
// one of those roots — defence in depth against a renderer compromise
// addressing arbitrary disk locations.
const validatePath = (p) => assertInsideAnyRoot(allRoots(), p)

// Save dialogs used to offer a CSV filter no matter what was being saved, which
// was wrong the moment an export produced JSON. One entry, derived from the
// suggested file name — deliberately no "All Files" row, which would let the
// user save an extensionless file and change the existing CSV behaviour.
// `String(...)` guards the payload: it crosses IPC, and guardIpc checks the
// sender rather than what it sent.
const SAVE_FILTER_NAMES = { csv: 'CSV Files', json: 'JSON Files', txt: 'Text Files' }

const saveFiltersFor = (defaultName) => {
  const match = /\.([A-Za-z0-9]+)$/.exec(String(defaultName || ''))
  if (!match) return [{ name: 'All Files', extensions: ['*'] }]
  const ext = match[1].toLowerCase()
  return [{ name: SAVE_FILTER_NAMES[ext] || `${ext.toUpperCase()} Files`, extensions: [ext] }]
}

// Context passed to parseOrLog so breadcrumb failures land in
// <settingsPath>/ipc-validation.log alongside settings.json itself.
const schemaCtx = { settingsPath }

let closeConfirmed = false

// Splash + reveal coordination. The main window is created hidden and only
// shown once the renderer signals it has hydrated its settings ('app:ready'),
// so the first visible frame is already populated (no flash of empty UI).
let mainWindow = null
let splashWindow = null
let mainWindowRevealed = false

function revealMainWindow() {
  if (mainWindowRevealed) return
  mainWindowRevealed = true
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
  }
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.destroy()
  splashWindow = null
}

// The answer to a second launch: surface the window we already have. Restore
// first, so a minimised Creidhne actually comes forward instead of silently
// taking focus in the taskbar.
function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

// Registered before whenReady: the losing instance signals as soon as it fails
// the lock, which can land before this instance has finished booting.
app.on('second-instance', focusMainWindow)

function createWindow() {
  mainWindow = new BrowserWindow({
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
      contextIsolation: true,
      nodeIntegration: false,
      // The preload imports only `electron` (see src/preload/index.js), so the
      // renderer runs in the OS sandbox like the splash already did. Turning this
      // back off means auditing what the preload pulls in first — a sandboxed
      // preload's loader resolves `electron` and a few Node built-ins, nothing
      // else, so any package import re-breaks it (and only in the packaged app).
      sandbox: true
    }
  })

  mainWindow.on('close', (e) => {
    if (!closeConfirmed) {
      e.preventDefault()
      mainWindow.webContents.send('app:check-close')
    }
  })

  // Trusted before it loads: registerTrustedWindow is what lets this window's IPC
  // through guardIpc, and the guard fails closed, so registering after the load
  // would reject whatever the renderer sends during hydration.
  registerTrustedWindow(mainWindow)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html')).catch((err) => {
      console.error('Failed to load file:', err)
    })
  }

  mainWindow.on('ready-to-show', () => {
    // First launch is gated on the renderer's 'app:ready' signal (revealed by
    // revealMainWindow, which also tears down the splash). Only auto-show when
    // there's no splash — e.g. a window re-created on macOS activate.
    if (!splashWindow) mainWindow.show()
  })

  // Child windows denied, navigation away from our own bundle denied, and any
  // http(s)/mailto URL handed to the OS browser instead. The scheme allowlist is
  // what keeps `file:`/`smb:`/custom-scheme URLs out of shell.openExternal.
  hardenWindow(mainWindow, { allowExternal: true, openExternal: (url) => shell.openExternal(url) })

  return mainWindow
}

app.whenReady().then(async () => {
  // Must match electron-builder.yml `appId` exactly so Windows groups/pins the
  // taskbar entry and Task Manager identifies it as Creidhne (not "Electron").
  electronApp.setAppUserModelId('co.eris.creidhne')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Populate the path-safety roots before any IPC handler can fire so
  // settings-derived paths are accepted from the first request. Tolerates
  // a fresh install with no saved settings (applySettingsRoots no-ops).
  try {
    applySettingsRoots(await settingsManager.load())
  } catch {
    /* missing/corrupt settings — start with empty roots until first save */
  }

  // Record the renderer locations we trust, BEFORE any window loads. The IPC
  // guard fails closed against this list, so an empty list rejects everything —
  // the safe direction, but it makes this call load-bearing. Mirror createWindow's
  // dev/prod loader exactly.
  initWindowSecurity(
    is.dev && process.env['ELECTRON_RENDERER_URL']
      ? process.env['ELECTRON_RENDERER_URL']
      : undefined,
    join(__dirname, '../renderer/index.html')
  )

  // Every handler below registers through `ipc`, never the raw `ipcMain`, so the
  // sender check applies by construction rather than by each handler remembering
  // to ask for it. A new handler added on the raw import silently opts out — so
  // keep `ipcMain` unused past this point.
  const ipc = guardIpc(ipcMain)

  ipc.on('minimize-window', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) window.minimize()
  })

  ipc.on('maximize-window', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
    }
  })

  ipc.on('close-window', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) window.webContents.send('app:check-close')
  })

  ipc.on('app:confirm-close', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) {
      closeConfirmed = true
      window.close()
    }
  })
  ipc.handle('dialog:openFile', handleFileOpen)
  ipc.handle('dialog:openExeFile', handleExeFileOpen)
  ipc.handle('open-directory', handleDirectoryOpen)
  ipc.handle('app:launchCompanion', (_, exePath) => launchCompanion(settingsManager, exePath))
  ipc.handle('app:getVersion', () => app.getVersion())
  ipc.handle('app:checkForUpdates', () => checkForUpdates(app.getVersion()))
  // Open the local settings/cache dir (%LOCALAPPDATA%/Erisco/Creidhne) in the OS
  // file manager — surfaced from the Settings "About" card.
  ipc.handle('app:revealSettings', () => shell.openPath(settingsPath))

  // Report Issue / diagnostics. Renderer errors are forwarded here so main +
  // renderer failures share one scrubbed session log and one ring buffer.
  ipc.handle('diagnostics:reportRendererError', (_, payload) => {
    const p = parseOrLog(schemaCtx, 'diagnostics:reportRendererError', rendererErrorSchema, payload)
    captureError({ source: p.source, origin: 'renderer', message: p.message, stack: p.stack })
  })
  ipc.handle('diagnostics:build', () => buildDiagnostics({ version: app.getVersion() }))
  ipc.handle('diagnostics:openIssue', (_, payload) => {
    const p = parseOrLog(schemaCtx, 'diagnostics:openIssue', openIssueSchema, payload)
    return openIssue(p)
  })
  ipc.handle('diagnostics:copyReport', (_, payload) => {
    const p = parseOrLog(schemaCtx, 'diagnostics:copyReport', copyReportSchema, payload)
    return copyReport(p)
  })
  ipc.handle('diagnostics:revealLogs', () => shell.openPath(getLogsDir()))
  ipc.handle('reference:load', (_, libraryPath, type, name) =>
    loadReference(validatePath(libraryPath), type, name)
  )

  // Scan-style handler: swallow path-rejection into an empty result so the
  // renderer sees the same empty-state UX as a missing directory (doc §10 #2).
  // `type` needs its own traversal check: listSectionFiles joins it onto the
  // library internally, so validating libraryPath alone would still let a
  // renderer-supplied `../../..` escape.
  ipc.handle('fs:listSection', async (_, libraryPath, type) => {
    try {
      const lib = validatePath(libraryPath)
      assertInside(lib, type)
      return await listSection(lib, type)
    } catch {
      return { dir: '', active: [], archived: [] }
    }
  })
  ipc.handle('fs:readFile', (_, filePath) => readFile(validatePath(filePath)))
  ipc.handle('fs:writeFile', (_, filePath, content) => writeFile(validatePath(filePath), content))
  // `rel` needs its own traversal check, for the same reason `fs:listSection`'s
  // `type` does: resolveClientPath joins it onto the client root internally, so
  // validating clientPath alone would still let a renderer-supplied `../..`
  // escape.
  ipc.handle('fs:readClientFile', (_, clientPath, rel) => {
    const root = validatePath(clientPath)
    assertInside(root, rel)
    return readClientFile(root, rel)
  })
  ipc.handle('fs:checkClientPath', (_, clientPath) => checkClientPath(validatePath(clientPath)))

  ipc.handle('xml:loadItem', async (_, filePath) => {
    const xml = await fs.readFile(validatePath(filePath), 'utf-8')
    return parseItemXml(xml)
  })

  ipc.handle('xml:saveItem', async (_, filePath, itemData) => {
    const xml = serializeItemXml(itemData)
    await writeFile(validatePath(filePath), xml)
  })

  ipc.handle('xml:loadRecipe', async (_, filePath) => {
    const xml = await fs.readFile(validatePath(filePath), 'utf-8')
    return parseRecipeXml(xml)
  })

  ipc.handle('xml:saveRecipe', async (_, filePath, recipeData) => {
    const xml = serializeRecipeXml(recipeData)
    await writeFile(validatePath(filePath), xml)
  })

  ipc.handle('xml:loadNpc', async (_, filePath) => {
    const xml = await fs.readFile(validatePath(filePath), 'utf-8')
    return parseNpcXml(xml)
  })

  ipc.handle('xml:saveNpc', async (_, filePath, npcData) => {
    const xml = serializeNpcXml(npcData)
    await writeFile(validatePath(filePath), xml)
  })

  ipc.handle('xml:loadNation', async (_, filePath) => {
    const xml = await fs.readFile(validatePath(filePath), 'utf-8')
    return parseNationXml(xml)
  })

  ipc.handle('xml:saveNation', async (_, filePath, nationData) => {
    const xml = serializeNationXml(nationData)
    await writeFile(validatePath(filePath), xml)
  })

  ipc.handle('xml:loadLoot', async (_, filePath) => {
    const xml = await fs.readFile(validatePath(filePath), 'utf-8')
    return parseLootXml(xml)
  })

  ipc.handle('xml:saveLoot', async (_, filePath, lootData) => {
    const xml = serializeLootXml(lootData)
    await writeFile(validatePath(filePath), xml)
  })

  ipc.handle('xml:loadVariantGroup', async (_, filePath) => {
    const xml = await fs.readFile(validatePath(filePath), 'utf-8')
    return parseVariantXml(xml)
  })

  ipc.handle('xml:saveVariantGroup', async (_, filePath, variantGroupData) => {
    const xml = serializeVariantXml(variantGroupData)
    await writeFile(validatePath(filePath), xml)
  })

  ipc.handle('xml:loadLocalization', async (_, filePath) => {
    const xml = await fs.readFile(validatePath(filePath), 'utf-8')
    return parseLocalizationXml(xml)
  })

  ipc.handle('xml:saveLocalization', async (_, filePath, localizationData) => {
    const xml = serializeLocalizationXml(localizationData)
    await writeFile(validatePath(filePath), xml)
  })

  ipc.handle('xml:loadCreature', async (_, filePath) => {
    const xml = await fs.readFile(validatePath(filePath), 'utf-8')
    return parseCreatureXml(xml)
  })

  ipc.handle('xml:saveCreature', async (_, filePath, creatureData) => {
    const xml = serializeCreatureXml(creatureData)
    await writeFile(validatePath(filePath), xml)
  })

  ipc.handle('xml:loadElementTable', async (_, filePath) => {
    const xml = await fs.readFile(validatePath(filePath), 'utf-8')
    return parseElementTableXml(xml)
  })

  ipc.handle('xml:saveElementTable', async (_, filePath, tableData) => {
    const xml = serializeElementTableXml(tableData)
    await writeFile(validatePath(filePath), xml)
  })

  ipc.handle('xml:loadStatus', async (_, filePath) => {
    const xml = await fs.readFile(validatePath(filePath), 'utf-8')
    return parseStatusXml(xml)
  })

  ipc.handle('xml:saveStatus', async (_, filePath, statusData) => {
    const xml = serializeStatusXml(statusData)
    await writeFile(validatePath(filePath), xml)
  })

  ipc.handle('xml:loadCastable', async (_, filePath) => {
    const xml = await fs.readFile(validatePath(filePath), 'utf-8')
    return parseCastableXml(xml)
  })

  ipc.handle('xml:saveCastable', async (_, filePath, castableData) => {
    const xml = serializeCastableXml(castableData)
    await writeFile(validatePath(filePath), xml)
  })

  ipc.handle('xml:loadBehaviorSet', async (_, filePath) => {
    const xml = await fs.readFile(validatePath(filePath), 'utf-8')
    return parseBehaviorSetXml(xml)
  })

  ipc.handle('xml:saveBehaviorSet', async (_, filePath, bvsData) => {
    const xml = serializeBehaviorSetXml(bvsData)
    await writeFile(validatePath(filePath), xml)
  })

  ipc.handle('xml:loadSpawngroup', async (_, filePath) => {
    const xml = await fs.readFile(validatePath(filePath), 'utf-8')
    return parseSpawngroupXml(xml)
  })

  ipc.handle('xml:saveSpawngroup', async (_, filePath, sgData) => {
    const xml = serializeSpawngroupXml(sgData)
    await writeFile(validatePath(filePath), xml)
  })

  ipc.handle('xml:loadServerConfig', async (_, filePath) => {
    const xml = await fs.readFile(validatePath(filePath), 'utf-8')
    return parseServerConfigXml(xml)
  })

  ipc.handle('xml:saveServerConfig', async (_, filePath, cfgData) => {
    const xml = serializeServerConfigXml(cfgData)
    await writeFile(validatePath(filePath), xml)
  })

  ipc.handle('fs:moveFile', (_, src, dest) => moveFile(validatePath(src), validatePath(dest)))
  ipc.handle('fs:archiveFile', (_, src, archiveDir) =>
    archiveFile(validatePath(src), validatePath(archiveDir))
  )

  // Bulk file ops — accept arrays of paths so the renderer can dispatch a
  // multiselect action in one round-trip. Each result returns
  // { ok: [...], failed: [{ src, reason }] } so the UI can report partial
  // success without bailing the whole batch on a single failure.
  ipc.handle('fs:archiveFiles', (_, srcs, archiveDir) => {
    const validatedArchiveDir = validatePath(archiveDir)
    const validatedSrcs = (srcs || []).map((s) => validatePath(s))
    return archiveFiles(validatedSrcs, validatedArchiveDir)
  })

  ipc.handle('fs:duplicateFile', (_, src) => duplicateFile(validatePath(src)))

  ipc.handle('fs:unarchiveFiles', (_, srcs, destDir) => {
    const validatedDest = validatePath(destDir)
    const validatedSrcs = (srcs || []).map((s) => validatePath(s))
    return unarchiveFiles(validatedSrcs, validatedDest)
  })

  // shell.trashItem moves to the OS recycle bin (Windows Recycle Bin /
  // macOS Trash / Linux trash equivalent). OS-level undo is the user's
  // safety net — no in-app staging area.
  ipc.handle('fs:trashFiles', async (_, srcs) => {
    const ok = []
    const failed = []
    for (const src of srcs || []) {
      try {
        const validated = validatePath(src)
        await shell.trashItem(validated)
        ok.push({ src })
      } catch (err) {
        failed.push({ src, reason: err?.message || 'trash failed' })
      }
    }
    return { ok, failed }
  })

  // Handling settings load and save
  ipc.handle('settings:load', () => settingsManager.load())

  ipc.handle('settings:save', async (_, data) => {
    const parsed = parseOrLog(schemaCtx, 'settings:save', settingsSchema, data)
    const before = await settingsManager.load()
    await settingsManager.save(parsed)
    // Refresh path-safety roots in lockstep with the persisted settings so a
    // newly-added library, clientPath, or brigidAssetsPath becomes immediately valid.
    applySettingsRoots(parsed)
    // .datf packs are scanned from both the brigid assets dir and the DA client
    // dir; reload when either source path changes.
    if (
      before?.clientPath !== parsed?.clientPath ||
      before?.brigidAssetsPath !== parsed?.brigidAssetsPath
    ) {
      await loadPacks({
        brigidAssetsPath: parsed?.brigidAssetsPath || null,
        clientPath: parsed?.clientPath || null
      })
    }
  })

  // Hybrasyl asset packs (*.datf bundles in the brigid assets dir + DA client dir)
  ipc.handle('pack:listActive', () => listActivePacks())
  ipc.handle('pack:listCoveredIds', (_, subtype) => listCoveredIds(subtype))
  ipc.handle('pack:resolveAsset', async (_, subtype, id) => {
    const buf = await resolveAsset(subtype, id)
    if (!buf) return null
    return `data:image/png;base64,${buf.toString('base64')}`
  })
  // MIME-aware variant for non-PNG assets (e.g. sound_effects audio). Returns a
  // full data URL with the correct MIME inferred from the pack entry extension.
  ipc.handle('pack:resolveAssetUrl', (_, subtype, id) => resolveAssetUrl(subtype, id))

  // On-demand rescan of the .datf source dirs so packs dropped in while the app
  // is running get picked up (pickers call this on open). Re-reads the current
  // settings paths and reloads.
  ipc.handle('pack:reload', async () => {
    const s = await settingsManager.load()
    await loadPacks({
      brigidAssetsPath: s?.brigidAssetsPath || null,
      clientPath: s?.clientPath || null
    })
  })

  // Suggested default location for brigid's .datf packs, so the settings UI can
  // offer a "Use default" prefill. Mirrors brigid's AppPaths.AssetsDir:
  // %LOCALAPPDATA%\erisco\Brigid\assets on Windows.
  ipc.handle('pack:suggestedBrigidAssetsPath', () => {
    const localAppData = process.env.LOCALAPPDATA
    if (!localAppData) return null
    return join(localAppData, 'erisco', 'Brigid', 'assets')
  })

  // Initial pack load from saved source paths, if any.
  settingsManager
    .load()
    .then((s) =>
      loadPacks({
        brigidAssetsPath: s?.brigidAssetsPath || null,
        clientPath: s?.clientPath || null
      })
    )
    .catch(() => {})

  ipc.handle('get-user-data-path', async () => {
    return settingsPath
  })

  // --- Library index (via @eriscorp/hybindex-ts utilityProcess worker) ---

  ipc.handle('index:build', async (_, libraryPath) => {
    const index = await buildIndexInWorker(validatePath(libraryPath))
    return { success: true, builtAt: index.builtAt }
  })

  ipc.handle('index:buildSection', (_, libraryPath, section) =>
    buildSectionInWorker(validatePath(libraryPath), section)
  )

  ipc.handle('index:load', (_, libraryPath) => loadIndex(validatePath(libraryPath)))
  ipc.handle('index:status', (_, libraryPath) => getIndexStatus(validatePath(libraryPath)))
  ipc.handle('index:delete', (_, libraryPath) => deleteIndex(validatePath(libraryPath)))

  // Bulk-add a category to each of the given castables (by display Name).
  // Used by the Spell Books tab in Constants: after persisting the spellbook
  // definition to constants.json, propagate the spellbook's name as a category
  // onto each listed castable's XML. Returns a per-castable result summary.
  // ── Lua environment setup ──────────────────────────────────────────────────
  // Copies the bundled Hybrasyl Lua type stubs into the active library's
  // world/scripts/.hybrasyl-types/ and writes a .luarc.json next to it so
  // the sumneko Lua language server (used by VS Code) picks up IntelliSense.
  ipc.handle('lua:setupEnvironment', async (_, libraryPath) => {
    if (!libraryPath) return { ok: false, error: 'No active library' }
    try {
      validatePath(libraryPath)
      const scriptsDir = join(libraryPath, '..', 'scripts')
      const typesDir = join(scriptsDir, '.hybrasyl-types')
      const luarcDest = join(scriptsDir, '.luarc.json')

      // Source: bundled stubs from the app resources
      const stubsSrc = join(app.getAppPath(), 'lua-stubs')
      const luarcSrc = join(app.getAppPath(), 'resources', 'lua-annotations', '.luarc.json')

      await fs.mkdir(typesDir, { recursive: true })

      // Copy every .lua stub
      const stubs = (await fs.readdir(stubsSrc)).filter((f) => f.endsWith('.lua'))
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
  ipc.handle('script:open', async (_, libraryPath, relativePath) => {
    if (!libraryPath || !relativePath) {
      return { ok: false, error: 'Missing libraryPath or relativePath' }
    }
    try {
      validatePath(libraryPath)
    } catch (err) {
      return { ok: false, error: err.message }
    }
    const scriptsDir = join(libraryPath, '..', 'scripts')
    let scriptPath
    try {
      // Category-B guard: relativePath is renderer-supplied; assertInside
      // catches `../escape.lua` style attempts to read outside scripts/.
      scriptPath = assertInside(scriptsDir, `${relativePath}.lua`)
    } catch (err) {
      return { ok: false, error: err.message }
    }
    try {
      await fs.access(scriptPath)
    } catch {
      return { ok: false, error: `Script not found: ${scriptPath}` }
    }
    // Open the scripts FOLDER as a VS Code workspace + the file. This ensures
    // sumneko finds .luarc.json at the workspace root (which lives at
    // world/scripts/.luarc.json). If a window for this folder already exists,
    // VS Code reuses it; otherwise a new window opens.
    try {
      const { spawn } = require('child_process')
      // Use shell: true so Windows resolves code.cmd (batch wrapper).
      // --new-window forces a separate window rooted at the scripts dir
      // so sumneko finds .luarc.json at the workspace root.
      const child = spawn('code', ['--new-window', scriptsDir, '--goto', scriptPath], {
        shell: true,
        detached: true,
        stdio: 'ignore'
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

  ipc.handle('castable:addCategoryBulk', async (_, libraryPath, castableNames, categoryName) => {
    if (!libraryPath || !Array.isArray(castableNames) || !categoryName) {
      return {
        updated: [],
        unchanged: [],
        failed: [
          { name: '(invalid args)', error: 'Missing libraryPath, castableNames, or categoryName' }
        ]
      }
    }
    try {
      validatePath(libraryPath)
    } catch (err) {
      return {
        updated: [],
        unchanged: [],
        failed: [{ name: '(invalid path)', error: err.message }]
      }
    }
    const index = await loadIndex(libraryPath)
    const filenames = index?.castableFilenames || {}
    const updated = []
    const unchanged = []
    const failed = []
    for (const name of castableNames) {
      const filename = filenames[name]
      if (!filename) {
        failed.push({ name, error: 'Not found in index' })
        continue
      }
      const filePath = join(libraryPath, 'castables', filename)
      try {
        const xml = await fs.readFile(validatePath(filePath), 'utf-8')
        const castable = await parseCastableXml(xml)
        const categories = Array.isArray(castable.categories) ? [...castable.categories] : []
        if (categories.includes(categoryName)) {
          unchanged.push(name)
          continue
        }
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

  // Apply a spellbook to the world by reconciling the book-name category on the
  // castables it resolves to. A spellbook is a Creidhne authoring convenience:
  // its runtime effect is that every castable in the book carries the book's
  // name as a category, so a BehaviorSet can reference the whole book with one
  // category token. The book resolves to (individual castables) ∪ (all members
  // of each included category), using the index's castableCategoryMembers.
  //
  // book = { name, prevName?, castables: string[], categories: string[] }.
  // This is an idempotent reconcile, not an add: it stamps the book name onto
  // castables that should have it, strips it from castables that no longer
  // resolve, and (on rename) strips the previous name. Returns a summary; the
  // caller re-indexes the castables section afterward.
  ipc.handle('spellbook:apply', async (_, libraryPath, book) => {
    const fail = (name, error) => ({
      resolved: [],
      added: [],
      removed: [],
      unchanged: [],
      failed: [{ name, error }]
    })
    if (!libraryPath || !book || !book.name || !book.name.trim()) {
      return fail('(invalid args)', 'Missing libraryPath or book name')
    }
    try {
      validatePath(libraryPath)
    } catch (err) {
      return fail('(invalid path)', err.message)
    }

    const bookName = book.name.trim()
    const prevRaw = typeof book.prevName === 'string' ? book.prevName.trim() : ''
    const prevName = prevRaw && prevRaw !== bookName ? prevRaw : null

    const index = await loadIndex(libraryPath)
    const filenames = index?.castableFilenames || {}
    const members = index?.castableCategoryMembers || {}

    const resolvedList = resolveSpellbook(book, members)
    const resolvedSet = new Set(resolvedList)
    const affected = affectedCastables(resolvedList, bookName, prevName, members)

    const added = []
    const removed = []
    const unchanged = []
    const failed = []

    for (const name of affected) {
      const filename = filenames[name]
      if (!filename) {
        failed.push({ name, error: 'Not found in index' })
        continue
      }
      const filePath = join(libraryPath, 'castables', filename)
      try {
        const xml = await fs.readFile(validatePath(filePath), 'utf-8')
        const castable = await parseCastableXml(xml)
        const orig = Array.isArray(castable.categories) ? castable.categories : []
        const shouldHave = resolvedSet.has(name)
        const next = nextCategories(orig, { bookName, prevName, shouldHave })

        if (sameCategorySet(orig, next)) {
          unchanged.push(name)
          continue
        }
        await fs.writeFile(
          filePath,
          serializeCastableXml({ ...castable, categories: next }),
          'utf-8'
        )
        if (shouldHave) added.push(name)
        else removed.push(name)
      } catch (err) {
        failed.push({ name, error: err?.message || String(err) })
      }
    }

    return { resolved: resolvedList, added, removed, unchanged, failed }
  })

  // --- Constants (XSD simple types, categories, cookies) ---

  ipc.handle('constants:loadXsdTypes', async () => {
    const xsdDir = join(app.getAppPath(), 'xsd', 'src', 'XSD')
    const result = []
    try {
      const files = await fs.readdir(xsdDir)
      for (const fileName of files.filter((f) => f.endsWith('.xsd'))) {
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

  // Category details are already a first-class index field: hybindex derives
  // `<type>CategoryDetails` while indexing, in the same `{name, count, usedBy}`
  // shape this handler used to re-derive by regex over every active file. That
  // meant reading 3,096 files (2289 items + 581 castables + 226 statuses) to
  // reproduce what the package computes anyway, and keeping a second parser in
  // step with it. Verified byte-identical against the production world.
  //
  // Going through the worker rather than calling buildSection here keeps the
  // parse off the main thread, and its saveSection is passed the type it
  // actually built — unlike `updateIndexFields`, which hardcodes 'castables'
  // and so stamps that signature falsely fresh (§4.1).
  //
  // Sequential, deliberately: each build ends in a saveSection, and saveSection
  // read-modify-writes the shared `_filecache.json`. Running the three
  // concurrently would race that file and lose signature updates — the exact
  // clobber §4.2 describes. The win here is not reading 3,096 files; the
  // remaining serialism is three builds, not three thousand reads.
  const CATEGORY_SECTIONS = [
    ['items', 'itemCategoryDetails'],
    ['castables', 'castableCategoryDetails'],
    ['statuses', 'statusCategoryDetails']
  ]

  ipc.handle('constants:scanCategories', async (_, libraryPath) => {
    validatePath(libraryPath)
    const result = { items: [], castables: [], statuses: [] }
    for (const [type, detailField] of CATEGORY_SECTIONS) {
      try {
        const fields = await buildSectionInWorker(libraryPath, type)
        result[type] = fields?.[detailField] ?? []
      } catch {
        /* section dir may not exist — leave it empty */
      }
    }
    return result
  })

  ipc.handle('constants:scanVendorTabs', async (_, libraryPath) => {
    validatePath(libraryPath)
    const tabMap = {}
    try {
      const itemsDir = join(libraryPath, 'items')
      const { active } = await listSection(libraryPath, 'items')
      for (const rel of active) {
        const content = await fs.readFile(join(itemsDir, rel), 'utf-8')
        const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
        const itemName = nameMatch ? nameMatch[1].trim() : basename(rel).replace(/\.xml$/i, '')
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
    } catch {
      /* dir may not exist */
    }
    const details = Object.entries(tabMap)
      .map(([name, { count, usedBy }]) => ({ name, count, usedBy: count < 5 ? usedBy : [] }))
      .sort((a, b) => a.name.localeCompare(b.name))
    try {
      await updateIndexFields(libraryPath, {
        vendorTabs: details.map((t) => t.name),
        vendorTabDetails: details
      })
    } catch {
      /* non-fatal */
    }
    return details
  })

  ipc.handle('constants:scanNpcJobs', async (_, libraryPath) => {
    validatePath(libraryPath)
    const jobMap = {}
    try {
      const npcsDir = join(libraryPath, 'npcs')
      const { active } = await listSection(libraryPath, 'npcs')
      for (const rel of active) {
        // The job prefix comes from the filename, so derive it from the
        // basename — a rel path would read a parent directory as the prefix.
        const namePart = basename(rel).replace(/\.xml$/i, '')
        const underscoreIdx = namePart.indexOf('_')
        if (underscoreIdx <= 0) continue
        const prefix = namePart.slice(0, underscoreIdx)
        if (!prefix || prefix.toLowerCase() === 'npc') continue
        const content = await fs.readFile(join(npcsDir, rel), 'utf-8')
        const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
        const npcName = nameMatch ? nameMatch[1].trim() : namePart
        if (!jobMap[prefix]) jobMap[prefix] = { count: 0, usedBy: [] }
        jobMap[prefix].count++
        if (jobMap[prefix].usedBy.length < 5) jobMap[prefix].usedBy.push(npcName)
      }
    } catch {
      /* dir may not exist */
    }
    const details = Object.entries(jobMap)
      .map(([name, { count, usedBy }]) => ({ name, count, usedBy: count < 5 ? usedBy : [] }))
      .sort((a, b) => a.name.localeCompare(b.name))
    try {
      await updateIndexFields(libraryPath, {
        npcJobs: details.map((j) => j.name),
        npcJobDetails: details
      })
    } catch {
      /* non-fatal */
    }
    return details
  })

  ipc.handle('constants:scanCreatureFamilies', async (_, libraryPath) => {
    validatePath(libraryPath)
    const familyMap = {}
    try {
      const { active } = await listSection(libraryPath, 'creatures')
      for (const rel of active) {
        // Family prefix comes from the filename — see scanNpcJobs above.
        const namePart = basename(rel).replace(/\.xml$/i, '')
        const underscoreIdx = namePart.indexOf('_')
        if (underscoreIdx <= 0) continue
        const prefix = namePart.slice(0, underscoreIdx)
        if (!prefix) continue
        if (!familyMap[prefix]) familyMap[prefix] = { count: 0, usedBy: [] }
        familyMap[prefix].count++
        try {
          const content = await fs.readFile(join(libraryPath, 'creatures', rel), 'utf-8')
          const nameMatch = /Name="([^"]+)"/.exec(content)
          const creatureName = nameMatch ? nameMatch[1].trim() : namePart
          if (familyMap[prefix].usedBy.length < 5) familyMap[prefix].usedBy.push(creatureName)
        } catch {
          /* skip name for this file */
        }
      }
    } catch {
      /* dir may not exist */
    }
    const details = Object.entries(familyMap)
      .map(([name, { count, usedBy }]) => ({ name, count, usedBy: count < 5 ? usedBy : [] }))
      .sort((a, b) => a.name.localeCompare(b.name))
    try {
      await updateIndexFields(libraryPath, {
        creatureFamilies: details.map((f) => f.name),
        creatureFamilyDetails: details
      })
    } catch {
      /* non-fatal */
    }
    return details
  })

  ipc.handle('constants:scanCookies', async (_, libraryPath) => {
    validatePath(libraryPath)
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
              if (name && !cookies.some((c) => c.name === name && c.sourceFile === relPath)) {
                cookies.push({ name, sourceFile: relPath })
              }
            }
          }
        }
      } catch {
        /* dir may not exist */
      }
    }
    await scanDir(scriptsDir, scriptsDir)
    cookies.sort((a, b) => a.name.localeCompare(b.name))
    try {
      await updateIndexFields(libraryPath, {
        cookieNames: [...new Set(cookies.map((c) => c.name))].sort()
      })
    } catch {
      /* non-fatal */
    }
    return cookies
  })

  ipc.handle('constants:addValue', async (_, libraryPath, type, value) => {
    if (!libraryPath || !type || !value) return null
    validatePath(libraryPath)
    const parsed = parseOrLog(schemaCtx, 'constants:addValue', constantsAddValueSchema, {
      type,
      value
    })
    try {
      const constants = await loadConstants(libraryPath)
      const existing = constants[parsed.type] || []
      if (!existing.includes(parsed.value)) {
        constants[parsed.type] = [...existing, parsed.value].sort()
        await saveConstants(libraryPath, constants)
      }
      return constants
    } catch (e) {
      console.error('Error adding constant value:', e)
      return null
    }
  })

  ipc.handle('constants:loadUserConstants', async (_, libraryPath) => {
    if (!libraryPath)
      return {
        vendorTabs: [],
        itemCategories: [],
        castableCategories: [],
        statusCategories: [],
        cookies: [],
        npcJobs: [],
        creatureFamilies: []
      }
    return loadConstants(validatePath(libraryPath))
  })

  ipc.handle('constants:saveUserConstants', async (_, libraryPath, data) => {
    if (!libraryPath) return
    const parsed = parseOrLog(schemaCtx, 'constants:saveUserConstants', constantsSchema, data)
    await saveConstants(validatePath(libraryPath), parsed)
  })

  // --- Formulas ---

  ipc.handle('formulas:load', async (_, libraryPath) => {
    if (!libraryPath) return { settings: {}, patterns: [], formulas: [] }
    return loadFormulas(validatePath(libraryPath))
  })

  ipc.handle('formulas:save', async (_, libraryPath, data) => {
    if (!libraryPath) return
    const parsed = parseOrLog(schemaCtx, 'formulas:save', formulasSchema, data)
    await saveFormulas(validatePath(libraryPath), parsed)
  })

  ipc.handle('formulas:import', async (_, libraryPath) => {
    if (!libraryPath) return null
    validatePath(libraryPath)
    const window = BrowserWindow.getFocusedWindow()
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Import Formula Library',
      filters: [{ name: 'Lua Files', extensions: ['lua'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return null
    // Auto-bless the just-picked file so any subsequent reads of it pass.
    bless(filePaths[0])
    const existing = await loadFormulas(libraryPath)
    return importFormulas(filePaths[0], existing)
  })

  ipc.handle('formulas:castableInfo', async (_, libraryPath, castableName) => {
    if (!libraryPath || !castableName) return null
    validatePath(libraryPath)
    try {
      // Try the index filename map first
      let filename = null
      try {
        const indexData = await loadIndex(libraryPath)
        filename = indexData?.castableFilenames?.[castableName]
      } catch {
        /* index not available */
      }

      // Fallback: scan section files for a matching <Name> element. `filename`
      // is a type-relative rel path either way — the index map and listSection
      // agree on that key — so the join below resolves both.
      if (!filename) {
        const castDir = join(libraryPath, 'castables')
        const { active } = await listSection(libraryPath, 'castables')
        const nameLower = castableName.toLowerCase()
        for (const rel of active) {
          const content = await fs.readFile(join(castDir, rel), 'utf-8')
          const nameMatch = /<Name>([^<]+)<\/Name>/.exec(content)
          if (nameMatch && nameMatch[1].trim().toLowerCase() === nameLower) {
            filename = rel
            break
          }
        }
      }

      if (!filename) return null
      const filePath = join(libraryPath, 'castables', filename)
      const xml = await fs.readFile(validatePath(filePath), 'utf-8')
      const castable = await parseCastableXml(xml)
      return {
        lines: castable.lines ? Number(castable.lines) : null,
        cooldown: castable.cooldown ? Number(castable.cooldown) : null,
        book: castable.book || null
      }
    } catch {
      return null
    }
  })

  ipc.handle('dialog:saveFile', async (_, defaultName, content) => {
    const window = BrowserWindow.getFocusedWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(window, {
      defaultPath: defaultName,
      filters: saveFiltersFor(defaultName)
    })
    if (canceled || !filePath) return { canceled: true }
    // The user just picked this path — bless its parent so the write succeeds
    // and any follow-up read goes through validation cleanly.
    bless(filePath)
    await fs.writeFile(filePath, content, 'utf-8')
    return { canceled: false, filePath }
  })

  // Trainer names come from the world index. A library with no index still
  // exports; the Location column is simply empty.
  const castableExportContext = async (libraryPath) => {
    try {
      const indexData = await loadIndex(libraryPath)
      return { castableTrainers: indexData?.castableTrainers || {} }
    } catch {
      return { castableTrainers: {} }
    }
  }

  const castableExport = (presetId) => async (_, libraryPath) => {
    validatePath(libraryPath)
    const ctx = await castableExportContext(libraryPath)
    return runCastableExport(libraryPath, presetId, ctx)
  }

  ipc.handle('export:castablesBalancingCsv', castableExport('balancingCsv'))
  ipc.handle('export:castablesWebCsv', castableExport('webCsv'))
  ipc.handle('export:castablesWebJson', castableExport('webJson'))

  // Show the splash immediately, then create the (hidden) main window. Reveal
  // on the renderer's 'app:ready' signal, with a safety timeout so a renderer
  // that throws before signalling can't leave the app permanently invisible.
  splashWindow = createSplashWindow()
  ipc.on('app:ready', revealMainWindow)
  setTimeout(revealMainWindow, 15000)

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

// File handling functions. Each picker auto-blesses the path the user picked
// so any subsequent fs:* / xml:* handler can read or write that location
// without a separate "set active" round-trip — matches the user's mental
// model ("I picked it, of course I can read it").
async function handleFileOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog({})
  if (!canceled) {
    bless(filePaths[0])
    return filePaths[0]
  }
}

async function handleExeFileOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Executable', extensions: ['exe'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  if (!canceled) {
    bless(filePaths[0])
    return filePaths[0]
  }
}

async function handleDirectoryOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (!canceled) {
    bless(filePaths[0])
    return filePaths[0]
  }
}
