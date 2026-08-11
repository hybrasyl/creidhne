// The report filter vocabulary, as data (WP2).
//
// A preset's filter used to be a function — `(record) => !record.isTest &&
// !record.isGM`. A user report is stored as JSON, so it cannot hold one. So a
// filter is a rule list, and the built-in reports use the SAME vocabulary a user
// gets: a built-in a user cannot express is a built-in the user cannot clone.
//
// A rule's `field` is a LOGICAL name, not a record key. `class` reads `classRaw`
// and applies the Universal rule; `category` reads all six category fields. The
// stored rule stays readable, and renaming a record key does not silently
// invalidate a saved report.
//
// Electron-free, like the rest of src/shared: the renderer compiles the same
// rules for its live row-count preview that main compiles for the export.

import { ALL_CLASSES } from './castableRecord.js'

/** The `<Book>` values the schema allows, for the Book rule's value list. */
export const BOOKS = [
  'PrimarySkill',
  'SecondarySkill',
  'UtilitySkill',
  'PrimarySpell',
  'SecondarySpell',
  'UtilitySpell'
]

/** Not a class: the label `deriveClass` gives a castable anyone can learn. */
export const UNIVERSAL = 'Universal'

const lower = (v) => String(v ?? '').toLowerCase()

function classWords(record) {
  return String(record.classRaw ?? '')
    .split(/\s+/)
    .filter(Boolean)
}

/** No class, or all six, both mean "anyone can learn this" — as `deriveClass`. */
export function isUniversal(record) {
  const words = classWords(record)
  return words.length === 0 || ALL_CLASSES.every((c) => words.includes(c))
}

/**
 * `Class is Wizard` asks "can a Wizard learn this", so a Universal castable
 * matches it. `Class is Universal` selects the universal castables alone.
 *
 * Testing `classRaw` for the literal word would exclude every universal ability,
 * and a report missing the universal abilities still looks like a valid report.
 */
export function classMatches(record, value) {
  if (value === UNIVERSAL) return isUniversal(record)
  return isUniversal(record) || classWords(record).includes(value)
}

function recordCategories(record) {
  return [1, 2, 3, 4, 5, 6]
    .map((n) => record[`category${n}`])
    .filter(Boolean)
    .map(lower)
}

/**
 * Every operator, and the label the UI shows. Eight, each one expression.
 *
 * `has` / `hasNot` take a list from the field's `read`; the rest take a scalar.
 * `between` takes a two-element value.
 */
export const OPERATORS = {
  is: { label: 'is', test: (actual, value) => actual === value },
  isNot: { label: 'is not', test: (actual, value) => actual !== value },
  contains: { label: 'contains', test: (actual, value) => lower(actual).includes(lower(value)) },
  has: { label: 'has', test: (list, value) => list.includes(lower(value)) },
  hasNot: { label: 'does not have', test: (list, value) => !list.includes(lower(value)) },
  atLeast: { label: 'at least', test: (n, value) => Number.isFinite(n) && n >= Number(value) },
  atMost: { label: 'at most', test: (n, value) => Number.isFinite(n) && n <= Number(value) },
  between: {
    label: 'between',
    test: (n, value) =>
      Number.isFinite(n) && Array.isArray(value) && n >= Number(value[0]) && n <= Number(value[1])
  }
}

/**
 * The closed field list. A subset of the column universe on purpose: not every
 * one of the 70 record fields is worth filtering on, and an open list invites a
 * rule nobody can read.
 *
 * `kind` tells the UI which editor to render. `values`, where present, is the
 * complete value list, so the UI offers a select rather than a free text field.
 */
