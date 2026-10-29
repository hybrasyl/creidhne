import { describe, expect, it } from 'vitest'
import {
  addElement,
  blankElement,
  convertToRegistry,
  effectiveMultiplier,
  nextFreeId,
  removeElement,
  renameElement,
  setPair,
  setRowDefault,
  validateElementTable
} from '../elementTable.js'

// The element table rules (HTOO-581, HXML-24).

const el = (key, id, more = {}) => ({ ...blankElement(key), id: String(id), ...more })

/** A valid registry table: Force is the default, Undead has a row default. */
function registryTable() {
  return {
    name: 'T',
    comment: '',
    defaultMultiplier: '0.9',
    registry: true,
    elements: [
      el('Force', 0, { retailId: '0', isDefault: true }),
      el('Fire', 1, { retailId: '1' }),
      el('Undead', 9, { retailId: '9' })
    ],
    groups: [{ key: 'Hot', members: ['Fire', 'Force'] }],
    sources: [
      {
        element: 'Fire',
        defaultMultiplier: '',
        targets: [{ element: 'Force', multiplier: '1.2' }]
      },
      {
        element: 'Undead',
        defaultMultiplier: '1.2',
        targets: [{ element: 'Undead', multiplier: '0.5' }]
      }
    ]
  }
}

/** An old-format table, as world holds it. */
function legacyTable() {
  const keys = ['None', 'Fire', 'Wood']
  return {
    name: 'HybElements',
    comment: '',
    defaultMultiplier: '',
    registry: false,
    elements: keys.map(blankElement),
    groups: [],
    sources: keys.map((s) => ({
      element: s,
      defaultMultiplier: '',
      targets: keys.map((t) => ({ element: t, multiplier: '1' }))
    }))
  }
}

describe('effectiveMultiplier', () => {
  const t = registryTable()
  it('takes the Target entry first', () => {
    expect(effectiveMultiplier(t, 'Fire', 'Force')).toBe(1.2)
    expect(effectiveMultiplier(t, 'Undead', 'Undead')).toBe(0.5)
  })
  it('then the row default', () => {
    expect(effectiveMultiplier(t, 'Undead', 'Fire')).toBe(1.2)
  })
  it('then the table default', () => {
    expect(effectiveMultiplier(t, 'Fire', 'Fire')).toBe(0.9)
    expect(effectiveMultiplier(t, 'Force', 'Fire')).toBe(0.9) // no row at all
  })
  it('then 1, the schema default', () => {
    expect(effectiveMultiplier({ ...t, defaultMultiplier: '' }, 'Force', 'Fire')).toBe(1)
  })
})

describe('setPair', () => {
  it('adds a pair at the end of its row', () => {
    const t = setPair(registryTable(), 'Fire', 'Undead', '2')
    expect(t.sources[0].targets.map((x) => x.element)).toEqual(['Force', 'Undead'])
  })
  it('changes a pair in place', () => {
    const t = setPair(registryTable(), 'Fire', 'Force', '0.75')
    expect(t.sources[0].targets).toEqual([{ element: 'Force', multiplier: '0.75' }])
  })
  it('clears a pair, so it falls back to the defaults, and keeps its place', () => {
    let t = setPair(registryTable(), 'Fire', 'Undead', '2')
    t = setPair(t, 'Fire', 'Force', '')
    expect(t.sources[0].targets).toEqual([
      { element: 'Force', multiplier: '' },
      { element: 'Undead', multiplier: '2' }
    ])
    expect(effectiveMultiplier(t, 'Fire', 'Force')).toBe(0.9)
    // Retyped, it is where it was, so a save makes no reorder diff.
    t = setPair(t, 'Fire', 'Force', '1.3')
    expect(t.sources[0].targets.map((x) => x.element)).toEqual(['Force', 'Undead'])
  })
  it('makes a row only for a value', () => {
    expect(setPair(registryTable(), 'Force', 'Fire', '').sources).toHaveLength(2)
    const t = setPair(registryTable(), 'Force', 'Fire', '1.1')
    expect(t.sources[2]).toEqual({
      element: 'Force',
      defaultMultiplier: '',
      targets: [{ element: 'Fire', multiplier: '1.1' }]
    })
  })
})

describe('setRowDefault', () => {
  it('sets and clears a row default, keeping the row', () => {
    let t = setRowDefault(registryTable(), 'Fire', '1.3')
    expect(t.sources[0].defaultMultiplier).toBe('1.3')
    t = setRowDefault(t, 'Fire', '')
    expect(t.sources[0]).toMatchObject({ element: 'Fire', defaultMultiplier: '' })
  })
})

describe('renameElement and removeElement', () => {
  it('renames a key in rows, targets and groups', () => {
    const t = renameElement(registryTable(), 'Fire', 'Flame')
    expect(t.elements[1].key).toBe('Flame')
    expect(t.sources[0].element).toBe('Flame')
    expect(t.groups[0].members).toEqual(['Flame', 'Force'])
    expect(validateElementTable(t)).toEqual([])
  })
  it('removes a key from rows, targets and groups', () => {
    const t = removeElement(registryTable(), 'Force')
    expect(t.sources[0].targets).toEqual([])
    expect(t.groups[0].members).toEqual(['Fire'])
  })
})

