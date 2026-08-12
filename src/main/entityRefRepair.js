import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { listSectionFiles } from '@eriscorp/hybindex-ts'
import { findReferences, rewriteReferences, scanPlan } from './entityRefScan.js'

/**
 * The world-facing half of HTOO-378: walk the files that can name an entity,
 * count what names it, and repoint them when the user accepts.
 *
 * `entityReferences.js` says WHERE a name can sit and `entityRefScan.js` does
 * the string work on one document. This module is the part that touches disk.
 *
 * ## Two passes, and they are deliberately separate
 *
 * `scanReferences` reads and reports; `applyRename` reads and writes. Nothing is
 * written until the user has answered, so the count they are shown describes the
 * files as they stand rather than as they were some time before the dialog
 * opened. The apply pass re-reads rather than trusting the scan's list, so a file
 * edited outside Creidhne between the two is re-examined instead of being
 * rewritten from a stale premise.
 *
 * ## `.ignore/` is never scanned
 *
 * Archived files are out of service, so their references resolve against nothing
 * either way. `listSectionFiles` already separates the two, so this is a matter
 * of reading one of its two lists. The trade is real and worth stating:
 * unarchiving a file later can surface a reference this pass did not fix.
 *
 * ## Reads are batched, writes are not
 *
 * Renaming an item is the worst case at roughly 1500 files. Reading them one
 * await at a time is slow enough to be felt, so reads run in bounded batches.
 * Writes stay sequential: they cannot be made atomic across dozens of files
 * anyway, and a failure part-way through is far easier to report accurately when
 * the order is known.
 */

/** How many files to read at once. Enough to saturate the disk, not the heap. */
const READ_BATCH = 32

/** Run `fn` over `items` at most `size` at a time, preserving order. */
async function inBatches(items, size, fn) {
  const out = []
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  }
  return out
}

/**
 * Every active file that names `oldName`, with how many times each one does.
 *
 * Returns `{ total, files, unreadable }` — `total` is references, not files, and
 * the two differ often: one behaviour set is named four times by a single
 * creature file. `unreadable` names files that could not be read, so a scan that
 * saw less than the whole world says so instead of reporting a smaller count.
 */
export async function scanReferences(libraryPath, type, oldName) {
  if (!String(oldName ?? '').trim()) return { total: 0, files: [], unreadable: [] }

  const files = []
  const unreadable = []

  for (const { sourceType, sites } of scanPlan(type)) {
    const { dir, active } = await listSectionFiles(libraryPath, sourceType)
    const results = await inBatches(active, READ_BATCH, async (rel) => {
      try {
        const xml = await readFile(join(dir, rel), 'utf8')
        return { rel, count: findReferences(xml, sites, oldName).length }
      } catch (err) {
        return { rel, error: err.message }
      }
    })
    for (const r of results) {
      if (r.error) unreadable.push({ sourceType, rel: r.rel, error: r.error })
      else if (r.count > 0) files.push({ sourceType, rel: r.rel, count: r.count })
    }
  }

  return { total: files.reduce((n, f) => n + f.count, 0), files, unreadable }
}

/**
 * Repoint every active reference to `oldName` at `newName`.
 *
 * Returns `{ total, changed, failed }`. `changed` is what was actually written,
 * which is the only honest thing to report back: the write is per file and
 * cannot be made atomic across dozens of them, so a partial result is a possible
 * outcome and the user has to be able to see which half happened.
 *
 * A file whose content is unchanged by the rewrite is not written at all. That
 * keeps a no-op out of the world's git history, and it means `changed` counts
 * files this call actually altered rather than files it visited.
 */
export async function applyRename(libraryPath, type, oldName, newName) {
  if (!String(oldName ?? '').trim()) return { total: 0, changed: [], failed: [] }

  const changed = []
  const failed = []

  for (const { sourceType, sites } of scanPlan(type)) {
    const { dir, active } = await listSectionFiles(libraryPath, sourceType)
    const rewrites = await inBatches(active, READ_BATCH, async (rel) => {
      try {
        const xml = await readFile(join(dir, rel), 'utf8')
        const { xml: next, count } = rewriteReferences(xml, sites, oldName, newName)
        return count > 0 && next !== xml ? { rel, next, count } : null
      } catch (err) {
        return { rel, error: err.message }
      }
    })

    for (const r of rewrites) {
      if (!r) continue
      if (r.error) {
        failed.push({ sourceType, rel: r.rel, error: r.error })
        continue
      }
      try {
        await writeFile(join(dir, r.rel), r.next, 'utf8')
        changed.push({ sourceType, rel: r.rel, count: r.count })
      } catch (err) {
        failed.push({ sourceType, rel: r.rel, error: err.message })
      }
    }
  }

  return { total: changed.reduce((n, f) => n + f.count, 0), changed, failed }
}
