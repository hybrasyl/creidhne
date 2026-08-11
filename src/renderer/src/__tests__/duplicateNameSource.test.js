import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { DUPLICATE_CHECKED_TYPES } from '../../../shared/nameCollision.js'

/**
 * HTOO-375. Every editor's duplicate-name check reads one rule.
 *
 * There were two notions of "duplicate" in this process. The index's is the
 * server's — `Normalize().ToLower()`, via `@eriscorp/hybindex-ts`. The editors'
 * was thirteen copies of a hand-rolled `toLowerCase()` pair. They agree for plain
 * ASCII, which is all of `world` today, so the divergence was latent rather than
 * live — and a latent divergence in thirteen places is the kind that surfaces one
 * editor at a time, years apart, as "this one says the name is free".
 *
 * Asserts the source, because the failure is silent by construction: an editor that
 * drifts back to a hand-rolled comparison renders correctly, saves correctly, and is
 * wrong only for names nobody has typed yet.
 */

const componentsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'components')

function editorsWithDuplicateDetection() {
  return readdirSync(componentsDir, { recursive: true })
    .map((n) => String(n).replace(/\\/g, '/'))
    .filter((n) => n.endsWith('.jsx'))
    .map((rel) => ({ rel, src: readFileSync(join(componentsDir, rel), 'utf8') }))
    .filter(({ src }) => /── Duplicate detection/.test(src))
}

// FormulaEditor is deliberately not on the hook: a formula is not an indexed type,
// so it matches against the in-memory formula list and identifies itself by `id`.
// It shares the key function, which is what this file is really about.
const NOT_INDEX_BACKED = ['formulas/FormulaEditor.jsx']

describe('duplicate-name detection has one source (HTOO-375)', () => {
  it('finds the editors it is meant to be checking', () => {
    // Guards the guard, and pins the count. Thirteen editors carry this block; a
    // fourteenth is fine but should arrive deliberately, because "no editor was
    // detected" and "every editor passed" look identical from the outside.
    const editors = editorsWithDuplicateDetection()
    expect(
      editors.length,
      'no duplicate-detection blocks found — the detector has stopped working'
    ).toBe(13)
    for (const rel of NOT_INDEX_BACKED) {
      expect(editors.map((e) => e.rel)).toContain(rel)
    }
  })

  it('does not compare names by hand', () => {
    // The exact shape of the old check. `toLowerCase()` has plenty of legitimate
    // uses in these files (filename derivation, for one), so this looks for the
    // comparison rather than the call.
    const offenders = []
    for (const { rel, src } of editorsWithDuplicateDetection()) {
      if (/\.toLowerCase\(\)\s*===\s*\w+\.toLowerCase\(\)/.test(src)) {
        offenders.push(rel)
      }
    }
    expect(offenders, 'these editors key names by hand instead of by the shared rule').toEqual([])
  })

  it('reads the index-backed check from the shared hook', () => {
    const offenders = editorsWithDuplicateDetection()
      .filter(({ rel }) => !NOT_INDEX_BACKED.includes(rel))
      .filter(({ src }) => !/useDuplicateName\(\{/.test(src))
      .map((e) => e.rel)
    expect(offenders, 'these editors should use useDuplicateName').toEqual([])
  })

  it('names a type the shared rule knows', () => {
    // A type that is merely misspelled would otherwise report "no duplicates"
    // forever. `duplicateNameStatus` throws on one, and this catches it without
    // needing to mount the editor to find out.
    const offenders = []
    for (const { rel, src } of editorsWithDuplicateDetection()) {
      const match = /useDuplicateName\(\{\s*type:\s*'([^']+)'/.exec(src)
      if (!match) continue
      if (!DUPLICATE_CHECKED_TYPES.includes(match[1])) offenders.push(`${rel} → ${match[1]}`)
    }
    expect(offenders, 'these editors name a type with no duplicate check').toEqual([])
  })

  it('covers every duplicate-checked type exactly once', () => {
    // The list and the editors are two halves of one fact. A type in the list with
    // no editor is dead vocabulary; two editors on one type means one of them is
    // checking the wrong names. Either way the mismatch should be visible here
    // rather than inferred from a UI that looks fine.
    const used = editorsWithDuplicateDetection()
      .map(({ src }) => /useDuplicateName\(\{\s*type:\s*'([^']+)'/.exec(src)?.[1])
      .filter(Boolean)
    expect([...used].sort()).toEqual([...DUPLICATE_CHECKED_TYPES].sort())
  })
})
