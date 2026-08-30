import { describe, it, expect } from 'vitest'
import { DEFAULT_NPC_SPECIES } from '../npcSpecies.js'

/**
 * The species seed. A list, but one with three properties the picker relies
 * on, each of which a careless edit could break without anything else going
 * red.
 */
describe('DEFAULT_NPC_SPECIES', () => {
  it('is a non-empty, frozen list of trimmed names', () => {
    expect(DEFAULT_NPC_SPECIES.length).toBeGreaterThan(0)
    expect(Object.isFrozen(DEFAULT_NPC_SPECIES)).toBe(true)
    for (const s of DEFAULT_NPC_SPECIES) {
      expect(s, 'a species name is padded or empty').toBe(s.trim())
      expect(s.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicates, case-insensitively', () => {
    // `ConstantAutocomplete` offers "Create …" when no option matches
    // case-insensitively, so two casings of one species would both show and
    // neither would suppress the create row.
    const keys = DEFAULT_NPC_SPECIES.map((s) => s.toLowerCase())
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('is sorted, so the seed and the persisted list read the same', () => {
    // `constants:addValue` sorts on every write. A seed in a different order
    // would reorder itself the first time anyone added a species, which reads
    // as an unexplained diff in the world's constants.json.
    expect([...DEFAULT_NPC_SPECIES]).toEqual([...DEFAULT_NPC_SPECIES].sort())
  })
})
