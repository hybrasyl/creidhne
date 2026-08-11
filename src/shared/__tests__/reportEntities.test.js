import { describe, it, expect } from 'vitest'
import {
  REPORT_ENTITIES,
  REPORT_ENTITY_NAMES,
  allPresets,
  compileDefinition,
  filterFieldsFor,
  findEntity,
  getEntity,
  isEntityField,
  presetsFor,
  resolveColumns,
  validateDefinition
} from '../reportEntities.js'
import { OPERATORS } from '../reportRules.js'

/**
 * WP3. The registry is the whole of "entity-agnostic": one builder, one rule engine,
 * one pair of serializers, and per entity a mapper, a catalogue, a vocabulary and its
 * built-in reports.
 *
 * **The load-bearing assertion in this file is that a column valid for one entity is
 * rejected for another.** A union catalogue would accept `damageFormula` on an items
 * report, and `recordsToCsv` writes an empty cell for a key the record does not
 * hold — a blank column in a file somebody reads as data. That is the same fault WP2
 * refused for a misspelt key, arriving from a second direction, and it is the reason
 * validation is per entity rather than global.
 */

describe('the registry', () => {
  it('registers the entities it is meant to', () => {
    // Guards the guard. An empty registry satisfies every containment assertion
    // below, so the count and the names are asserted first.
    expect(REPORT_ENTITIES.length).toBeGreaterThanOrEqual(2)
    expect(REPORT_ENTITY_NAMES).toContain('castables')
    expect(REPORT_ENTITY_NAMES).toContain('items')
  })

  it('gives every entity a complete row', () => {
    // A half-registered entity is worse than an absent one: the selector offers it
    // and the run throws.
    for (const row of REPORT_ENTITIES) {
      expect(row.label, row.entity).toBeTruthy()
      expect(row.subdir, row.entity).toBeTruthy()
      expect(row.columns.length, row.entity).toBeGreaterThan(0)
      expect(row.filterFields.length, row.entity).toBeGreaterThan(0)
      expect(typeof row.toRecord, row.entity).toBe('function')
      expect(Array.isArray(row.presets), row.entity).toBe(true)
      expect(findEntity(row.entity)).toBe(row)
    }
  })

  it('throws for an entity it does not know', () => {
    expect(findEntity('creatures')).toBeNull()
    expect(() => getEntity('creatures')).toThrow(/Unknown report entity/)
  })

  it('declares every filter operator it offers', () => {
    // A vocabulary offering an operator the engine does not have would produce a rule
    // that only fails when the report runs.
    for (const row of REPORT_ENTITIES) {
      for (const field of row.filterFields) {
        expect(field.label, field.field).toBeTruthy()
        expect(field.ops.length, field.field).toBeGreaterThan(0)
        for (const op of field.ops) {
          expect(OPERATORS[op], `${row.entity}.${field.field}.${op}`).toBeTruthy()
        }
        expect(Boolean(field.read || field.matches), field.field).toBe(true)
      }
    }
  })
})

describe('per-entity columns', () => {
  it('resolves a bare key to the entity catalogue label', () => {
    expect(resolveColumns('items', ['name', 'value'])).toEqual([
      { key: 'name', header: 'Name' },
      { key: 'value', header: 'Value' }
    ])
  })

  it('keeps an explicit header, which is what a built-in contract needs', () => {
    expect(resolveColumns('items', [{ key: 'value', header: 'Cost' }])).toEqual([
      { key: 'value', header: 'Cost' }
    ])
  })

  it('rejects a column belonging to another entity', () => {
    // The assertion this file exists for. `damageFormula` is a real castable field.
    expect(isEntityField('castables', 'damageFormula')).toBe(true)
    expect(isEntityField('items', 'damageFormula')).toBe(false)
    expect(() => resolveColumns('items', ['damageFormula'])).toThrow(
      /Unknown items field: damageFormula/
    )
    // And the other way round, so this is not a one-directional check.
    expect(isEntityField('items', 'weaponType')).toBe(true)
    expect(isEntityField('castables', 'weaponType')).toBe(false)
    expect(() => resolveColumns('castables', ['weaponType'])).toThrow(/Unknown castables field/)
  })

  it('rejects an unknown entity rather than resolving nothing', () => {
    expect(() => resolveColumns('creatures', ['name'])).toThrow(/Unknown report entity/)
  })
})

