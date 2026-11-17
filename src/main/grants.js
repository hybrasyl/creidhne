/**
 * Filesystem and program authority that main owns (HTOO-679).
 *
 * The renderer writes settings.json, so settings.json cannot be the record of
 * what the renderer may touch. This module keeps that record in `grants.json`,
 * beside settings.json, in a folder that no IPC root covers. Only main writes
 * it, and only from three sources:
 *
 * 1. A native dialog result (the user chose the path).
 * 2. A path that main computes itself (the suggested Brigid assets folder).
 * 3. The one-time migration, which accepts the paths in an existing
 *    settings.json once, when grants.json does not exist yet.
 *
 * A path in settings becomes an IPC root only when it is inside a grant or a
 * dialog result from this session. A settings save cannot add authority. It
 * can only keep or drop it.
 *
 * The Taliesin override is recorded with its size, mtime and SHA-256. Main
 * checks the file again before each launch, so a file that changed after the
 * user chose it does not run.
 *
 * Taliesin has the same model (its `docs/authority-model.md`); keep the two
 * aligned.
 */
import { createHash } from 'crypto'
import { createReadStream, promises as fs } from 'fs'
import { dirname, join } from 'path'
import { z } from 'zod'
import { isFilesystemRoot, isInsideAnyRoot } from './pathSafety.js'

export const GRANTS_FILENAME = 'grants.json'
export const GRANTS_VERSION = 1

const execGrantSchema = z.object({
  path: z.string().min(1),
  size: z.number(),
  mtimeMs: z.number(),
  sha256: z.string().nullable(),
  isDirectory: z.boolean()
})

const grantsFileSchema = z.object({
  version: z.literal(GRANTS_VERSION),
  dirs: z.array(z.string().min(1)),
  executables: z.object({ taliesin: execGrantSchema.optional() }).default({})
})

/** @returns {{ dirs: Set<string>, executables: { taliesin?: object }, persist?: (data: object) => Promise<void> }} */
export function emptyGrants() {
  return { dirs: new Set(), executables: {} }
}

export function snapshotGrants(g) {
  return { version: GRANTS_VERSION, dirs: [...g.dirs].sort(), executables: { ...g.executables } }
}

/**
 * Every folder path in a settings snapshot. A filesystem root is left out: it
 * is never a grant. The Taliesin override is not here; it is a program.
 */
export function settingsDirPaths(s) {
  const out = new Set()
  const add = (p) => {
    if (typeof p === 'string' && p.length > 0 && !isFilesystemRoot(p)) out.add(p)
  }
  for (const l of Array.isArray(s?.libraries) ? s.libraries : []) add(l)
  add(s?.activeLibrary)
  add(s?.clientPath)
  add(s?.brigidAssetsPath)
  return [...out]
}

/**
 * True when `p` is inside a persisted grant or a path the user chose in a
 * dialog this session. Lexical only: the real-path check happens at I/O.
 */
export function isGranted(g, sessionRoots, p) {
  if (isFilesystemRoot(p)) return false
  return isInsideAnyRoot(g.dirs, p) || isInsideAnyRoot(sessionRoots, p)
}

async function sha256File(path) {
  const hash = createHash('sha256')
  await new Promise((resolve, reject) => {
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve())
  })
  return hash.digest('hex')
}

/** Measure a program for a grant. Throws when the path does not exist. */
export async function measureExecutable(path) {
  const st = await fs.stat(path)
  const isDirectory = st.isDirectory()
  return {
    path,
    size: isDirectory ? 0 : st.size,
    mtimeMs: st.mtimeMs,
    sha256: isDirectory ? null : await sha256File(path),
    isDirectory
  }
}

/**
 * Check a program grant against the disk before it runs.
 *
 * The file is hashed again only when its size or mtime changed. When the hash
 * still matches, the grant takes the new size and mtime and `changed` is true,
 * so the caller can persist it. Throws when the file is gone or its content
 * changed.
 */
export async function verifyExecutable(grant) {
  let st
  try {
    st = await fs.stat(grant.path)
  } catch {
    throw new Error(`The program you chose is missing: ${grant.path}. Choose it again in Settings.`)
  }
  if (grant.isDirectory) {
    if (!st.isDirectory()) throw new Error(`The program you chose changed: ${grant.path}.`)
    return { grant, changed: false }
  }
  if (st.size === grant.size && st.mtimeMs === grant.mtimeMs) return { grant, changed: false }
  const sha = await sha256File(grant.path)
  if (sha !== grant.sha256) {
    throw new Error(
      `The program at ${grant.path} changed after you chose it. Choose it again in Settings.`
    )
  }
  return { grant: { ...grant, size: st.size, mtimeMs: st.mtimeMs }, changed: true }
}

/**
 * Load grants.json, or run the one-time migration when it does not exist.
 *
 * A file that exists but does not parse gives an empty state (fail closed):
 * the user chooses the folders again. Only main writes the file, through a
 * temporary file and a rename, so a damaged file is not an ordinary event.
 */
export async function loadOrMigrateGrants(settingsDir, settings, log = () => undefined) {
  const path = join(settingsDir, GRANTS_FILENAME)
  const persist = (data) => writeGrantsFile(path, data)
  let raw = null
  try {
    raw = await fs.readFile(path, 'utf-8')
  } catch (e) {
    if (e?.code !== 'ENOENT') throw e
  }
  if (raw !== null) {
    try {
      const data = grantsFileSchema.parse(JSON.parse(raw))
      return { dirs: new Set(data.dirs), executables: data.executables, persist }
    } catch (e) {
      log(`grants.json is not valid and was ignored: ${e instanceof Error ? e.message : e}`)
      return { ...emptyGrants(), persist }
    }
  }

  // Migration: accept what settings.json already names, once.
  const state = { dirs: new Set(settingsDirPaths(settings)), executables: {}, persist }
  if (settings?.taliesinPath) {
    try {
      state.executables.taliesin = await measureExecutable(settings.taliesinPath)
    } catch {
      log(
        `taliesinPath from settings.json is missing and was not accepted: ${settings.taliesinPath}`
      )
    }
  }
  await persist(snapshotGrants(state))
  return state
}

async function writeGrantsFile(path, data) {
  await fs.mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
  await fs.rename(tmp, path)
}
