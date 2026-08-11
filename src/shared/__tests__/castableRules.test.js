import { describe, it, expect } from 'vitest'
import { OPERATORS, compileRule, compileRules, findField, validateRules } from '../reportRules.js'
import {
  BOOKS,
  CASTABLE_FILTER_FIELDS,
  UNIVERSAL,
  classMatches,
  isUniversal
} from '../castableRules.js'
import { CASTABLE_EXPORT_PRESETS } from '../castableExportPresets.js'
import { ALL_CLASSES } from '../castableRecord.js'
import { resolveColumns, validateDefinition } from '../reportEntities.js'

// The engine takes a field list since WP3, so every call here passes the castable
// vocabulary. That argument IS the per-entity rule: an items field on a castable
// report is simply not in the list, and `compileRule` refuses it.
const FIELDS = CASTABLE_FILTER_FIELDS

// WP2. A report's filter is data, not a function, because a stored report is
// JSON. These tests cover the vocabulary itself; the proof that the re-expressed
// built-ins still produce the old bytes is
// src/main/__tests__/exportCastables.characterization.test.js, against the
// committed goldens.

const record = (fields = {}) => ({
  name: 'Beag Cradh',
  classRaw: 'Wizard',
  book: 'PrimarySpell',
  bookType: 'Spell',
  level: '11',
  isTest: false,
  isGM: false,
  deprecated: false,
  isAssail: false,
  hasTrainer: true,
  category1: 'Offense',
  category2: '',
  category3: '',
  category4: '',
  category5: '',
  category6: '',
  ...fields
})

const matches = (spec, fields) => compileRules(FIELDS, spec)(record(fields))
const one = (field, op, value, fields) =>
  matches({ match: 'all', rules: [{ field, op, value }] }, fields)

describe('compileRules — combining', () => {
  it('matches every record when there are no rules', () => {
    // Which is what the Balancing CSV's `filter: null` meant.
    expect(matches({ match: 'all', rules: [] }, { isTest: true })).toBe(true)
    expect(matches({})).toBe(true)
    expect(matches(null)).toBe(true)
  })

  it('requires every rule under all-of', () => {
    const spec = {
      match: 'all',
      rules: [
        { field: 'isTest', op: 'is', value: false },
        { field: 'level', op: 'atLeast', value: 20 }
      ]
    }
    expect(matches(spec, { level: '25' })).toBe(true)
    expect(matches(spec, { level: '5' })).toBe(false)
  })

  it('requires one rule under any-of', () => {
    const spec = {
      match: 'any',
      rules: [
        { field: 'isTest', op: 'is', value: true },
        { field: 'isGM', op: 'is', value: true }
      ]
    }
    expect(matches(spec, { isGM: true })).toBe(true)
    expect(matches(spec, {})).toBe(false)
  })

  it('reads an unrecognised match mode as all-of', () => {
    // Not as any-of: a report that quietly widened would export more rows than
    // the person asked for, and a report with too many rows still looks valid.
    const spec = {
      match: 'either',
      rules: [
        { field: 'isTest', op: 'is', value: true },
        { field: 'isGM', op: 'is', value: true }
      ]
    }
    expect(matches(spec, { isGM: true })).toBe(false)
  })
})

describe('compileRule — refusing what it cannot run', () => {
  // Throwing rather than skipping. A rule that silently does nothing produces a
  // report with too many rows and no error at all.
  it('throws on an unknown field', () => {
    expect(() => compileRule(FIELDS, { field: 'nope', op: 'is', value: 1 })).toThrow(
      /Unknown report field/
    )
  })

  it('throws on an unknown operator', () => {
    expect(() => compileRule(FIELDS, { field: 'name', op: 'startsWith', value: 'a' })).toThrow(
      /Unknown report operator/
    )
  })

  it('throws when the field does not allow that operator', () => {
    expect(() => compileRule(FIELDS, { field: 'isTest', op: 'contains', value: 'x' })).toThrow(
      /does not support the operator/
    )
  })
})

describe('the class rule', () => {
  it('treats no class and all six classes as Universal', () => {
    expect(isUniversal(record({ classRaw: '' }))).toBe(true)
    expect(isUniversal(record({ classRaw: ALL_CLASSES.join(' ') }))).toBe(true)
    expect(isUniversal(record({ classRaw: 'Wizard' }))).toBe(false)
  })

  it('matches a Universal castable for any named class', () => {
    // "Class is Wizard" asks what a Wizard can learn. Testing classRaw for the
    // literal word would drop every universal ability, and a report missing the
    // universal abilities still looks like a valid report.
    expect(one('class', 'is', 'Wizard', { classRaw: '' })).toBe(true)
    expect(one('class', 'is', 'Monk', { classRaw: '' })).toBe(true)
  })

  it('matches a named class against the raw class list', () => {
    expect(one('class', 'is', 'Wizard', { classRaw: 'Wizard Priest' })).toBe(true)
    expect(one('class', 'is', 'Rogue', { classRaw: 'Wizard Priest' })).toBe(false)
  })

  it('selects the universal castables alone for Class is Universal', () => {
    expect(one('class', 'is', UNIVERSAL, { classRaw: '' })).toBe(true)
    expect(one('class', 'is', UNIVERSAL, { classRaw: 'Wizard' })).toBe(false)
  })

  it('negates the same rule for is-not', () => {
    expect(one('class', 'isNot', 'Rogue', { classRaw: 'Wizard' })).toBe(true)
    expect(one('class', 'isNot', 'Wizard', { classRaw: 'Wizard' })).toBe(false)
    // A universal castable is learnable by a Rogue, so it is not "not Rogue".
    expect(classMatches(record({ classRaw: '' }), 'Rogue')).toBe(true)
  })
})

