import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ELEMENT_TABLE as PACKAGE_DEFAULT,
  resolveElementTable as packageResolve
} from '@eriscorp/hybindex-ts'
import {
  DEFAULT_ELEMENT_TABLE,
  elementOptions,
  elementWarning,
  resolveElementTable,
  selectorWarnings,
  splitSelectors
} from '../elementOptions.js'

// The element choices of the editors (HTOO-581). resolveElementTable is a copy
// of hybindex-ts's, because the renderer cannot import the package; the first
// block holds the two together.

const table = (elements, groups = {}, defaultElement = null) => ({
  elements,
  groups,
  defaultElement
})

const REGISTRY = table(['Force', 'Fire', 'Water', 'Wind', 'Earth', 'Undead'], {
  Cardinal: ['Fire', 'Water', 'Wind', 'Earth']
})
const LEGACY = table(['None', 'Fire', 'Wind', 'Earth', 'Water', 'Wood'])

const INDEXES = {
  'no tables': {},
  'one table, no configs': { elementTables: { HybElements: LEGACY } },
  'one table, a config without the attribute': {
    elementTables: { HybElements: LEGACY },
    serverconfigElementTables: { default: null }
  },
  'two tables, the default config picks one': {
    elementTables: { HybElements: LEGACY, HybElements2: REGISTRY },
    serverconfigElementTables: { default: 'HybElements2', qa: 'HybElements' }
  },
  'two tables, the default config names neither': {
    elementTables: { HybElements: LEGACY, HybElements2: REGISTRY },
    serverconfigElementTables: { default: 'Missing' }
  },
  'two tables, a table named default and a config without the attribute': {
    elementTables: { default: REGISTRY, other: LEGACY },
    serverconfigElementTables: { default: null }
  },
  'two tables, no configs': { elementTables: { a: LEGACY, b: REGISTRY } }
}

describe('resolveElementTable agrees with hybindex-ts', () => {
  it('has the same default table name', () => {
    expect(DEFAULT_ELEMENT_TABLE).toBe(PACKAGE_DEFAULT)
  })

  for (const [label, index] of Object.entries(INDEXES)) {
    for (const config of [undefined, 'default', 'qa', 'missing']) {
      it(`${label}, config ${config}`, () => {
        expect(resolveElementTable(index, config)).toBe(packageResolve(index, config))
      })
    }
  }

  it('the cases reach every outcome', () => {
    // Guard the guard: a table chosen by config, the only table, and none.
    const results = Object.values(INDEXES).map((i) => resolveElementTable(i, 'default'))
    expect(results).toContain('HybElements2')
    expect(results).toContain('HybElements')
    expect(results).toContain(null)
  })
})

describe('elementOptions', () => {
  it('offers the active table: keys, groups as Random:, and the state selectors', () => {
    const o = elementOptions(INDEXES['two tables, the default config picks one'])
    expect(o.table).toBe('HybElements2')
    expect(o.keys).toEqual(REGISTRY.elements)
    expect(o.selectors).toEqual([
      ...REGISTRY.elements,
      'Random:Cardinal',
      'Current',
      'Belt',
      'Necklace'
    ])
  })

  it('without an active table, offers the keys of every table', () => {
    const o = elementOptions({
      ...INDEXES['two tables, no configs'],
      elementnames: ['Earth', 'Fire', 'Force']
    })
    expect(o.table).toBeNull()
    expect(o.keys).toEqual(['Earth', 'Fire', 'Force'])
    expect(o.groups).toEqual([])
  })

  it('works on an index that has no element fields yet', () => {
    expect(elementOptions({}).keys).toEqual([])
    expect(elementOptions(undefined).selectors).toEqual(['Current', 'Belt', 'Necklace'])
  })
})

describe('warnings', () => {
  const registry = elementOptions(INDEXES['two tables, the default config picks one'])
  const legacy = elementOptions(INDEXES['one table, no configs'])
  const none = elementOptions(INDEXES['two tables, no configs'])

  it('an element field: no warning for a key of the table, or for empty', () => {
    expect(elementWarning('Fire', registry)).toBeNull()
    expect(elementWarning('', registry)).toBeNull()
  })

  it('an element field: a key the table does not define', () => {
    expect(elementWarning('Metal', registry)).toBe(
      'Metal is not an element of the table HybElements2.'
    )
  })

  it('names the old names, even where the old table defines them', () => {
    // world's table still has None and Wood rows; the migration renames them.
    expect(elementWarning('None', legacy)).toMatch(/None is not an element/)
    expect(elementWarning('Wood', legacy)).toBe('Wood is now Nature.')
  })

  it('without an active table, warns only about the old names', () => {
    expect(elementWarning('Anything', none)).toBeNull()
    expect(elementWarning('Wood', none)).toBe('Wood is now Nature.')
  })

  it('a selector list: state selectors, keys and groups pass', () => {
    expect(selectorWarnings('Current Fire Random:Cardinal Belt', registry)).toEqual([])
  })

  it('a selector list: each problem, in order', () => {
    expect(selectorWarnings('Earth Wind RandomTemuair Random:Hot RandomFour', registry)).toEqual([
      'RandomTemuair is now Random:Cardinal.',
      'Hot is not a group of the table HybElements2.',
      'RandomFour is not an element or a selector of the table HybElements2.'
    ])
  })

  it('splits a selector list on any whitespace', () => {
    expect(splitSelectors(' Earth  Wind\tFire ')).toEqual(['Earth', 'Wind', 'Fire'])
    expect(splitSelectors(undefined)).toEqual([])
  })
})