export const FILTERABLE_FIELDS = [
  {
    field: 'class',
    label: 'Class',
    kind: 'enum',
    ops: ['is', 'isNot'],
    values: [UNIVERSAL, ...ALL_CLASSES],
    // Not plain equality — see classMatches. Declared as a whole-record match so
    // the special case lives beside its reason instead of inside the compiler.
    matches: (record, op, value) =>
      op === 'is' ? classMatches(record, value) : !classMatches(record, value)
  },
  {
    field: 'book',
    label: 'Book',
    kind: 'enum',
    ops: ['is', 'isNot'],
    values: BOOKS,
    read: (record) => record.book ?? ''
  },
  {
    field: 'bookType',
    label: 'Type (skill or spell)',
    kind: 'enum',
    ops: ['is', 'isNot'],
    values: ['Skill', 'Spell'],
    read: (record) => record.bookType ?? ''
  },
  {
    field: 'isTest',
    label: 'Is test',
    kind: 'boolean',
    ops: ['is'],
    read: (record) => record.isTest === true
  },
  {
    field: 'isGM',
    label: 'Is GM',
    kind: 'boolean',
    ops: ['is'],
    read: (record) => record.isGM === true
  },
  {
    field: 'deprecated',
    label: 'Deprecated',
    kind: 'boolean',
    ops: ['is'],
    read: (record) => record.deprecated === true
  },
  {
    field: 'isAssail',
    label: 'Is assail',
    kind: 'boolean',
    ops: ['is'],
    read: (record) => record.isAssail === true
  },
  {
    field: 'hasTrainer',
    label: 'Has a trainer',
    kind: 'boolean',
    ops: ['is'],
    // A derived boolean, not the `location` display string. If that phrase ever
    // changes, a rule reading it matches nothing — and an empty report reads as
    // a valid answer.
    read: (record) => record.hasTrainer === true
  },
  {
    field: 'category',
    label: 'Category',
    kind: 'text',
    ops: ['has', 'hasNot'],
    // Membership across all six category fields, case-insensitive, matching how
    // the server sanitizes a category name.
    read: recordCategories
  },
  {
    field: 'level',
    label: 'Level',
    kind: 'number',
    ops: ['atLeast', 'atMost', 'between'],
    // `level` is a string carrying MIN_LEVEL when the XML states nothing. A value
    // that is not a number matches no comparison rather than reading as 0 —
    // `Number('')` and `Number(null)` are both 0, which would put a blank level
    // inside every at-most range.
    read: (record) => {
      const raw = record.level
      return raw === '' || raw == null ? NaN : Number(raw)
    }
  },
  {
    field: 'name',
    label: 'Name',
    kind: 'text',
    ops: ['contains'],
    read: (record) => record.name ?? ''
  }
]

const FIELDS_BY_NAME = new Map(FILTERABLE_FIELDS.map((f) => [f.field, f]))

/** Looks a filterable field up by its logical name, or null. */
export function getFilterableField(name) {
  return FIELDS_BY_NAME.get(name) ?? null
}

/**
 * Turns one rule into a predicate.
 *
 * Throws on an unknown field, an unknown operator, or an operator the field does
 * not allow. Throwing rather than skipping is deliberate: a rule that silently
 * does nothing produces a report with too many rows and no error, which is the
 * failure this whole file is written to avoid.
 */
export function compileRule(rule) {
  const spec = getFilterableField(rule?.field)
  if (!spec) throw new Error(`Unknown report field: ${rule?.field}`)

  const operator = OPERATORS[rule?.op]
  if (!operator) throw new Error(`Unknown report operator: ${rule?.op}`)
  if (!spec.ops.includes(rule.op)) {
    throw new Error(`Field "${spec.field}" does not support the operator "${rule.op}"`)
  }

  if (spec.matches) return (record) => spec.matches(record, rule.op, rule.value)
  return (record) => operator.test(spec.read(record), rule.value)
}

/**
 * Compiles `{ match, rules }` into one predicate over a record.
 *
 * An empty rule list matches every record — which is what the Balancing CSV's
 * `filter: null` meant before this existed. `match` is `all` or `any`; anything
 * else reads as `all`, because a report that quietly widened to `any` would
 * export more rows than asked for.
 */
export function compileRules(spec) {
  const rules = Array.isArray(spec?.rules) ? spec.rules : []
  if (rules.length === 0) return () => true

  const tests = rules.map(compileRule)
  return spec?.match === 'any'
    ? (record) => tests.some((test) => test(record))
    : (record) => tests.every((test) => test(record))
}

/**
 * Every reason a rule list is invalid, as messages. Empty means valid.
 *
 * Separate from `compileRules` because the two have different jobs: the loader
 * wants to report every fault in a hand-edited file at once, and the compiler
 * wants to refuse the first one it meets.
 */
export function validateRules(spec) {
  const problems = []
  if (spec?.match !== undefined && spec.match !== 'all' && spec.match !== 'any') {
    problems.push(`"match" must be "all" or "any", not ${JSON.stringify(spec.match)}`)
  }
  const rules = Array.isArray(spec?.rules) ? spec.rules : []
  rules.forEach((rule, i) => {
    try {
      compileRule(rule)
    } catch (err) {
      problems.push(`rule ${i + 1}: ${err.message}`)
    }
  })
  return problems
}
