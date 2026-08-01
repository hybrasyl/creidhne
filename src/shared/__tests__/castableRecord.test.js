import { describe, it, expect } from 'vitest'
import {
  castableToRecord,
  CASTABLE_COLUMNS,
  ALL_CLASSES,
  bookToType,
  deriveType,
  deriveIcon,
  deriveClass,
  formatMats,
  deriveCastCostSummary,
  formatCastCost,
  deriveShape,
  deriveLocation
} from '../castableRecord.js'

// The derivations used to live inside two export functions — one of them inside
// an IPC handler, so it had no test at all. They are asserted here once, at the
// record level, which is what stops the two exports drifting again.

describe('bookToType — balancing label', () => {
  it('collapses every skill book to Skill and every spell book to Spell', () => {
    expect(bookToType('PrimarySkill')).toBe('Skill')
    expect(bookToType('SecondarySkill')).toBe('Skill')
    expect(bookToType('UtilitySkill')).toBe('Skill')
    expect(bookToType('PrimarySpell')).toBe('Spell')
    expect(bookToType('UtilitySpell')).toBe('Spell')
  })

  it('passes an unknown book through and maps empty to empty', () => {
    expect(bookToType('Mystery')).toBe('Mystery')
    expect(bookToType('')).toBe('')
    expect(bookToType(undefined)).toBe('')
  })
})

describe('deriveType — web label', () => {
  it('keeps the utility books distinct, unlike bookToType', () => {
    expect(deriveType('UtilitySkill')).toBe('Utility Skill')
    expect(deriveType('UtilitySpell')).toBe('Utility Spell')
    expect(bookToType('UtilitySpell')).toBe('Spell')
  })

  it('maps the primary and secondary books to Skill or Spell', () => {
    expect(deriveType('PrimarySkill')).toBe('Skill')
    expect(deriveType('SecondarySkill')).toBe('Skill')
    expect(deriveType('PrimarySpell')).toBe('Spell')
    expect(deriveType('SecondarySpell')).toBe('Spell')
  })

  it('passes an unknown book through', () => {
    expect(deriveType('Mystery')).toBe('Mystery')
  })
})

describe('deriveIcon', () => {
  it('prefixes spell books with spell and everything else with skill', () => {
    expect(deriveIcon('PrimarySpell', '42')).toBe('spell42.png')
    expect(deriveIcon('UtilitySpell', '7')).toBe('spell7.png')
    expect(deriveIcon('PrimarySkill', '42')).toBe('skill42.png')
    expect(deriveIcon('SecondarySkill', '1')).toBe('skill1.png')
  })

  it('does not throw on a missing book', () => {
    expect(deriveIcon(undefined, '3')).toBe('skill3.png')
  })
})

describe('deriveClass', () => {
  it('treats an absent class as Universal', () => {
    expect(deriveClass('')).toBe('Universal')
    expect(deriveClass(undefined)).toBe('Universal')
  })

  it('treats all six classes as Universal', () => {
    expect(deriveClass(ALL_CLASSES.join(' '))).toBe('Universal')
  })

  it('treats all six in any order as Universal', () => {
    expect(deriveClass('Peasant Monk Rogue Priest Wizard Warrior')).toBe('Universal')
  })

  it('leaves a genuine subset alone', () => {
    expect(deriveClass('Wizard')).toBe('Wizard')
    expect(deriveClass('Wizard Priest')).toBe('Wizard Priest')
  })
})

describe('formatMats', () => {
  it('reports No Cost for a missing requirement', () => {
    expect(formatMats(null)).toBe('No Cost')
  })

  it('reports No Cost for a requirement with neither gold nor items', () => {
    expect(formatMats({ gold: '', items: [] })).toBe('No Cost')
  })

  it('prefixes a count only when the quantity is above one', () => {
    expect(
      formatMats({
        gold: '5000',
        items: [
          { itemName: 'Emerald', quantity: '1' },
          { itemName: 'Ruby', quantity: '3' }
        ]
      })
    ).toBe('5000 gold, Emerald, 3 Ruby')
  })

  it('omits gold when there is none', () => {
    expect(formatMats({ items: [{ itemName: 'Ruby', quantity: '1' }] })).toBe('Ruby')
  })
})