describe('the other operators', () => {
  it('compares a book exactly', () => {
    expect(one('book', 'is', 'PrimarySpell')).toBe(true)
    expect(one('book', 'isNot', 'PrimarySpell')).toBe(false)
    expect(BOOKS).toContain('UtilitySkill')
  })

  it('tests a boolean field', () => {
    expect(one('isTest', 'is', false)).toBe(true)
    expect(one('isTest', 'is', true, { isTest: true })).toBe(true)
    // A missing field reads as false rather than matching a true rule.
    expect(one('hasTrainer', 'is', true, { hasTrainer: undefined })).toBe(false)
  })

  it('finds a category in any of the six fields, ignoring case', () => {
    expect(one('category', 'has', 'offense')).toBe(true)
    expect(one('category', 'has', 'Healing')).toBe(false)
    expect(one('category', 'has', 'Healing', { category4: 'Healing' })).toBe(true)
    expect(one('category', 'hasNot', 'Healing')).toBe(true)
  })

  it('compares a level numerically, not as a string', () => {
    // '9' > '11' as strings. The record carries level as a string.
    expect(one('level', 'atMost', 10, { level: '9' })).toBe(true)
    expect(one('level', 'atMost', 10, { level: '11' })).toBe(false)
    expect(one('level', 'atLeast', 11)).toBe(true)
    expect(one('level', 'between', [10, 20])).toBe(true)
    expect(one('level', 'between', [1, 5])).toBe(false)
  })

  it('matches no comparison when the level is not a number', () => {
    // Rather than reading as 0, which would put it inside every at-most range.
    expect(one('level', 'atMost', 10, { level: '' })).toBe(false)
    expect(one('level', 'atLeast', 1, { level: 'x' })).toBe(false)
    expect(one('level', 'between', [0, 99], { level: null })).toBe(false)
  })

  it('matches a name substring, ignoring case', () => {
    expect(one('name', 'contains', 'cradh')).toBe(true)
    expect(one('name', 'contains', 'Mor')).toBe(false)
  })
})

describe('validateRules', () => {
  it('accepts a valid rule list', () => {
    expect(
      validateRules(FIELDS, { match: 'any', rules: [{ field: 'isGM', op: 'is', value: true }] })
    ).toEqual([])
  })

  it('reports every fault at once, numbered', () => {
    // The loader wants every fault in a hand-edited file, not just the first.
    const problems = validateRules(FIELDS, {
      match: 'some',
      rules: [
        { field: 'nope', op: 'is', value: 1 },
        { field: 'isGM', op: 'contains', value: 1 }
      ]
    })
    expect(problems).toHaveLength(3)
    expect(problems[0]).toMatch(/"match" must be "all" or "any"/)
    expect(problems[1]).toMatch(/^rule 1: Unknown report field/)
    expect(problems[2]).toMatch(/^rule 2: .*does not support/)
  })
})

describe('the vocabulary itself', () => {
  it('declares a label and at least one operator per field', () => {
    // Guards the guard: an empty field list would make every assertion here pass.
    expect(CASTABLE_FILTER_FIELDS.length).toBeGreaterThanOrEqual(11)
    for (const spec of CASTABLE_FILTER_FIELDS) {
      expect(spec.label, spec.field).toBeTruthy()
      expect(spec.ops.length, spec.field).toBeGreaterThan(0)
      // Every operator a field offers must exist, or the UI offers a rule that
      // throws only when the report runs.
      for (const op of spec.ops) expect(OPERATORS[op], `${spec.field}.${op}`).toBeTruthy()
      // Every field must be able to produce a value from a record, one way or
      // the other. A field with neither reads as undefined for every record.
      expect(Boolean(spec.read || spec.matches), spec.field).toBe(true)
      expect(findField(FIELDS, spec.field)).toBe(spec)
    }
  })

  it('offers a value list for every enum field', () => {
    for (const spec of CASTABLE_FILTER_FIELDS.filter((f) => f.kind === 'enum')) {
      expect(spec.values?.length, spec.field).toBeGreaterThan(0)
    }
  })
})

describe('the built-in reports', () => {
  it('name only fields the record carries', () => {
    // A column key the record lacks writes an empty cell and no error, so this
    // asserts the artifact. resolveColumns throws on an unknown key.
    expect(CASTABLE_EXPORT_PRESETS.length).toBe(3)
    for (const preset of CASTABLE_EXPORT_PRESETS) {
      expect(() => resolveColumns(preset.entity, preset.columns), preset.id).not.toThrow()
    }
  })

  it('state rules a user could have written', () => {
    for (const preset of CASTABLE_EXPORT_PRESETS) {
      expect(validateDefinition(preset), preset.id).toEqual([])
    }
  })
})
