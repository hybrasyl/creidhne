import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * HTOO-130. The two halves of the first-save fix, asserted across every page that has
 * the one-file-per-entity save flow.
 *
 * The bug: `handleSave` called `setSelectedFile` only in the rename branch, so after a
 * first save of a new entity `selectedFile` stayed unset, `isExisting` stayed false, and
 * a second Save raised a false "name already exists" against the entity's own file.
 *
 * **The fix has two halves and applying one leaves a different bug**, which is exactly
 * what the audit found — 13 of the 14 pages had both, and SpawngroupsPage had only the
 * second. So this checks for both, per page, by name.
 *
 * Structural rather than behavioural, and that is a deliberate trade. Mounting a page
 * means standing up the store, ~20 `window.electronAPI` methods and a 900-line editor,
 * fourteen times over, to assert two lines each. This reads the source instead: weaker
 * evidence per page, but it covers all fourteen, it cannot drift as pages are added, and
 * the class of regression it catches is a deleted line rather than a subtle behaviour
 * change. A new page with this save flow fails here until it has both halves.
 */

const pagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'pages')

/**
 * Pages that own one file per entity. Detected by `resolveSavePath`, which is the helper
 * that turns a filename plus folder into a save path and is used by nothing else.
 *
 * Deliberately NOT a hardcoded list: a hardcoded list is the thing that goes stale when
 * page fifteen arrives, and going stale silently is this card's whole failure mode.
 */
function fileBackedPages() {
  return readdirSync(pagesDir)
    .filter((n) => n.endsWith('Page.jsx'))
    .map((n) => ({ name: n, src: readFileSync(join(pagesDir, n), 'utf8') }))
    .filter(({ src }) => /const \{[^}]*\} = resolveSavePath\(/.test(src))
}

describe('page save flow (HTOO-130)', () => {
  it('finds the pages it is meant to be checking', () => {
    // Guards the guard. If the detector returns nothing, every assertion below passes
    // against an empty list and the check is silently gone.
    // A floor, not an exact count. The risk being guarded against is the detector
    // returning nothing; a 15th page is legitimate and the three tests below pick it up
    // on their own. An exact count would fail on that with a message blaming the
    // detector, which is how a useful guard earns a reputation for crying wolf.
    const pages = fileBackedPages()
    expect(
      pages.length,
      'no file-backed pages detected — the resolveSavePath detector has stopped working'
    ).toBeGreaterThanOrEqual(14)
    expect(pages.map((p) => p.name)).toContain('CastablesPage.jsx')
    expect(pages.map((p) => p.name)).toContain('SpawngroupsPage.jsx')
  })

  it('associates the new file with the editor after a first save', () => {
    // Half 2. Without the `else if (!selectedFile)` branch, `selectedFile` stays unset
    // after a first save, so `isExisting` stays false and the duplicate-name check treats
    // the entity as new a second time — raising a false clash against its own file.
    const missing = fileBackedPages()
      .filter(({ src }) => !/\}\s*else if \(!selectedFile\)\s*\{/.test(src))
      .map((p) => p.name)
    expect(missing, 'these pages raise a false name clash on a second save').toEqual([])
  })

  it('syncs the editor state to the saved data', () => {
    // Half 1. The editors' reset effect depends on the entity prop AND on
    // `initialFileName`, which is `selectedFile?.name`. So half 2 fires that effect, and
    // without half 1 the editor resets to the stale pre-save value — for a brand-new
    // entity, the empty default. The file on disk is correct and the editor discards the
    // user's work in front of them.
    const missing = fileBackedPages()
      .filter(({ src }) => !/setEditing[A-Za-z]*\(\s*data\s*\)/.test(src))
      .map((p) => p.name)
    expect(missing, 'these pages reset the editor and lose the just-saved edits').toEqual([])
  })

  it('orders the two halves so the sync happens before the selection change', () => {
    // Order is load-bearing, not style. `setSelectedFile` is what triggers the reset
    // effect, so a sync placed after it resets from the stale value first. React batches
    // these within one handler, so the bug is not always visible — which is a reason to
    // pin the order rather than trust a passing click-through.
    const wrong = []
    for (const { name, src } of fileBackedPages()) {
      const sync = src.search(/setEditing[A-Za-z]*\(\s*data\s*\)/)
      const select = src.search(/\}\s*else if \(!selectedFile\)\s*\{/)
      if (sync === -1 || select === -1) continue // reported by the two tests above
      if (sync > select) wrong.push(name)
    }
    expect(wrong, 'these pages sync the editor after changing the selection').toEqual([])
  })
})
