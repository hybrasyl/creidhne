import { describe, it, expect } from 'vitest'
import {
  ITEM_COLUMNS,
  NO_SLOT,
  deriveLootSets,
  deriveVendors,
  isEquipment,
  isWeapon,
  itemToRecord
} from '../itemRecord.js'
import { ITEM_STATS } from '../itemStats.js'

// WP3. The item record is the castable record's shape for a second type: one flat
// object, each derivation written once, and a catalogue the picker reads.

/** The shape `parseItemXml` produces, with only what a test needs filled in. */
const makeItem = (over = {}) => ({
  name: 'Oak Stick',
  unidentifiedName: '',
  comment: '',
  includeInMetafile: true,
  ...over,
  properties: {
    tags: [],
    appearance: { sprite: '12', equipSprite: '', displaySprite: '', bodyStyle: '', color: '' },
    stackable: { max: '1' },
    physical: { value: '25', weight: '3', durability: '1000' },
    categories: [],
    equipment: null,
    statModifiers: { rows: [], elementalModifiers: [], unknownStatKeys: [] },
    flags: [],
    variants: { names: [], groups: [] },
    vendor: { shopTab: '', description: '' },
    damage: null,
    use: null,
    restrictions: {
      level: { min: '', max: '' },
      ab: null,
      class: '',
      gender: 'Neutral',
      castables: [],
      slotRestrictions: []
    },
    motions: [],
    castModifiers: [],
    procs: [],
    ...(over.properties || {})
  }
})

describe('isEquipment and isWeapon', () => {
  it('treat an absent value and None alike', () => {
    // Both are "not equipment". Deciding it once here is what stops a report and
    // the builder's live preview disagreeing about the same item.
    expect(isEquipment('Weapon')).toBe(true)
    expect(isEquipment(NO_SLOT)).toBe(false)
    expect(isEquipment('')).toBe(false)
    expect(isEquipment(undefined)).toBe(false)
    expect(isWeapon('OneHand')).toBe(true)
    expect(isWeapon('None')).toBe(false)
    expect(isWeapon(undefined)).toBe(false)
  })
})

describe('the index lookups', () => {
  it('read vendors and loot sets by lowercased name', () => {
    const ctx = {
      itemVendors: { 'oak stick': ['Beatrix', 'Cynan'] },
      itemLootSets: { 'oak stick': ['forest-common'] }
    }
    expect(deriveVendors('Oak Stick', ctx)).toEqual(['Beatrix', 'Cynan'])
    expect(deriveLootSets('OAK STICK', ctx)).toEqual(['forest-common'])
  })

  it('read an absent lookup as empty, not as an error', () => {
    // A library with no index still exports; those columns are simply empty.
    expect(deriveVendors('Oak Stick', {})).toEqual([])
    expect(deriveLootSets('Oak Stick', undefined)).toEqual([])
  })
})

