import { promises as fs } from 'fs'
import { join } from 'path'
import unzipper from 'unzipper'

// Single-active state: we only ever load packs for one client path at a time.
// Reloaded on client-path change; not watched for file changes within a session.
let state = { clientPath: null, packs: [] }

// Tracks the in-flight load so concurrent IPC getters can wait for it to
// finish. Without this, the renderer's initial listActivePacks() would race
// with main's startup load and return an empty array.
let pendingLoad = Promise.resolve()

const FILENAME_PATTERN = /^([a-z]+)(\d+)\.(png|webp)$/i

// Parse a ZIP entry path like "skill0042.png" → { subtype: 'skill', id: 42 }.
// Subdirectories are flattened (we only look at the basename), non-matching
// files are ignored.
function parseEntryFilename(name) {
  const base = name.split('/').pop()
  const m = FILENAME_PATTERN.exec(base)
  if (!m) return null
  return { subtype: m[1].toLowerCase(), id: parseInt(m[2], 10) }
}

async function loadPack(filePath) {
  let directory
  try {
    directory = await unzipper.Open.file(filePath)
  } catch (err) {
    console.warn(`[assetPackLoader] cannot open ${filePath}: ${err.message}`)
    return null
  }

  const manifestEntry = directory.files.find((f) => f.path === '_manifest.json')
  if (!manifestEntry) {
    console.warn(`[assetPackLoader] no _manifest.json in ${filePath}`)
    return null
  }

  let manifest
  try {
    const buf = await manifestEntry.buffer()
    manifest = JSON.parse(buf.toString('utf8'))
  } catch (err) {
    console.warn(`[assetPackLoader] malformed manifest in ${filePath}: ${err.message}`)
    return null
  }

  if (manifest.schema_version !== 1) {
    console.warn(
      `[assetPackLoader] unsupported schema_version ${manifest.schema_version} in ${filePath}`
    )
    return null
  }

  const entries = new Map() // "skill:42" → zip entry
  const coverage = new Map() // "skill" → Set<number>
  for (const zipEntry of directory.files) {
    if (zipEntry.path === '_manifest.json') continue
    if (zipEntry.type && zipEntry.type !== 'File') continue
    const parsed = parseEntryFilename(zipEntry.path)
    if (!parsed) continue
    entries.set(`${parsed.subtype}:${parsed.id}`, zipEntry)
    if (!coverage.has(parsed.subtype)) coverage.set(parsed.subtype, new Set())
    coverage.get(parsed.subtype).add(parsed.id)
  }

  return {
    filePath,
    fileName: filePath.split(/[\\/]/).pop(),
    manifest,
    entries,
    coverage
  }
}

// Scan a client-path for *.datf files and load each. Called on app start +
// whenever the user changes the client path.
export function loadPacksForClientPath(clientPath) {
  pendingLoad = (async () => {
    state = { clientPath, packs: [] }
    if (!clientPath) return

    let files = []
    try {
      files = await fs.readdir(clientPath)
    } catch {
      return
    }

    const datfFiles = files.filter((f) => f.toLowerCase().endsWith('.datf'))
    for (const f of datfFiles) {
      const pack = await loadPack(join(clientPath, f))
      if (pack) state.packs.push(pack)
    }

    // Higher priority resolves first.
    state.packs.sort((a, b) => (b.manifest.priority ?? 0) - (a.manifest.priority ?? 0))
  })()
  return pendingLoad
}

// IPC-safe summaries (strip zip-entry references).
// Awaits any in-flight load so the renderer can't race the startup path.
export async function listActivePacks() {
  await pendingLoad
  return state.packs.map((p) => ({
    fileName: p.fileName,
    manifest: p.manifest,
    coveredSubtypes: Array.from(p.coverage.keys())
  }))
}

// Sorted array of IDs covered by any active pack for this subtype.
// subtype is the filename prefix — 'spell', 'skill', 'nation', etc.
export async function listCoveredIds(subtype) {
  await pendingLoad
  const merged = new Set()
  for (const pack of state.packs) {
    const set = pack.coverage.get(subtype)
    if (set) for (const id of set) merged.add(id)
  }
  return Array.from(merged).sort((a, b) => a - b)
}

// Returns a PNG buffer from the highest-priority pack covering (subtype, id),
// or null if no pack covers it.
export async function resolveAsset(subtype, id) {
  await pendingLoad
  for (const pack of state.packs) {
    const entry = pack.entries.get(`${subtype}:${id}`)
    if (!entry) continue
    try {
      return await entry.buffer()
    } catch (err) {
      console.warn(
        `[assetPackLoader] failed reading ${subtype}${id} from ${pack.fileName}: ${err.message}`
      )
    }
  }
  return null
}

// Test hook — reset state between tests.
export function _resetForTests() {
  state = { clientPath: null, packs: [] }
  pendingLoad = Promise.resolve()
}
