import { describe, it, expect } from 'vitest'
import { shouldOfferRepair, countLabel, repairSummary } from '../renameRepair.js'

/**
 * HTOO-378, part two: when the offer is made.
 *
 * The trigger is the piece the card flags as most likely to be got wrong, and
 * the cases below are the ones that separate the right trigger from the
 * plausible one.
 */

const base = {
  libraryIndex: { items: ['Lorica'], castables: ['Bash'] },
  type: 'items',
  isExisting: true
}

describe('shouldOfferRepair (HTOO-378)', () => {
  it('offers when the Name changes on an existing entity', () => {
    expect(shouldOfferRepair({ ...base, oldName: 'Lorica', newName: 'Cuirass' })).toEqual({
      offer: true
    })
  })

  it('offers even when the file is saved in place', () => {
    // THE case a filename-derived trigger misses. `isRename` comes from
    // `resolveSavePath` and is computed from the filename; a user who has
    // hand-edited the filename can change <Name>, save over the same file, and
    // orphan every referrer while nothing on that path believes a rename
    // happened. Nothing about a filename appears in this function's inputs, and
    // that is the point.
    expect(shouldOfferRepair({ ...base, oldName: 'Lorica', newName: 'Cuirass' }).offer).toBe(true)
  })

  it('does not offer when only the FILE was renamed', () => {
    // The converse, and it falls out of the same rule: the server keys on the
    // name, not the path, so moving a file breaks nothing.
    expect(shouldOfferRepair({ ...base, oldName: 'Lorica', newName: 'Lorica' })).toEqual({
      offer: false,
      reason: 'unchanged'
    })
  })

  it('ignores leading and trailing whitespace when deciding "changed"', () => {
    expect(shouldOfferRepair({ ...base, oldName: 'Lorica', newName: '  Lorica  ' }).offer).toBe(
      false
    )
  })

  it('does not offer for a brand-new entity', () => {
    // Nothing can name an entity that has never been saved.
    expect(
      shouldOfferRepair({ ...base, isExisting: false, oldName: '', newName: 'Cuirass' })
    ).toEqual({ offer: false, reason: 'new-entity' })
  })

  it('does not offer for a type nothing can reference', () => {
    // Four indexed types were measured to have no inbound edges at all. Read
    // from the table, so a type that gains an edge starts offering with no
    // further change here — which is exactly what happened to npcs, the
    // example this test used before the second sweep found the maps edge.
    expect(
      shouldOfferRepair({ ...base, type: 'recipes', oldName: 'Bread', newName: 'Loaf' })
    ).toEqual({ offer: false, reason: 'no-references-possible' })
    expect(
      shouldOfferRepair({ ...base, type: 'localizations', oldName: 'Shop', newName: 'Store' })
    ).toEqual({ offer: false, reason: 'no-references-possible' })
  })

  it('declines rather than guesses when the old name is not unique', () => {
    // Two active files claiming one name makes every reference to it ambiguous.
    // A rewrite would silently pick one meaning for all of them.
    expect(
      shouldOfferRepair({
        ...base,
        libraryIndex: { items: ['Lorica', 'lorica'] },
        oldName: 'Lorica',
        newName: 'Cuirass'
      })
    ).toEqual({ offer: false, reason: 'ambiguous-old-name' })
  })

  it('uses the server key rule for uniqueness, not a bare comparison', () => {
    // `Normalize().ToLower()`. Two spellings differing only in case are one key
    // to the server, so they are two claimants here.
    const status = shouldOfferRepair({
      ...base,
      libraryIndex: { items: ['LORICA', 'Lorica'] },
      oldName: 'Lorica',
      newName: 'Cuirass'
    })
    expect(status.reason).toBe('ambiguous-old-name')
  })

  it('still offers when the index has not caught up with the entity', () => {
    // Zero claimants means a stale index, not an ambiguity. Declining there
    // would refuse the repair for a rename that is perfectly well defined.
    expect(
      shouldOfferRepair({ ...base, libraryIndex: {}, oldName: 'Lorica', newName: 'Cuirass' })
    ).toEqual({ offer: true })
  })
})

describe('the sentences the user is shown', () => {
  it('pluralises', () => {
    expect(countLabel(1, 'file')).toBe('1 file')
    expect(countLabel(0, 'file')).toBe('0 files')
    expect(countLabel(2, 'reference')).toBe('2 references')
  })

  it('reports the successes on their own when nothing failed', () => {
    expect(repairSummary({ total: 3, changed: [{}, {}], failed: [] })).toBe(
      'Updated 3 references in 2 files.'
    )
  })

  it('names what could not be written', () => {
    // A partial result is a possible outcome, so saying only the good half
    // would tell the user the world is consistent when it is not.
    const msg = repairSummary({
      total: 1,
      changed: [{}],
      failed: [{ rel: 'shop.xml' }, { rel: 'inn.xml' }]
    })
    expect(msg).toContain('Updated 1 reference in 1 file.')
    expect(msg).toContain('2 files could not be written: shop.xml, inn.xml')
  })
})
