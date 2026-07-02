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

// Single-active state: the merged set of packs loaded from the currently
// configured source directories. Reloaded whenever a source path changes;
// not watched for file changes within a session.
let state = { sources: [], packs: [] }

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

  // Two indexing paths. Flat-schema types (ability_icons, nation_badges, …)
  // derive coverage per-file via parseEntry. Manifest-driven types
  // (npc_portraits, …) need the whole manifest — the key→file mapping lives in
  // `covers`, not the filename — so they implement buildIndex(manifest, files)
  // and own the entries/coverage construction wholesale.
  let entries // handler-defined key → zip entry
  let coverage // subtype → Set<id>
  if (typeof handler.buildIndex === 'function') {
    const built = handler.buildIndex(manifest, directory.files)
    entries = built.entries
    coverage = built.coverage
  } else {
    entries = new Map()
    coverage = new Map()
    for (const zipEntry of directory.files) {
      if (zipEntry.path === '_manifest.json') continue
      if (zipEntry.type && zipEntry.type !== 'File') continue
      const parsed = handler.parseEntry(zipEntry.path)
      if (!parsed) continue
      entries.set(parsed.key, zipEntry)
      if (!coverage.has(parsed.subtype)) coverage.set(parsed.subtype, new Set())
      coverage.get(parsed.subtype).add(parsed.id)
    }
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

// List one directory's *.datf files (top-level, sorted) with their stat info.
// Mirrors brigid's TopDirectoryOnly discovery. Missing/unreadable dirs yield an
// empty list. The readdir happens once here and is reused for both the change
// signature and the actual load, so we never scan a dir twice per loadPacks.
async function listDatfFiles(dir) {
  if (!dir) return []
  let files = []
  try {
    files = await fs.readdir(dir)
  } catch {
    return []
  }
  const datf = files.filter((f) => f.toLowerCase().endsWith('.datf')).sort()
  const out = []
  for (const f of datf) {
    const filePath = join(dir, f)
    let sig = `${f}:?`
    try {
      const st = await fs.stat(filePath)
      sig = `${f}:${st.mtimeMs}:${st.size}`
    } catch {
      /* keep the '?' marker — still a stable per-file signature */
    }
    out.push({ filePath, sig: `${dir}|${sig}` })
  }
  return out
}

// Scan every configured source directory for *.datf files and load each into
// one merged set. Called on app start + whenever a source path changes, and on
// every picker-open rescan — so it short-circuits (a cheap readdir+stat) when
// the .datf set is unchanged, skipping the expensive re-open/unzip of every
// pack. Packs are otherwise not watched for changes within a session.
// Sources are scanned in order (brigid assets dir first, then the DA client
// dir); ties in priority resolve to the first source scanned.
export function loadPacks({ brigidAssetsPath = null, clientPath = null } = {}) {
  pendingLoad = (async () => {
    const sources = [brigidAssetsPath, clientPath].filter(Boolean)
    const listings = []
    for (const dir of sources) listings.push(await listDatfFiles(dir))

    const signature = listings
      .flat()
      .map((e) => e.sig)
      .join('\n')
    // Nothing changed since the last load — keep the already-parsed packs and
    // skip re-opening/unzipping every .datf.
    if (state.signature != null && signature === state.signature) return

    const packs = []
    for (const listing of listings) {
      for (const { filePath } of listing) {
        const pack = await loadPack(filePath)
        if (pack) packs.push(pack)
      }
    }
    // Higher priority resolves first. Stable sort preserves source order for ties.
    packs.sort((a, b) => (b.manifest.priority ?? 0) - (a.manifest.priority ?? 0))
    state = { sources, packs, signature }
  })()
  return pendingLoad
}

// Back-compat wrapper: scan a single client path. Retained so existing
// callers/tests that only know about the DA client dir keep working.
export function loadPacksForClientPath(clientPath) {
  return loadPacks({ clientPath })
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
  const ids = Array.from(merged)
  // Numeric subtypes (nation, item, skill…) sort numerically; string-keyed
  // subtypes (npcportrait) sort lexicographically.
  return ids.every((x) => typeof x === 'number')
    ? ids.sort((a, b) => a - b)
    : ids.sort((a, b) => String(a).localeCompare(String(b)))
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

// MIME lookup for building data URLs. Covers the image extensions used by the
// flat/manifest handlers and the audio extensions used by sound_effects.
const MIME_BY_EXT = {
  png: 'image/png',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac'
}

// Like resolveAsset, but returns a ready-to-use `data:<mime>;base64,…` URL with
// the MIME inferred from the covering entry's file extension. General across
// image and audio packs — image canvases can use resolveAsset (raw buffer),
// audio needs the correct MIME, so it uses this. Returns null when uncovered.
export async function resolveAssetUrl(subtype, id) {
  await pendingLoad
  for (const pack of state.packs) {
    const key = pack.handler.keyFor(subtype, id)
    if (!key) continue
    const entry = pack.entries.get(key)
    if (!entry) continue
    try {
      const buf = await entry.buffer()
      const ext = String(entry.path).split('.').pop().toLowerCase()
      const mime = MIME_BY_EXT[ext] || 'application/octet-stream'
      return `data:${mime};base64,${buf.toString('base64')}`
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
  state = { sources: [], packs: [] }
  pendingLoad = Promise.resolve()
}
