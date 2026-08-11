// The castable report filter vocabulary (WP2, split per entity by WP3).
//
// A rule's `field` is a LOGICAL name, not a record key. `class` reads `classRaw`
// and applies the Universal rule; `category` reads all six category fields. The
// stored rule stays readable, and renaming a record key does not silently
// invalidate a saved report.

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
 * The closed field list for a castable report. A subset of the column universe on
 * purpose: not every one of its record fields is worth filtering on, and an open list invites a
 * rule nobody can read.
 *
 * `kind` tells the UI which editor to render. `values`, where present, is the
 * complete value list, so the UI offers a select rather than a free text field.
 */
export const CASTABLE_FILTER_FIELDS = [
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