describe('itemToRecord', () => {
  it('flattens the identity and physical fields', () => {
    const record = itemToRecord(makeItem())
    expect(record.name).toBe('Oak Stick')
    expect(record.value).toBe('25')
    expect(record.weight).toBe('3')
    expect(record.durability).toBe('1000')
    expect(record.stackMax).toBe('1')
    expect(record.sprite).toBe('12')
  })

  it('carries the derived booleans, not just the display strings', () => {
    // A rule must not test `vendors`: an item nobody sells and an index that failed
    // to load both give the empty string, so a filter on it could match nothing and
    // still produce a report that looks valid.
    const plain = itemToRecord(makeItem())
    expect(plain.isEquipment).toBe(false)
    expect(plain.isWeapon).toBe(false)
    expect(plain.hasDamage).toBe(false)
    expect(plain.hasVendor).toBe(false)
    expect(plain.hasLootSet).toBe(false)

    const weapon = itemToRecord(
      makeItem({
        properties: {
          equipment: { slot: 'Weapon', weaponType: 'OneHand' },
          damage: { smallMin: '1', smallMax: '4', largeMin: '2', largeMax: '6' }
        }
      }),
      { itemVendors: { 'oak stick': ['Beatrix'] }, itemLootSets: { 'oak stick': ['forest'] } }
    )
    expect(weapon.isEquipment).toBe(true)
    expect(weapon.isWeapon).toBe(true)
    expect(weapon.hasDamage).toBe(true)
    expect(weapon.smallMax).toBe('4')
    expect(weapon.hasVendor).toBe(true)
    expect(weapon.vendors).toBe('Beatrix')
    expect(weapon.hasLootSet).toBe(true)
    expect(weapon.lootSets).toBe('forest')
  })

  it('flattens the categories to six, as the castable record does', () => {
    const record = itemToRecord(
      makeItem({
        properties: {
          categories: [{ name: 'Weapon' }, { name: 'Starter' }]
        }
      })
    )
    expect(record.category1).toBe('Weapon')
    expect(record.category2).toBe('Starter')
    expect(record.category6).toBe('')
  })

  it('reads a stat modifier into its stat column, and leaves the rest empty', () => {
    const record = itemToRecord(
      makeItem({
        properties: {
          statModifiers: {
            rows: [
              { key: 'BonusStr', value: '2' },
              { key: 'BonusHp', value: '50' }
            ],
            elementalModifiers: [],
            unknownStatKeys: []
          }
        }
      })
    )
    expect(record.statBonusStr).toBe('2')
    expect(record.statBonusHp).toBe('50')
    expect(record.statBonusDex).toBe('')
  })

  it('joins the list-valued fields rather than emitting an array', () => {
    // A CSV cell cannot hold an array, and `String([a, b])` would quietly produce
    // `a,b` with no quoting — a comma that breaks the column count.
    const record = itemToRecord(
      makeItem({
        properties: {
          tags: ['Consumable', 'Quest'],
          flags: ['Bound'],
          restrictions: {
            level: { min: '5', max: '' },
            ab: null,
            class: 'Rogue',
            gender: 'Neutral',
            castables: ['Wolf Fang Fist', 'Kelberoth Strike'],
            slotRestrictions: []
          }
        }
      })
    )
    expect(record.tags).toBe('Consumable, Quest')
    expect(record.flags).toBe('Bound')
    expect(record.castables).toBe('Wolf Fang Fist, Kelberoth Strike')
    expect(record.levelMin).toBe('5')
    expect(record.class).toBe('Rogue')
  })

  it('survives an item whose optional blocks are all absent', () => {
    // parseItemXml returns null for equipment, damage and use when the element is
    // missing, which is most items. A mapper that assumed objects would throw on
    // the first plain item in the library.
    const record = itemToRecord({ name: 'Rock' })
    expect(record.name).toBe('Rock')
    expect(record.slot).toBe('')
    expect(record.isWeapon).toBe(false)
    expect(record.useScript).toBe('')
  })
})

describe('ITEM_COLUMNS', () => {
  // The drift guard, matching the castable one. A field added to the record with no
  // column entry is invisible to the picker; a column entry with no field renders an
  // empty column. Neither fails loudly on its own.
  it('lists exactly the record fields, in the same order', () => {
    expect(ITEM_COLUMNS.map((c) => c.key)).toEqual(Object.keys(itemToRecord(makeItem())))
  })

  it('gives every column a non-empty label and group', () => {
    expect(ITEM_COLUMNS.length).toBeGreaterThan(50)
    for (const column of ITEM_COLUMNS) {
      expect(column.label, column.key).toBeTruthy()
      expect(column.group, column.key).toBeTruthy()
    }
  })

  it('has no duplicate keys', () => {
    const keys = ITEM_COLUMNS.map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('covers every stat key, generated rather than written out', () => {
    const statColumns = ITEM_COLUMNS.filter((c) => c.group === 'Stats').map((c) => c.key)
    expect(statColumns).toEqual(ITEM_STATS.map((s) => `stat${s.key}`))
  })
})