describe('deriveCastCostSummary — balancing view', () => {
  it('orders costs Hp, Mp, Gold, Item regardless of input order', () => {
    expect(
      deriveCastCostSummary([
        { type: 'Gold', value: '100' },
        { type: 'Hp', value: '10' },
        { type: 'Mp', value: '20' }
      ])
    ).toBe('10 HP, 20 MP, 100 Gold')
  })

  it('appends an item count only above one', () => {
    expect(deriveCastCostSummary([{ type: 'Item', itemName: 'Ruby', quantity: 2 }])).toBe('Ruby x2')
    expect(deriveCastCostSummary([{ type: 'Item', itemName: 'Ruby', quantity: 1 }])).toBe('Ruby')
  })

  it('returns empty for no costs', () => {
    expect(deriveCastCostSummary([])).toBe('')
    expect(deriveCastCostSummary(undefined)).toBe('')
  })
})

describe('formatCastCost — web view', () => {
  it('renders source-stat multipliers as percentages', () => {
    expect(formatCastCost([{ type: 'Mp', value: 'SOURCEBASEMP * 0.25' }])).toBe('25% of Base Mana')
    expect(formatCastCost([{ type: 'Hp', value: 'SOURCEBASEHP * 0.5' }])).toBe('50% of Base Health')
    expect(formatCastCost([{ type: 'Gold', value: 'SOURCEGOLD * 0.1' }])).toBe('10% of Gold')
  })

  it('rounds a fractional percentage', () => {
    expect(formatCastCost([{ type: 'Mp', value: 'SOURCEBASEMP * 0.255' }])).toBe('26% of Base Mana')
  })

  it('renders a bare source stat as 100%', () => {
    expect(formatCastCost([{ type: 'Hp', value: 'SOURCEBASEHP' }])).toBe('100% of Base Health')
    expect(formatCastCost([{ type: 'Mp', value: 'SOURCEBASEMP' }])).toBe('100% of Base Mana')
    expect(formatCastCost([{ type: 'Gold', value: 'SOURCEGOLD' }])).toBe('100% of Gold')
  })

  it('renders plain numeric costs with their unit', () => {
    expect(formatCastCost([{ type: 'Hp', value: '50' }])).toBe('50 HP')
    expect(formatCastCost([{ type: 'Mp', value: '25' }])).toBe('25 Mana')
    expect(formatCastCost([{ type: 'Gold', value: '500' }])).toBe('500 Gold')
  })

  it('renders an item cost with its quantity, defaulting to one', () => {
    expect(formatCastCost([{ type: 'Item', itemName: 'Ruby', quantity: '2' }])).toBe('2 Ruby')
    expect(formatCastCost([{ type: 'Item', itemName: 'Ruby' }])).toBe('1 Ruby')
  })

  it('joins several costs in input order', () => {
    expect(
      formatCastCost([
        { type: 'Gold', value: 'SOURCEGOLD * 0.1' },
        { type: 'Item', itemName: 'Ruby', quantity: '2' }
      ])
    ).toBe('10% of Gold, 2 Ruby')
  })

  it('returns empty for no costs', () => {
    expect(formatCastCost([])).toBe('')
    expect(formatCastCost(undefined)).toBe('')
  })
})

describe('deriveShape', () => {
  it('describes each shape with its dimension', () => {
    expect(deriveShape([{ radius: '2' }], [], [], [], [])).toBe('Cross(r=2)')
    expect(deriveShape([], [{ side: '3' }], [], [], [])).toBe('Square(s=3)')
    expect(deriveShape([], [], [{ radius: '1' }], [], [])).toBe('Cone(r=1)')
    expect(deriveShape([], [], [], [{ length: '4' }], [])).toBe('Line(len=4)')
    expect(deriveShape([], [], [], [], [{}])).toBe('Tile')
  })

  it('counts rather than describes when there is more than one line or tile', () => {
    expect(deriveShape([], [], [], [{ length: '4' }, { length: '5' }], [])).toBe('Line x2')
    expect(deriveShape([], [], [], [], [{}, {}, {}])).toBe('Tile x3')
  })

  it('joins every shape present, in a fixed order', () => {
    expect(
      deriveShape([{ radius: '2' }], [{ side: '3' }], [{ radius: '1' }], [{ length: '4' }], [{}])
    ).toBe('Cross(r=2), Square(s=3), Cone(r=1), Line(len=4), Tile')
  })

  it('returns empty when there are no shapes', () => {
    expect(deriveShape()).toBe('')
  })
})