describe('addElement', () => {
  it('in the registry format, declares no pairs and takes a free Id', () => {
    const t = addElement(registryTable(), 'Arcane')
    expect(t.elements.at(-1)).toMatchObject({ key: 'Arcane', id: '23' })
    expect(t.sources).toHaveLength(2)
  })
  it('in the old format, fills the new row and column with 1, as the server needs', () => {
    const t = addElement(legacyTable(), 'Metal')
    expect(t.sources).toHaveLength(4)
    expect(t.sources.every((r) => r.targets.length === 4)).toBe(true)
    expect(effectiveMultiplier(t, 'Metal', 'Fire')).toBe(1)
  })
  it('skips the retired Ids', () => {
    const t = { ...registryTable(), elements: [el('A', 23), el('B', 24)] }
    expect(nextFreeId(t)).toBe(25)
  })
})

describe('convertToRegistry', () => {
  it('gives each HXML-24 key its Id and RetailId, and any other key a new Id', () => {
    const t = convertToRegistry(legacyTable())
    expect(t.registry).toBe(true)
    expect(t.elements.map((e) => [e.key, e.id, e.retailId])).toEqual([
      ['None', '23', '0'],
      ['Fire', '1', '1'],
      ['Wood', '24', '0']
    ])
  })
  it('makes Force the default when the table has it, else the first element', () => {
    expect(convertToRegistry(legacyTable()).elements.filter((e) => e.isDefault)).toEqual([
      expect.objectContaining({ key: 'None' })
    ])
    const withForce = renameElement(legacyTable(), 'Wood', 'Force')
    const t = convertToRegistry(withForce)
    expect(t.elements.find((e) => e.isDefault).key).toBe('Force')
    expect(t.elements.find((e) => e.key === 'Force').id).toBe('0')
  })
  it('keeps every pair', () => {
    const before = legacyTable()
    expect(convertToRegistry(before).sources).toEqual(before.sources)
  })
})

describe('validateElementTable', () => {
  const problemsOf = (edit) => {
    const t = registryTable()
    edit(t)
    return validateElementTable(t)
  }

  it('passes a valid table', () => {
    expect(validateElementTable(registryTable())).toEqual([])
    expect(validateElementTable(legacyTable())).toEqual([])
  })
  it('a duplicate key', () => {
    expect(problemsOf((t) => (t.elements[2].key = 'Fire')).join()).toMatch(
      /"Fire" is on more than one element/
    )
  })
  it('a duplicate Id', () => {
    expect(problemsOf((t) => (t.elements[2].id = '1')).join()).toMatch(/Id 1 is on more than one/)
  })
  it('an Id out of range', () => {
    expect(problemsOf((t) => (t.elements[2].id = '255')).join()).toMatch(/from 0 to 254/)
  })
  it('a RetailId of 10', () => {
    expect(problemsOf((t) => (t.elements[2].retailId = '10')).join()).toMatch(/from 0 to 9/)
  })
  it('allows no RetailId, which defaults to 0', () => {
    expect(problemsOf((t) => (t.elements[2].retailId = ''))).toEqual([])
  })
  it('no default element', () => {
    expect(problemsOf((t) => (t.elements[0].isDefault = false)).join()).toMatch(/No element is/)
  })
  it('two default elements', () => {
    expect(problemsOf((t) => (t.elements[1].isDefault = true)).join()).toMatch(/all marked default/)
  })
  it.each(['Current', 'Belt', 'Necklace', 'Random:Hot'])('a reserved element key: %s', (k) => {
    expect(problemsOf((t) => (t.elements[2].key = k)).join()).toMatch(/reserved for a selector/)
  })
  it('a reserved group key', () => {
    expect(problemsOf((t) => (t.groups[0].key = 'Random:X')).join()).toMatch(/no group can take it/)
  })
  it('a group member that is not an element', () => {
    expect(problemsOf((t) => t.groups[0].members.push('Wood')).join()).toMatch(/Hot names "Wood"/)
  })
  it('a Source or Target that is not an element', () => {
    expect(
      problemsOf((t) => t.sources[0].targets.push({ element: 'Wood', multiplier: '1' })).join()
    ).toMatch(/Fire names "Wood"/)
  })
  it('a multiplier that is not a number', () => {
    expect(problemsOf((t) => (t.sources[0].targets[0].multiplier = 'x')).join()).toMatch(
      /"x" is not a number/
    )
  })
  it('in the old format, needs a multiplier for every pair', () => {
    const t = setPair(legacyTable(), 'Fire', 'Wood', '')
    expect(validateElementTable(t).join()).toMatch(
      /needs a multiplier for every pair.*Fire against Wood/
    )
  })
  it('in the old format, checks only the keys and the pairs', () => {
    const t = legacyTable()
    expect(validateElementTable(t)).toEqual([])
    t.elements[1].key = 'None'
    expect(validateElementTable(t).join()).toMatch(/"None" is on more than one element/)
  })
})
