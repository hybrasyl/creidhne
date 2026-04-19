import { join } from 'path'
import { promises as fs } from 'fs'

const DEFAULTS = {
  libraries: [],
  activeLibrary: null,
  theme: 'light',
  clientPath: null,
  taliesinPath: null,
  iconPickerMode: 'vanilla',
  nationCrestPickerMode: 'vanilla'
}

const PICKER_MODES = new Set(['vanilla', 'hybrasyl'])

function validate(data) {
  if (!data || typeof data !== 'object') return false
  if (!Array.isArray(data.libraries)) return false
  return true
}

function withDefaults(data) {
  return {
    libraries: Array.isArray(data?.libraries) ? data.libraries : DEFAULTS.libraries,
    activeLibrary: data?.activeLibrary ?? DEFAULTS.activeLibrary,
    theme: typeof data?.theme === 'string' ? data.theme : DEFAULTS.theme,
    clientPath: typeof data?.clientPath === 'string' ? data.clientPath : DEFAULTS.clientPath,
    taliesinPath:
      typeof data?.taliesinPath === 'string' ? data.taliesinPath : DEFAULTS.taliesinPath,
    iconPickerMode: PICKER_MODES.has(data?.iconPickerMode)
      ? data.iconPickerMode
      : DEFAULTS.iconPickerMode,
    nationCrestPickerMode: PICKER_MODES.has(data?.nationCrestPickerMode)
      ? data.nationCrestPickerMode
      : DEFAULTS.nationCrestPickerMode
  }
}

async function tryReadJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!validate(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function createSettingsManager(userDataPath) {
  const primary = join(userDataPath, 'settings.json')
  const backup = join(userDataPath, 'settings.bak.json')
  const tmp = join(userDataPath, 'settings.tmp.json')

  async function load() {
    let data = await tryReadJson(primary)
    if (data) return withDefaults(data)

    console.warn('settings.json unreadable, trying backup')
    data = await tryReadJson(backup)
    if (data) {
      console.warn('Recovered settings from backup')
      await save(withDefaults(data)) // rewrite primary from backup
      return withDefaults(data)
    }

    console.warn('No valid settings found, using defaults')
    return { ...DEFAULTS }
  }

  // Windows EPERM workaround: rename fails intermittently when antivirus or
  // file watchers (VS Code, Windows Search) hold a handle on the target.
  // Retry with backoff; if still stuck, unlink target then rename.
  async function renameWithRetry(src, dest, retries = 3, delay = 50) {
    for (let i = 0; i < retries; i++) {
      try { await fs.rename(src, dest); return } catch (err) {
        if (err.code !== 'EPERM' && err.code !== 'EACCES') throw err
        await new Promise((r) => setTimeout(r, delay * (i + 1)))
      }
    }
    // Final attempt: remove target first, then rename
    try { await fs.unlink(dest) } catch { /* target may not exist */ }
    await fs.rename(src, dest)
  }

  let saveQueue = Promise.resolve()

  function save(data) {
    saveQueue = saveQueue.then(async () => {
      const content = JSON.stringify(data, null, 2)
      await fs.mkdir(userDataPath, { recursive: true })
      // 1. Write to tmp
      await fs.writeFile(tmp, content, 'utf-8')
      // 2. Rotate: current primary → backup
      try {
        await fs.copyFile(primary, backup)
      } catch {
        /* primary may not exist yet */
      }
      // 3. Atomic rename tmp → primary (with retry for Windows EPERM)
      await renameWithRetry(tmp, primary)
    })
    return saveQueue
  }

  return { load, save }
}
