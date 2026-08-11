import { z } from 'zod'
import { isCastableField } from '../../shared/castableRecord.js'
import { getFilterableField, OPERATORS } from '../../shared/reportRules.js'

// reports.json, in world/.creidhne/ beside constants.json and formulas.json.
//
// This schema is the ONE gate, and both callers go through it: the file loader
// and the IPC handler that runs a definition. A hand-edited file and a renderer
// message must be treated identically, because both can name a field that does
// not exist and neither fails loudly on its own — `recordsToCsv` writes an empty
// cell for an unknown key, so a typo produces a blank column in a file someone
// reads as data.
//
// The field and operator names are checked against the vocabulary rather than
// restated here. A restated list drifts from the one the compiler uses, and the
// drift shows up as a rule that validates and then throws at export time.

const Column = z.string().refine(isCastableField, {
  message: 'names a field the castable record does not carry'
})

const Rule = z
  .object({
    field: z.string(),
    op: z.string(),
    // A scalar for most operators, a two-element array for `between`.
    value: z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.union([z.string(), z.number()]))
    ])
  })
  .superRefine((rule, ctx) => {
    const spec = getFilterableField(rule.field)
    if (!spec) {
      ctx.addIssue({ code: 'custom', path: ['field'], message: `unknown report field` })
      return
    }
    if (!OPERATORS[rule.op]) {
      ctx.addIssue({ code: 'custom', path: ['op'], message: `unknown report operator` })
      return
    }
    if (!spec.ops.includes(rule.op)) {
      ctx.addIssue({
        code: 'custom',
        path: ['op'],
        message: `field "${rule.field}" does not support the operator "${rule.op}"`
      })
    }
    if (rule.op === 'between' && (!Array.isArray(rule.value) || rule.value.length !== 2)) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'the between operator needs two values'
      })
    }
  })

/**
 * One report definition. `entity` is `castables` for every WP2 report; WP3 adds
 * values, and the field is written from the first save so a later report in the
 * same file is never ambiguous.
 *
 * A duplicate `label` is allowed on purpose. This is a file a person can edit by
 * hand, and it must not refuse to load over a repeated name.
 */
export const reportDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  entity: z.literal('castables').default('castables'),
  format: z.enum(['csv', 'json']),
  columns: z.array(Column).min(1),
  match: z.enum(['all', 'any']).default('all'),
  rules: z.array(Rule).default([]),
  headerOnEmpty: z.boolean().default(true)
})

export const reportsFileSchema = z.object({
  version: z.literal(1),
  reports: z.array(reportDefinitionSchema)
})
