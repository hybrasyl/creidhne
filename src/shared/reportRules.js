// The report rule engine (WP2), entity-agnostic since WP3.
//
// A preset's filter used to be a function — `(record) => !record.isTest &&
// !record.isGM`. A user report is stored as JSON, so it cannot hold one. So a
// filter is a rule list, and the built-in reports use the SAME vocabulary a user
// gets: a built-in a user cannot express is a built-in the user cannot clone.
//
// Nothing here knows about any entity. The field list is an argument, and each
// entity supplies its own (castableRules.js, itemRules.js) through the registry
// in reportEntities.js. The operators and the compile logic are shared by all of
// them, which is what made adding items a field catalogue rather than a builder.
//
// Electron-free, like the rest of src/shared: the renderer compiles the same
// rules for its live row-count preview that main compiles for the export.

const lower = (v) => String(v ?? '').toLowerCase()

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
    // The only operator that takes two values. Declared, so `compileRule` can
    // refuse a one-value `between` rather than let it match nothing: its own test
    // returns false for a non-array, and a rule that matches nothing produces an
    // empty report that reads as a valid answer.
    values: 2,
    test: (n, value) =>
      Number.isFinite(n) && Array.isArray(value) && n >= Number(value[0]) && n <= Number(value[1])
  }
}

/** Looks a field up in an entity's vocabulary, or null. */
export function findField(fields, name) {
  return (fields ?? []).find((f) => f.field === name) ?? null
}

/**
 * Turns one rule into a predicate, against one entity's field list.
 *
 * Throws on an unknown field, an unknown operator, or an operator the field does
 * not allow. Throwing rather than skipping is deliberate: a rule that silently
 * does nothing produces a report with too many rows and no error, which is the
 * failure this whole file is written to avoid.
 *
 * An unknown field also covers **a field belonging to another entity**, which is
 * WP3's per-entity rule: a castable rule on an items report is refused here
 * rather than quietly matching nothing.
 */
export function compileRule(fields, rule) {
  const spec = findField(fields, rule?.field)
  if (!spec) throw new Error(`Unknown report field: ${rule?.field}`)

  const operator = OPERATORS[rule?.op]
  if (!operator) throw new Error(`Unknown report operator: ${rule?.op}`)
  if (!spec.ops.includes(rule.op)) {
    throw new Error(`Field "${spec.field}" does not support the operator "${rule.op}"`)
  }
  if (operator.values === 2 && (!Array.isArray(rule.value) || rule.value.length !== 2)) {
    throw new Error(`The ${operator.label} operator needs two values`)
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
export function compileRules(fields, spec) {
  const rules = Array.isArray(spec?.rules) ? spec.rules : []
  if (rules.length === 0) return () => true

  const tests = rules.map((rule) => compileRule(fields, rule))
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
export function validateRules(fields, spec) {
  const problems = []
  if (spec?.match !== undefined && spec.match !== 'all' && spec.match !== 'any') {
    problems.push(`"match" must be "all" or "any", not ${JSON.stringify(spec.match)}`)
  }
  const rules = Array.isArray(spec?.rules) ? spec.rules : []
  rules.forEach((rule, i) => {
    try {
      compileRule(fields, rule)
    } catch (err) {
      problems.push(`rule ${i + 1}: ${err.message}`)
    }
  })
  return problems
}