describe('deriveLocation', () => {
  it('joins the trainers from the index, looked up by lowercased name', () => {
    const ctx = { castableTrainers: { 'ard ioc': ['Mileth Priest', 'Danaan Priest'] } }
    expect(deriveLocation('Ard Ioc', ctx)).toBe('Mileth Priest, Danaan Priest')
  })

  it('falls back to the quest string only when there is no trainer', () => {
    expect(deriveLocation('Whatever', { givenViaScript: true })).toBe('Awarded by a Quest')
    expect(
      deriveLocation('Ard Ioc', {
        castableTrainers: { 'ard ioc': ['Mileth Priest'] },
        givenViaScript: true
      })
    ).toBe('Mileth Priest')
  })

  it('returns empty when there is neither a trainer nor a script', () => {
    expect(deriveLocation('Ard Ioc', {})).toBe('')
    expect(deriveLocation('Ard Ioc')).toBe('')
  })
})

// A castable shaped the way parseCastableXml returns one.
function makeCastable(overrides = {}) {
  return {
    name: 'Ard Ioc',
    book: 'PrimarySpell',
    icon: '42',
    elements: 'None',
    lines: '2',
    cooldown: '5',
    class: 'Priest',
    isAssail: false,
    meta: {},
    descriptions: [{ text: 'Heals a target.' }],
    categories: [],
    castCosts: [],
    intents: [],
    requirements: [],
    statuses: { add: [], remove: [] },
    heal: null,
    damage: null,
    ...overrides
  }
}

