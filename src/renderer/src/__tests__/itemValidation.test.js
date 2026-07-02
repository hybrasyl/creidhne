import { describe, it, expect } from 'vitest'
import { validateItem } from '../data/itemValidation'
import {
  ITEM_FLAGS,
  ITEM_TAGS,
  ITEM_BODY_STYLES,
  ITEM_COLORS,
  EQUIPMENT_SLOTS,
  GENDERS
} from '../data/itemConstants'

// A minimal valid item (only known values) should yield no warnings.
const validItem = {
  properties: {
    flags: [ITEM_FLAGS[0]],
    tags: [ITEM_TAGS[0]],
    appearance: { bodyStyle: ITEM_BODY_STYLES[0], color: ITEM_COLORS[0] },
    equipment: { slot: EQUIPMENT_SLOTS[0] },
    restrictions: { gender: GENDERS[0], class: 'All' }
  }
}

describe('validateItem', () => {
  it('returns no warnings for an item with only known values', () => {
    expect(validateItem(validItem)).toEqual([])
  })

  it('returns an empty array when there are no properties', () => {
    expect(validateItem(null)).toEqual([])
    expect(validateItem({})).toEqual([])
  })

  it('reports unknown stat-modifier keys from the parse diagnostics', () => {
    const w = validateItem({ properties: {}, _diagnostics: { unknownStatKeys: ['Foo', 'Bar'] } })
    expect(w).toContain('Unknown StatModifier attributes: Foo, Bar')
  })

  it('reports unknown flags and tags', () => {
    const w = validateItem({ properties: { flags: ['NopeFlag'], tags: ['NopeTag'] } })
    expect(w).toContain('Unknown flags: NopeFlag')
    expect(w).toContain('Unknown tags: NopeTag')
  })

  it('reports unknown appearance body style and color', () => {
    const w = validateItem({
      properties: { appearance: { bodyStyle: 'Weird', color: 'Ultraviolet' } }
    })
    expect(w).toContain('Unknown body style: "Weird"')
    expect(w).toContain('Unknown color: "Ultraviolet"')
  })

  it('reports an unknown equipment slot', () => {
    const w = validateItem({ properties: { equipment: { slot: 'Antenna' } } })
    expect(w).toContain('Unknown equipment slot: "Antenna"')
  })

  it('reports unknown gender and class restriction tokens (skipping "All")', () => {
    const w = validateItem({
      properties: { restrictions: { gender: 'Robot', class: 'Wizard Bard Nope' } }
    })
    expect(w).toContain('Unknown gender restriction: "Robot"')
    // Wizard/Bard are valid class tokens; only "Nope" is flagged.
    expect(w.some((m) => m.includes('Nope') && !m.includes('Wizard'))).toBe(true)
  })

  it('does not flag a class restriction of "All"', () => {
    const w = validateItem({ properties: { restrictions: { class: 'All' } } })
    expect(w).toEqual([])
  })
})