describe('per-entity rules', () => {
  it('compiles a rule against its own entity vocabulary', () => {
    const definition = {
      entity: 'items',
      match: 'all',
      rules: [{ field: 'isWeapon', op: 'is', value: true }]
    }
    expect(compileDefinition(definition)({ isWeapon: true })).toBe(true)
    expect(compileDefinition(definition)({ isWeapon: false })).toBe(false)
  })

  it('refuses a rule from another entity', () => {
    // `isGM` is a castable field. On an items report it is simply not in the list,
    // so the engine's unknown-field path covers the entity mix-up too.
    expect(() =>
      compileDefinition({
        entity: 'items',
        match: 'all',
        rules: [{ field: 'isGM', op: 'is', value: true }]
      })
    ).toThrow(/Unknown report field: isGM/)
  })

  it('keeps the two vocabularies genuinely different', () => {
    const castable = filterFieldsFor('castables').map((f) => f.field)
    const item = filterFieldsFor('items').map((f) => f.field)
    expect(castable).toContain('isGM')
    expect(item).not.toContain('isGM')
    expect(item).toContain('isWeapon')
    expect(castable).not.toContain('isWeapon')
    // `name` and `category` are shared by name and by intent, which is fine: each
    // entity declares its own reader.
    expect(castable).toContain('name')
    expect(item).toContain('name')
    expect(filterFieldsFor('creatures')).toEqual([])
  })
})

describe('validateDefinition', () => {
  const items = {
    id: 'r_1',
    label: 'Weapons',
    entity: 'items',
    format: 'csv',
    columns: ['name', 'weaponType'],
    match: 'all',
    rules: [{ field: 'isWeapon', op: 'is', value: true }]
  }

  it('accepts a valid definition', () => {
    expect(validateDefinition(items)).toEqual([])
  })

  it('names an unknown entity once, and stops', () => {
    // Once, not once per column: with no catalogue there is nothing to check the
    // columns against, and repeating "unknown field" per column would bury the one
    // message that explains all of them.
    const problems = validateDefinition({ ...items, entity: 'creatures' })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/unknown entity "creatures"/)
  })

  it('requires at least one column', () => {
    expect(validateDefinition({ ...items, columns: [] })).toContain(
      'a report needs at least one column'
    )
  })

  it('reports a wrong-entity column and a wrong-entity rule together', () => {
    const problems = validateDefinition({
      ...items,
      columns: ['name', 'damageFormula'],
      rules: [{ field: 'isGM', op: 'is', value: true }]
    })
    expect(problems.join('\n')).toMatch(/column "damageFormula" is not a items field/)
    expect(problems.join('\n')).toMatch(/rule 1: Unknown report field: isGM/)
  })
})

describe('the built-in reports', () => {
  it('are registered under the entity they name', () => {
    for (const row of REPORT_ENTITIES) {
      for (const preset of row.presets) {
        expect(preset.entity, preset.id).toBe(row.entity)
      }
    }
    expect(presetsFor('castables')).toHaveLength(3)
    expect(presetsFor('items')).toHaveLength(1)
    expect(allPresets()).toHaveLength(4)
    expect(presetsFor('creatures')).toEqual([])
  })

  it('name only fields their own entity carries, and rules it can compile', () => {
    // Asserts the artifact: a typo in a preset's column list writes a blank column
    // and no error, and a preset is not exercised by any other test until someone
    // runs it.
    for (const preset of allPresets()) {
      expect(() => resolveColumns(preset.entity, preset.columns), preset.id).not.toThrow()
      expect(validateDefinition(preset), preset.id).toEqual([])
    }
  })

  it('give every built-in a distinct id', () => {
    const ids = allPresets().map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
