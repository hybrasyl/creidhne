import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { INDEX_TYPES } from '@eriscorp/hybindex-ts'
import { REFERENCE_SITES } from '@shared/entityReferences.js'

/**
 * HTOO-378, part two. The rename-repair offer reaches every page that needs it,
 * and the two halves of it are in the right order.
 *
 * This epic has found the same shape five times: a pattern applied to most of
 * its sites, not all. Thirteen of fourteen pages had the first-save fix, twelve
 * of fourteen used the shared header, thirteen of fourteen refreshed the index
 * on save. None could fail loudly, because each site looks correct read on its
 * own. This is the sixth, and it is the worst of them to get wrong: a page that
 * silently lacks the offer orphans every file that names the entity, in OTHER
 * files, which is precisely the failure the feature exists to prevent.
 *
 * So the required set is DERIVED — from the reference table, which is measured
 * against the production world — rather than listed. Adding an edge to the table
 * for a type that had none makes its page fail here until it is wired.
 */

const pagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'pages')

/** Pages that own one file per entity, detected exactly as `pageSaveFlow` does. */
function fileBackedPages() {
  return readdirSync(pagesDir)
    .filter((n) => n.endsWith('Page.jsx'))
    .map((n) => ({ name: n, src: readFileSync(join(pagesDir, n), 'utf8') }))
    .filter(({ src }) => /const \{[^}]*\} = resolveSavePath\(/.test(src))
    .map((p) => ({ ...p, type: p.src.match(/IGNORE_SUBDIR = '([^/']+)\/\.ignore'/)?.[1] }))
}

/** Pages whose entity type something else in the world can name. */
function pagesNeedingRepair() {
  return fileBackedPages().filter((p) => REFERENCE_SITES[p.type]?.length)
}

describe('rename repair reaches every page that needs it (HTOO-378)', () => {
  it('identifies the type behind every file-backed page', () => {
    // Guards the guard, twice over. A page whose type cannot be read would drop
    // out of the required set silently — the exact failure being defended
    // against — and a type that is not an index type means the extraction has
    // started matching something else.
    const pages = fileBackedPages()
    expect(pages.length, 'the resolveSavePath detector has stopped working').toBeGreaterThanOrEqual(
      14
    )
    const untyped = pages.filter((p) => !p.type).map((p) => p.name)
    expect(untyped, 'could not read an entity type from these pages').toEqual([])
    const unknown = pages.filter((p) => !INDEX_TYPES.includes(p.type)).map((p) => p.type)
    expect(
      unknown,
      'these are not index types — the extraction is matching something else'
    ).toEqual([])
  })

  it('requires the offer on every type with inbound references, and finds nine', () => {
    // A floor and a spot check rather than an exact list. Nine is what the
    // production-world survey found; a tenth is legitimate and is picked up by
    // the tests below on its own.
    const needing = pagesNeedingRepair()
      .map((p) => p.type)
      .sort()
    expect(needing.length).toBeGreaterThanOrEqual(9)
    expect(needing).toContain('items')
    expect(needing).toContain('creaturebehaviorsets')
    expect(needing).toContain('nations')
    // NPCs name a great many things and nothing names an NPC, so the page is a
    // source and never a target. Measured, and worth pinning: it is the one page
    // whose absence from this list looks like an oversight.
    expect(needing).not.toContain('npcs')
  })

  it('wires the hook and renders the dialog on each of them', () => {
    const missingHook = pagesNeedingRepair()
      .filter(({ src }) => !/useRenameReferences\(\{/.test(src))
      .map((p) => p.name)
    expect(missingHook, 'these pages silently orphan references on rename').toEqual([])

    const missingDialog = pagesNeedingRepair()
      .filter(({ src }) => !/<RenameReferencesDialog\s+\{\.\.\.renameDialogProps\}/.test(src))
      .map((p) => p.name)
    expect(missingDialog, 'these pages ask but can never show the question').toEqual([])
  })

  it('passes each page its own type', () => {
    // A copy-pasted `type:` is the way this feature fails while looking wired:
    // the scan runs against the wrong table and reports a clean result.
    const wrong = pagesNeedingRepair()
      .filter(({ src, type }) => !new RegExp(`type: '${type}'`).test(src))
      .map((p) => p.name)
    expect(wrong, 'these pages pass a type that is not their own').toEqual([])
  })

  it('asks before it writes, and repoints only after', () => {
    // Order is the whole correctness argument. The confirm must precede the
    // entity save or Cancel is a lie; the apply must follow it or a failed
    // entity save leaves the world repointed at a name never written.
    const wrong = []
    for (const { name, src } of pagesNeedingRepair()) {
      const confirm = src.search(/await confirmRename\(/)
      const save = src.search(/await window\.electronAPI\.save[A-Za-z]+\(newPath, data\)/)
      const apply = src.search(/await rename\.apply\(\)/)
      if (confirm === -1) wrong.push(`${name}: never calls confirmRename`)
      else if (apply === -1) wrong.push(`${name}: never calls rename.apply()`)
      else if (save === -1) wrong.push(`${name}: save call not recognised`)
      else if (confirm > save) wrong.push(`${name}: confirms after saving`)
      else if (apply < save) wrong.push(`${name}: repoints before saving`)
    }
    expect(wrong).toEqual([])
  })

  it('honours a cancel instead of saving anyway', () => {
    const missing = pagesNeedingRepair()
      .filter(({ src }) => !/if \(rename\.cancelled\) return/.test(src))
      .map((p) => p.name)
    expect(missing, 'these pages save the entity after the user cancelled').toEqual([])
  })
})
