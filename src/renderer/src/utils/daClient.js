// Renderer-side helpers for reading Dark Ages client files via dalib-ts.
//
// Architecture:
//   - Main process serves raw bytes via window.electronAPI.readBinaryFile()
//   - dalib-ts parsing happens here in the renderer (DataArchive instances
//     aren't serializable across IPC)
//   - Module-level cache keeps parsed archives in memory until the user
//     changes clientPath (call clearArchiveCache() then)

import { DataArchive } from '@eriscorp/dalib-ts'

const archiveCache = new Map() // key: full archive path, value: DataArchive

function joinPath(clientPath, relative) {
  // Both '/' and '\' work on Windows for fs APIs. Normalize separators in the
  // relative part so callers can pass either.
  const sep = clientPath.includes('\\') ? '\\' : '/'
  const norm = relative.replace(/[\\/]+/g, sep)
  const trimmed = clientPath.replace(/[\\/]+$/, '')
  return `${trimmed}${sep}${norm}`
}

/**
 * Read a binary file from the DA client directory and return it as a Uint8Array.
 *
 * @param {string} clientPath  Full path to DA client install directory.
 * @param {string} relative    Path relative to clientPath, e.g. 'legend.dat' or 'item001.epf'.
 * @returns {Promise<Uint8Array>}
 */
export async function readClientFile(clientPath, relative) {
  if (!clientPath) throw new Error('Dark Ages client path not configured')
  const fullPath = joinPath(clientPath, relative)
  const buffer = await window.electronAPI.readBinaryFile(fullPath)
  // IPC returns a Node Buffer; wrap in Uint8Array for dalib-ts.
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
}

/**
 * Load and parse a dat archive. Cached by full path; subsequent calls return
 * the same DataArchive instance.
 *
 * @param {string} clientPath
 * @param {string} archiveName  Path relative to clientPath, e.g. 'legend.dat' or 'npc/npc.dat'.
 * @returns {Promise<DataArchive>}
 */
export async function loadArchive(clientPath, archiveName) {
  if (!clientPath) throw new Error('Dark Ages client path not configured')
  const fullPath = joinPath(clientPath, archiveName)
  const cached = archiveCache.get(fullPath)
  if (cached) return cached

  const bytes = await readClientFile(clientPath, archiveName)
  const archive = DataArchive.fromBuffer(bytes)
  archiveCache.set(fullPath, archive)
  return archive
}

/**
 * Drop all cached archives. Call when clientPath changes so stale parses
 * from the old location are not reused.
 */
export function clearArchiveCache() {
  archiveCache.clear()
}

// ── Cache clearing registry ───────────────────────────────────────────────────
// Picker data modules (e.g. itemSpriteData.js) register a cleanup fn so that
// DAClientPathSection can flush everything at once when clientPath changes,
// without knowing which pickers exist.

const cacheClearers = new Set()

/**
 * Register a function to be called when client-path caches should be flushed.
 * Returns an unregister function.
 */
export function registerCacheClearer(fn) {
  cacheClearers.add(fn)
  return () => cacheClearers.delete(fn)
}

/** Flush every registered cache plus the archive cache. */
export function clearAllClientCaches() {
  for (const fn of cacheClearers) {
    try { fn() } catch { /* keep flushing others */ }
  }
  clearArchiveCache()
}