describe('castableToRecord', () => {
  it('carries the friendly derivations as fields', () => {
    const r = castableToRecord(makeCastable(), {
      castableTrainers: { 'ard ioc': ['Mileth Priest'] }
    })
    expect(r.name).toBe('Ard Ioc')
    expect(r.icon).toBe('spell42.png')
    expect(r.iconId).toBe('42')
    expect(r.type).toBe('Spell')
    expect(r.class).toBe('Priest')
    expect(r.subclass).toBe('Priest')
    expect(r.location).toBe('Mileth Priest')
    expect(r.description).toBe('Heals a target.')
  })

  it('lets a specialty override the subclass but not the class', () => {
    const r = castableToRecord(makeCastable({ meta: { specialty: 'Cleric' } }))
    expect(r.class).toBe('Priest')
    expect(r.subclass).toBe('Cleric')
    expect(r.specialty).toBe('Cleric')
  })

  it('keeps the raw class beside the Universal-collapsed one', () => {
    const r = castableToRecord(makeCastable({ class: ALL_CLASSES.join(' ') }))
    expect(r.classRaw).toBe(ALL_CLASSES.join(' '))
    expect(r.class).toBe('Universal')
  })

  // The divergence WP1 was asked to resolve: with no <Requirement> at all the
  // balancing export showed a blank stat where the website showed the minimum.
  // 3 is the minimum stat and 1 the minimum level, so blank now reads as the
  // minimum everywhere and there is one field rather than two.
  it('reads a missing requirement as the minimums', () => {
    const r = castableToRecord(makeCastable({ requirements: [] }))
    expect([r.str, r.int, r.wis, r.con, r.dex]).toEqual(['3', '3', '3', '3', '3'])
    expect(r.level).toBe('1')
    expect(r.mats).toBe('No Cost')
  })

  it('reads a requirement with no Physical or Level block as the minimums', () => {
    const r = castableToRecord(makeCastable({ requirements: [{ class: 'Priest', levelMin: '' }] }))
    expect(r.str).toBe('3')
    expect(r.level).toBe('1')
    expect(r.reqClass).toBe('Priest')
  })

  it('uses the requirement values when there is one', () => {
    const r = castableToRecord(
      makeCastable({
        requirements: [
          { class: 'Priest', levelMin: '33', str: '11', int: '22', wis: '33', con: '44', dex: '55' }
        ]
      })
    )
    expect([r.str, r.int, r.wis, r.con, r.dex]).toEqual(['11', '22', '33', '44', '55'])
    expect(r.level).toBe('33')
  })

  // A stated value passes through even below the minimum, so bad data stays
  // visible rather than being silently corrected to 3.
  it('does not clamp a stated stat up to the minimum', () => {
    const r = castableToRecord(makeCastable({ requirements: [{ str: '1', levelMin: '0' }] }))
    expect(r.str).toBe('1')
    expect(r.level).toBe('0')
  })

  it('keeps both cast-cost views', () => {
    const r = castableToRecord(
      makeCastable({ castCosts: [{ type: 'Mp', value: 'SOURCEBASEMP * 0.25' }] })
    )
    expect(r.castCostSummary).toBe('SOURCEBASEMP * 0.25 MP')
    expect(r.castCost).toBe('25% of Base Mana')
  })

  it('flattens only the first six categories', () => {
    const r = castableToRecord(makeCastable({ categories: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }))
    expect(r.category1).toBe('a')
    expect(r.category6).toBe('f')
    expect(r.raw.categories).toHaveLength(7)
  })

  it('flattens three status adds and four removes', () => {
    const r = castableToRecord(
      makeCastable({
        statuses: {
          add: [{ name: 'Poison', duration: '10', intensity: '1', tick: '2' }],
          remove: [{ name: 'Debuff', isCategory: true, quantity: '1' }]
        }
      })
    )
    expect(r.statusAdd1Name).toBe('Poison')
    expect(r.statusAdd1Duration).toBe('10')
    expect(r.statusAdd2Name).toBe('')
    expect(r.statusRemove1Name).toBe('Debuff')
    expect(r.statusRemove1IsCategory).toBe(true)
    expect(r.statusRemove2IsCategory).toBe(false)
  })

  it('reads the meta flags', () => {
    const r = castableToRecord(
      makeCastable({ meta: { isTest: true, isGM: true, deprecated: true, givenViaScript: true } })
    )
    expect([r.isTest, r.isGM, r.deprecated, r.givenViaScript]).toEqual([true, true, true, true])
  })

  it('defaults the meta flags to false when there is no meta', () => {
    const r = castableToRecord(makeCastable({ meta: undefined }))
    expect([r.isTest, r.isGM, r.deprecated, r.givenViaScript]).toEqual([false, false, false, false])
  })

  it('exposes the dropped detail under raw for the report builder', () => {
    const r = castableToRecord(makeCastable({ heal: { kind: 'Formula', formula: 'X' } }))
    expect(r.healType).toBe('Formula')
    expect(r.raw.heal).toEqual({ kind: 'Formula', formula: 'X' })
    expect(r.raw).toHaveProperty('requirements')
    expect(r.raw).toHaveProperty('meta')
  })
})

describe('CASTABLE_COLUMNS', () => {
  // The drift guard. A field added to the record without a column entry would
  // be invisible to WP2's picker; a column entry with no field would render an
  // empty column. Neither fails loudly on its own.
  it('lists exactly the record fields, in the same order', () => {
    const { raw, ...flat } = castableToRecord(makeCastable())
    expect(raw).toBeDefined()
    expect(CASTABLE_COLUMNS.map((c) => c.key)).toEqual(Object.keys(flat))
  })

  it('gives every column a non-empty label and group', () => {
    for (const col of CASTABLE_COLUMNS) {
      expect(col.label, col.key).toBeTruthy()
      expect(col.group, col.key).toBeTruthy()
    }
  })

  it('has no duplicate keys', () => {
    const keys = CASTABLE_COLUMNS.map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
