import { describe, it, expect } from 'vitest'
import { ITEM_STATS, ITEM_STAT_KEYS, itemStatLabel } from '../itemStats.js'
import { STAT_MODIFIERS } from '../../renderer/src/data/itemConstants.js'
import { STAT_KEYS } from '../../main/itemXml.js'

/**
 * WP3. The item stat-modifier keys used to exist twice — a Set in
 * `src/main/itemXml.js` and an identical 69-entry `{ key, label, type }` list in
 * the renderer's `itemConstants.js`. Measured at the time: same keys, same order,
 * in step by luck.
 *
 * **The drift would have been silent.** If the parser's set lost a key the editor
 * still offered, the attribute would land in `unknownStatKeys`, which only the
 * diagnostics panel reads — so the value would disappear from a saved item and
 * nothing would report it.
 *
 * A report needed the list a third time. This guard is what makes the third
 * consumer safe: both earlier ones now read the shared list, and this asserts
 * they do rather than trusting it.
 */

describe('one item stat-key list (WP3)', () => {
  it('has the keys it is meant to have', () => {
    // Guards the guard. An emptied list would satisfy every containment
    // assertion below, which is the vacuous pass this file exists to prevent.
    expect(ITEM_STATS.length).toBe(69)
    expect(ITEM_STAT_KEYS[0]).toBe('BaseStr')
    expect(ITEM_STAT_KEYS).toContain('BonusHp')
    expect(new Set(ITEM_STAT_KEYS).size).toBe(ITEM_STAT_KEYS.length)
  })

  it('gives every stat a label and a field kind', () => {
    for (const stat of ITEM_STATS) {
      expect(stat.label, stat.key).toBeTruthy()
      expect(['formula', 'element'], stat.key).toContain(stat.type)
    }
  })

  it('is the list the XML parser validates against', () => {
    // Identity of contents, not a copy: the parser builds its Set from this list.
    expect([...STAT_KEYS]).toEqual(ITEM_STAT_KEYS)
  })

  it('is the list the item editor renders', () => {
    // Reference identity — the editor re-exports the array itself, so the two
    // cannot hold different objects.
    expect(STAT_MODIFIERS).toBe(ITEM_STATS)
  })

  it('labels a key, and falls back to the key itself', () => {
    expect(itemStatLabel('BaseStr')).toBe('Base Str')
    expect(itemStatLabel('NotAStat')).toBe('NotAStat')
  })
})
