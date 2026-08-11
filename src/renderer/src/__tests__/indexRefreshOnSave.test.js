import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * HTOO-372. Saving must refresh the world index section it just wrote to.
 *
 * The index backs every duplicate-name check, the weapon and formula pickers, and
 * the spawngroup and behavior-set reference lookups. Until it is rebuilt, none of
 * them can see an entity created earlier in the same session — so the duplicate
 * guard reports clean against a name a user took minutes ago and the world ends up
 * with two entities under one key.
 *
 * The audit found this was NOT "no save refreshes": thirteen of the fourteen
 * file-backed pages already did, and archive, unarchive, delete and duplicate all
 * refresh through `useBulkFileActions`. ServerConfigPage's save was the one gap —
 * the same pattern-reached-most-sites shape as HTOO-130 and HTOO-159, and just as
 * unable to fail loudly, because a page that skips the refresh saves correctly and
 * only goes wrong later, somewhere else.
 *
 * Structural rather than behavioural, for the reason `pageSaveFlow.test.js` gives:
 * mounting fourteen pages to assert two lines each costs more than it proves.
 */

const pagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'pages')

/**
 * Pages that own one file per entity — detected by `resolveSavePath`, the same
 * rule `pageSaveFlow.test.js` uses, and deliberately not a hardcoded list. Page
 * fifteen inherits this check by existing.
 */
function fileBackedPages() {
  return readdirSync(pagesDir)
    .filter((n) => n.endsWith('Page.jsx'))
    .map((n) => ({ name: n, src: readFileSync(join(pagesDir, n), 'utf8') }))
    .filter(({ src }) => /const \{[^}]*\} = resolveSavePath\(/.test(src))
}

describe('index refresh on save (HTOO-372)', () => {
  it('finds the pages it is meant to be checking', () => {
    // Guards the guard: an empty list passes every assertion below.
    const pages = fileBackedPages()
    expect(
      pages.length,
      'no file-backed pages detected — the resolveSavePath detector has stopped working'
    ).toBeGreaterThanOrEqual(14)
    expect(pages.map((p) => p.name)).toContain('ServerConfigPage.jsx')
    expect(pages.map((p) => p.name)).toContain('CastablesPage.jsx')
  })

  it('rebuilds the section after a save', () => {
    // Half 1. `index:buildSection` reaches the preload bridge and, without this
    // call, nothing on a save path uses it.
    const missing = fileBackedPages()
      .filter(({ src }) => !/buildIndexSection\(/.test(src))
      .map((p) => p.name)
    expect(missing, 'these pages leave the index stale after a save').toEqual([])
  })

  it('merges the rebuilt section back into the store', () => {
    // Half 2, and it is a separate failure. The worker persists the section to the
    // on-disk cache either way, so a page that rebuilds without merging looks fixed
    // and is correct again only after the next library activation — the store the
    // editors actually read stays stale for the rest of the session.
    const missing = fileBackedPages()
      .filter(
        ({ src }) => !/setLibraryIndex\(\(prev\) => \(\{ \.\.\.prev, \.\.\.section \}\)\)/.test(src)
      )
      .map((p) => p.name)
    expect(missing, 'these pages rebuild the section and then discard it').toEqual([])
  })

  it('routes archive, unarchive, delete and duplicate through the shared hook', () => {
    // Those four refresh inside `useBulkFileActions`, so a page that hand-rolls them
    // instead is outside this file's reach and silently loses the refresh. Keeping
    // them on the hook is what lets the two checks above be the whole story.
    const missing = fileBackedPages()
      .filter(({ src }) => !/useBulkFileActions\(/.test(src))
      .map((p) => p.name)
    expect(missing, 'these pages do not use the shared bulk-actions hook').toEqual([])
  })
})
