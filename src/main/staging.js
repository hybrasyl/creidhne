import { promises as fs } from 'fs'
import { join, normalize, relative, isAbsolute } from 'path'
import { listSectionFiles, isArchivedPath } from '@eriscorp/hybindex-ts'
import { STAGED_TYPES, STAGING_DIR } from '../shared/staging.js'
import { moveFile } from './fsHandlers.js'
import { referencedNames } from './entityRefScan.js'

/**
 * Staging on disk (HTOO-453). `src/shared/staging.js` says what staging is; this
 * module moves files in and out of it and lists what is there.
 *
 * Main computes both ends of every move from the library and the type. The
 * renderer names only the files, so it cannot move a file anywhere other than
 * the other side of the same type.
 */

/** `<world>/xml` → `<world>/.staging`. */
export function stagingRoot(libraryPath) {
  return normalize(join(libraryPath, '..', STAGING_DIR))
}

function assertStagedType(type) {
  if (!STAGED_TYPES.includes(type)) throw new Error(`staging: "${type}" cannot be staged`)
}

/**
 * The staged files of one type, as the panel lists them. A `.ignore/` folder
 * inside staging is not listed: staging has no archive, and Save there renames.
 */
export async function listStaged(libraryPath, type) {
  assertStagedType(type)
  const { dir, active } = await listSectionFiles(stagingRoot(libraryPath), type)
  return { dir: dir.replace(/\\/g, '/'), files: active }
}

/** `src` relative to `fromDir`, forward-slashed, or null when it is not inside. */
function relWithin(fromDir, src) {
  const rel = relative(fromDir, src)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null
  return rel.replace(/\\/g, '/')
}

/**
 * Move each file from `fromDir` to the same relative path under `toDir`.
 * Settles each file on its own, like the archive helpers, and returns
 * `{ ok: [{ src, dest }], failed: [{ src, reason }] }`.
 *
 * A file that is not inside `fromDir` fails with `outside`, and an archived one
 * with `archived`: an archived file is out of service, and Unarchive is its way
 * back. A file whose destination exists fails with `conflict` and does not
 * move, because the other file is someone's work.
 */
export async function transferFiles(srcs, fromDir, toDir) {
  const ok = []
  const failed = []
  for (const src of srcs || []) {
    const rel = relWithin(fromDir, src)
    if (!rel) {
      failed.push({ src, reason: 'outside' })
      continue
    }
    if (isArchivedPath(rel)) {
      failed.push({ src, reason: 'archived' })
      continue
    }
    const dest = join(toDir, rel)
    try {
      const r = await moveFile(src, dest)
      if (r?.conflict) failed.push({ src, reason: 'conflict' })
      else ok.push({ src, dest: dest.replace(/\\/g, '/') })
    } catch (err) {
      failed.push({ src, reason: err?.message || 'move failed' })
    }
  }
  return { ok, failed }
}

/** Live → staged. */
export function stageFiles(libraryPath, type, srcs) {
  assertStagedType(type)
  return transferFiles(srcs, join(libraryPath, type), join(stagingRoot(libraryPath), type))
}

/** Staged → live. */
export function releaseFiles(libraryPath, type, srcs) {
  assertStagedType(type)
  return transferFiles(srcs, join(stagingRoot(libraryPath), type), join(libraryPath, type))
}

/**
 * The names each file refers to, by the type each name belongs to:
 * `{ [path]: { [targetType]: string[] } }`. A file that cannot be read maps to
 * `{}`: a check over it then finds nothing, and the save or move that follows
 * reports the real error.
 */
export async function namesInFiles(paths, type) {
  const out = {}
  for (const p of paths || []) {
    try {
      out[p] = referencedNames(await fs.readFile(p, 'utf8'), type)
    } catch {
      out[p] = {}
    }
  }
  return out
}
