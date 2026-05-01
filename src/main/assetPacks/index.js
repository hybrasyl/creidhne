// Public API for .datf asset-pack loading. Replaces the old
// src/main/assetPackLoader.js — the exported names and behavior are
// preserved exactly. Internally, content_type → handler dispatch lives
// in handlers/index.js so each new pack format lands as a self-contained
// handler module.

import { promises as fs } from 'fs'
import { join } from 'path'
import unzipper from 'unzipper'
import { validateManifest } from './manifest.js'
import { getHandler } from './handlers/index.js'

// Single-active state: we only ever load packs for one client path at a time.
// Reloaded on client-path change; not watched for file changes within a session.
let state = { clientPath: null, packs: [] }

// Tracks the in-flight load so concurrent IPC getters can wait for it to
// finish. Without this, the renderer's initial listActivePacks() would race
// with main's startup load and return an empty array.
let pendingLoad = Promise.resolve()

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

  let rawManifest
  try {
    const buf = await manifestEntry.buffer()
    rawManifest = JSON.parse(buf.toString('utf8'))
  } catch (err) {
    console.warn(`[assetPackLoader] malformed manifest in ${filePath}: ${err.message}`)
    return null
  }

  const validation = validateManifest(rawManifest)
  if (!validation.ok) {
    console.warn(`[assetPackLoader] ${validation.reason} in ${filePath}`)
    return null
  }
  const manifest = validation.manifest

  const handler = getHandler(manifest.content_type)
  if (!handler) {
    console.warn(
      `[assetPackLoader] unknown content_type '${manifest.content_type}' in ${filePath}; ignoring`
    )
    return null
  }
  if (handler.status === 'out_of_scope') {
    // Valid Comhaigne content type that Creidhne deliberately doesn't
    // consume (e.g. ui_sprite_overrides — runtime-only UI art with no
    // editor surface). Silent skip: not a warning, not "unknown".
    return null
  }
  if (handler.status === 'planned') {
    console.warn(
      `[assetPackLoader] content_type '${manifest.content_type}' is registered but not yet implemented; ignoring ${filePath}`
    )
    return null
  }

  const entries = new Map() // handler-defined key → zip entry
  const coverage = new Map() // subtype → Set<id>
  for (const zipEntry of directory.files) {
    if (zipEntry.path === '_manifest.json') continue
    if (zipEntry.type && zipEntry.type !== 'File') continue
    const parsed = handler.parseEntry(zipEntry.path)
    if (!parsed) continue
    entries.set(parsed.key, zipEntry)
    if (!coverage.has(parsed.subtype)) coverage.set(parsed.subtype, new Set())
    coverage.get(parsed.subtype).add(parsed.id)
  }

  return {
    filePath,
    fileName: filePath.split(/[\\/]/).pop(),
    manifest,
    handler,
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

// IPC-safe summaries (strip zip-entry references and the handler instance).
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
// subtype is the filename prefix — 'spell', 'skill', 'nation', 'legend', etc.
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
    const key = pack.handler.keyFor(subtype, id)
    if (!key) continue
    const entry = pack.entries.get(key)
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
