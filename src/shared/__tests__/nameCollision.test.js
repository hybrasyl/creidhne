import { describe, it, expect } from 'vitest'
import { INDEX_TYPES, nameCollisionKey as packageKey } from '@eriscorp/hybindex-ts'
import {
  DUPLICATE_CHECKED_TYPES,
  archivedNamesKey,
  duplicateNameStatus,
  nameCollisionKey
} from '../nameCollision.js'

/**
 * HTOO-375. `src/shared/nameCollision.js` restates a rule `@eriscorp/hybindex-ts`
 * already owns, because the renderer cannot import that package — its entry point
 * imports `fs`, `path`, `crypto` and `os` at the top level.
 *
 * A restated rule drifts, and this one drifting is invisible: the editor would keep
 * reporting a clean name while the index and the server disagreed with it. So the
 * copy is pinned to the original here, in the one process that can import both.
 *
 * The table is chosen to separate the two implementations rather than to agree
 * decoratively — a `toLowerCase()`-only copy fails on the composed-vs-decomposed
 * pair, and a copy that collapsed whitespace fails on the double-space pair.
 */

// Inputs where a plausible near-miss implementation differs from the server's rule.
const SEPARATING_INPUTS = [
  'Twin Peaks',
  'twin peaks',
  'TWIN PEAKS',
  // Two spaces. Kept, not collapsed — the server keeps them too, so this is NOT a
  // collision with the single-space name above. The 1.1.0 notes call this out: the
  // docstring beside the server's `Sanitize` says whitespace is removed and the code
  // does not remove it.
  'twin  PEAKS',
  // Composed vs decomposed. Same text, different code points — `normalize()` is what
  // makes these one key, and a `toLowerCase()`-only copy would key them apart.
  'Mañana',
  'Mañana',
  'CAFÉ',
  'café',
  // Turkish dotted capital I: normalize-then-lowercase is not the same as
  // lowercase-then-normalize for this one.
  'İstanbul',
  'Straße',
  'The Crow & Cask',
  '  leading and trailing  ',
  ''
]

describe('name collision key agrees with hybindex-ts (HTOO-375)', () => {
  it('has a table that actually separates implementations', () => {
    // Guards the guard. If every input collapsed to the same key, or the table were
    // empty, the agreement assertion below would pass against nothing.
    expect(SEPARATING_INPUTS.length).toBeGreaterThan(10)
    expect(new Set(SEPARATING_INPUTS.map(nameCollisionKey)).size).toBeGreaterThan(6)
    // A naive lowercase-only copy must disagree with the real rule somewhere in the
    // table, or the table cannot detect that particular drift.
    const naive = SEPARATING_INPUTS.map((n) => n.toLowerCase())
    expect(naive).not.toEqual(SEPARATING_INPUTS.map(nameCollisionKey))
  })

  it('matches the package key for every input', () => {
    for (const input of SEPARATING_INPUTS) {
      expect(nameCollisionKey(input), JSON.stringify(input)).toBe(packageKey(input))
    }
  })

  it('keys case-insensitively and Unicode-normalized', () => {
    expect(nameCollisionKey('CAFÉ')).toBe(nameCollisionKey('café'))
    expect(nameCollisionKey('Mañana')).toBe(nameCollisionKey('Mañana'))
  })

  it('does not collapse whitespace', () => {
    // Pinning the trap, so a future "tidy-up" that adds a whitespace collapse fails
    // here rather than quietly diverging from the server.
    expect(nameCollisionKey('twin  peaks')).not.toBe(nameCollisionKey('twin peaks'))
  })

  it('tolerates a null or undefined name', () => {
    expect(nameCollisionKey(null)).toBe('')
    expect(nameCollisionKey(undefined)).toBe('')
  })
})

describe('duplicate-checked types are real indexed types (HTOO-375)', () => {
  it('finds the types it is meant to be checking', () => {
    expect(DUPLICATE_CHECKED_TYPES.length).toBe(12)
  })

  it('names only types the package indexes', () => {
    // Derives the rule instead of restating it: the package decides what an index
    // type is, so a renamed or dropped type fails here rather than turning one
    // editor's duplicate check into a permanent "clean".
    const unknown = DUPLICATE_CHECKED_TYPES.filter((t) => !INDEX_TYPES.includes(t))
    expect(unknown, 'these are not hybindex-ts index types').toEqual([])
  })

  it('derives an archived field name that the index actually carries', () => {
    // `maps` and `worldmaps` have no archived list, which is why they are not
    // duplicate-checked. Every type that IS checked must have both halves.
    const expected = {
      castables: 'archivedCastables',
      creatures: 'archivedCreatures',
      creaturebehaviorsets: 'archivedCreaturebehaviorsets',
      elementtables: 'archivedElementtables',
      items: 'archivedItems',
      lootsets: 'archivedLootsets',
      nations: 'archivedNations',
      npcs: 'archivedNpcs',
      recipes: 'archivedRecipes',
      spawngroups: 'archivedSpawngroups',
      statuses: 'archivedStatuses',
      variantgroups: 'archivedVariantgroups'
    }
    for (const type of DUPLICATE_CHECKED_TYPES) {
      expect(archivedNamesKey(type), type).toBe(expected[type])
    }
  })
})

describe('duplicateNameStatus (HTOO-375)', () => {
  const libraryIndex = {
    items: ['Iron Sword', 'Mañana Cloak'],
    archivedItems: ['Retired Buckler'],
    castables: ['Fire Blast'],
    archivedCastables: []
  }

  const status = (name, originalName = '') =>
    duplicateNameStatus({ libraryIndex, type: 'items', name, originalName })

  it('reports an active clash', () => {
    expect(status('Iron Sword')).toBe('active')
  })

  it('ignores case and Unicode form', () => {
    expect(status('iron sword')).toBe('active')
    expect(status('Mañana Cloak')).toBe('active')
  })

  it('reports an archived clash', () => {
    expect(status('retired buckler')).toBe('archived')
  })

  it('prefers active over archived', () => {
    const both = { items: ['Duplicated'], archivedItems: ['Duplicated'] }
    expect(duplicateNameStatus({ libraryIndex: both, type: 'items', name: 'duplicated' })).toBe(
      'active'
    )
  })

  it('does not flag an entity against its own saved name', () => {
    expect(status('Iron Sword', 'Iron Sword')).toBeNull()
    expect(status('IRON SWORD', 'iron sword')).toBeNull()
  })

  it('still flags a rename onto another entity', () => {
    expect(status('Mañana Cloak', 'Iron Sword')).toBe('active')
  })

  it('returns null for a blank or whitespace-only name', () => {
    expect(status('')).toBeNull()
    expect(status('   ')).toBeNull()
  })

  it('trims the candidate before comparing', () => {
    expect(status('  Iron Sword  ')).toBe('active')
  })

  it('reports clean against a type it has no entries for', () => {
    expect(duplicateNameStatus({ libraryIndex: {}, type: 'npcs', name: 'Anybody' })).toBeNull()
    expect(
      duplicateNameStatus({ libraryIndex: undefined, type: 'npcs', name: 'Anybody' })
    ).toBeNull()
  })

  it('throws on a type with no duplicate check', () => {
    // Rather than returning null. A mistyped type reporting "clean" forever is the
    // silent pass this whole check exists to prevent.
    expect(() =>
      duplicateNameStatus({ libraryIndex, type: 'localizations', name: 'Anything' })
    ).toThrow(/no duplicate check defined/)
    expect(() => duplicateNameStatus({ libraryIndex, type: 'itmes', name: 'Anything' })).toThrow()
  })
})
