import { join } from 'path'
import { promises as fs } from 'fs'

const DEFAULTS = {
  libraries: [],
  activeLibrary: null,
  theme: 'light',
  clientPath: null,
}

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
  const backup  = join(userDataPath, 'settings.bak.json')
  const tmp     = join(userDataPath, 'settings.tmp.json')

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

  let saveQueue = Promise.resolve()

  function save(data) {
    saveQueue = saveQueue.then(async () => {
      const content = JSON.stringify(data, null, 2)
      await fs.mkdir(userDataPath, { recursive: true })
      // 1. Write to tmp
      await fs.writeFile(tmp, content, 'utf-8')
      // 2. Rotate: current primary → backup
      try { await fs.copyFile(primary, backup) } catch { /* primary may not exist yet */ }
      // 3. Atomic rename tmp → primary
      await fs.rename(tmp, primary)
    })
    return saveQueue
  }

  return { load, save }
}
