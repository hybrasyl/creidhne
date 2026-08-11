// The entity registry (WP3).
//
// One report builder, one rule engine, one pair of serializers — and per entity, a
// record mapper, a column catalogue, a filter vocabulary and its built-in reports.
// Adding a type is adding a row here, not a second builder.
//
// **Validation is per entity, not against a union catalogue.** A union would accept
// `damageFormula` on an items report, and `recordsToCsv` writes an empty cell for a
// key the record does not hold — a blank column in a file somebody reads as data.
// That is the fault WP2 refused for an unknown key, and an entity mix-up is the
// same fault arriving from a second direction. The cost is that nothing can be
// checked until `entity` is in hand, which is why `reportDefinitionSchema`
// validates at the object level.
//
// `subdir` is the world folder the records come from. Main reads it, so main needs
// no per-entity knowledge beyond which parser to call.

import { CASTABLE_COLUMNS, castableToRecord } from './castableRecord.js'
import { CASTABLE_FILTER_FIELDS } from './castableRules.js'
import { CASTABLE_EXPORT_PRESETS } from './castableExportPresets.js'
import { ITEM_COLUMNS, itemToRecord } from './itemRecord.js'
import { ITEM_FILTER_FIELDS } from './itemRules.js'
import { ITEM_REPORT_PRESETS } from './itemReportPresets.js'
import { compileRules, validateRules } from './reportRules.js'

export const REPORT_ENTITIES = [
  {
    entity: 'castables',
    label: 'Castables',
    subdir: 'castables',
    columns: CASTABLE_COLUMNS,
    filterFields: CASTABLE_FILTER_FIELDS,
    toRecord: castableToRecord,
    presets: CASTABLE_EXPORT_PRESETS
  },
  {
    entity: 'items',
    label: 'Items',
    subdir: 'items',
    columns: ITEM_COLUMNS,
    filterFields: ITEM_FILTER_FIELDS,
    toRecord: itemToRecord,
    presets: ITEM_REPORT_PRESETS
  }
]

/** Every registered entity name, for a schema enum or a UI selector. */
export const REPORT_ENTITY_NAMES = REPORT_ENTITIES.map((e) => e.entity)

const BY_NAME = new Map(REPORT_ENTITIES.map((e) => [e.entity, e]))

const COLUMN_MAPS = new Map(
  REPORT_ENTITIES.map((e) => [e.entity, new Map(e.columns.map((c) => [c.key, c]))])
)

/** Looks an entity up, or null. */
export function findEntity(entity) {
  return BY_NAME.get(entity) ?? null
}

/**
 * Looks an entity up, or throws. Use this wherever a missing entity means the
 * caller is about to do something wrong — running a report, resolving columns —
 * rather than merely rendering an empty list.
 */
export function getEntity(entity) {
  const found = findEntity(entity)
  if (!found) throw new Error(`Unknown report entity: ${entity}`)
  return found
}

/** Whether a key names a field that entity's record actually carries. */
export function isEntityField(entity, key) {
  return COLUMN_MAPS.get(entity)?.has(key) === true
}

/** That entity's filter vocabulary, or an empty list for an unknown entity. */
export function filterFieldsFor(entity) {
  return findEntity(entity)?.filterFields ?? []
}

/** That entity's built-in reports, or an empty list. */
export function presetsFor(entity) {
  return findEntity(entity)?.presets ?? []
}

/** Every built-in report across every entity, for the UI's grouped list. */
export function allPresets() {
  return REPORT_ENTITIES.flatMap((e) => e.presets)
}

/**
 * Normalizes a report's column list to `{ key, header }` pairs.
 *
 * A stored report holds bare record keys and takes its header from the entity's
 * catalogue label. A built-in holds explicit pairs, because its headers are a
 * contract with a consumer outside this repo. Both arrive here, so the serializers
 * see one shape.
 *
 * **Throws on a key that entity's record does not carry**, which includes a key
 * belonging to a different entity. `recordsToCsv` writes an empty cell for an
 * unknown key, so a typo — or a castable column on an items report — would
 * otherwise produce a silent blank column.
 */
export function resolveColumns(entity, columns) {
  const catalogue = COLUMN_MAPS.get(entity)
  if (!catalogue) throw new Error(`Unknown report entity: ${entity}`)
  return (columns ?? []).map((column) => {
    const key = typeof column === 'string' ? column : column?.key
    const known = catalogue.get(key)
    if (!known) throw new Error(`Unknown ${entity} field: ${key}`)
    if (typeof column === 'string') return { key, header: known.label }
    return { key, header: column.header ?? known.label }
  })
}

/** Compiles a definition's rules against its own entity's vocabulary. */
export function compileDefinition(definition) {
  return compileRules(filterFieldsFor(definition?.entity), definition)
}

/**
 * Every reason a definition is invalid, as messages. Empty means valid.
 *
 * Reports the entity fault first and stops: with an unknown entity there is no
 * catalogue to check columns against, and "unknown field" repeated once per column
 * would bury the one message that explains all of them.
 */
export function validateDefinition(definition) {
  const entity = definition?.entity
  if (!findEntity(entity)) {
    return [`unknown entity ${JSON.stringify(entity)}`]
  }

  const problems = []
  const columns = Array.isArray(definition?.columns) ? definition.columns : []
  if (columns.length === 0) problems.push('a report needs at least one column')
  for (const column of columns) {
    const key = typeof column === 'string' ? column : column?.key
    if (!isEntityField(entity, key)) {
      problems.push(`column ${JSON.stringify(key)} is not a ${entity} field`)
    }
  }
  problems.push(...validateRules(filterFieldsFor(entity), definition))
  return problems
}
