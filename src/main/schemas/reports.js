import { z } from 'zod'
import { REPORT_ENTITY_NAMES, validateDefinition } from '../../shared/reportEntities.js'

// reports.json, in world/.creidhne/ beside constants.json and formulas.json.
//
// This schema is the ONE gate, and both callers go through it: the file loader and
// the IPC handlers that run or preview a definition. A hand-edited file and a
// renderer message must be treated identically, because both can name a field that
// does not exist and neither fails loudly on its own — `recordsToCsv` writes an
// empty cell for an unknown key, so a typo produces a blank column in a file
// somebody reads as data.
//
// **Validation is per entity (WP3), which is why the columns and rules are checked
// in a whole-object refinement rather than per field.** Nothing can be checked
// until `entity` is in hand: `damageFormula` is a real field for castables and not
// a field at all for items, and a union catalogue would accept it on an items
// report and then write the blank column. Zod checks fields in isolation, so the
// per-field refinement WP2 used cannot express this.
//
// The field names, the operator names and the entity list all come from
// `reportEntities.js` rather than being restated here. A restated list drifts, and
// the drift shows up as a rule that validates and then throws when the report runs.

const Rule = z.object({
  field: z.string(),
  op: z.string(),
  // A scalar for most operators, a two-element array for `between`.
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))])
})

/**
 * One report definition.
 *
 * A duplicate `label` is allowed on purpose. This is a file a person can edit by
 * hand, and it must not refuse to load over a repeated name.
 */
export const reportDefinitionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    entity: z.enum(REPORT_ENTITY_NAMES).default('castables'),
    format: z.enum(['csv', 'json']),
    columns: z.array(z.string()).min(1),
    match: z.enum(['all', 'any']).default('all'),
    rules: z.array(Rule).default([]),
    headerOnEmpty: z.boolean().default(true)
  })
  .superRefine((definition, ctx) => {
    // One shared checker, so the schema and the runtime cannot disagree about what
    // a valid definition is. It reports every fault at once, which is what a
    // hand-edited file needs.
    for (const problem of validateDefinition(definition)) {
      ctx.addIssue({ code: 'custom', message: problem })
    }
  })

export const reportsFileSchema = z.object({
  version: z.literal(1),
  reports: z.array(reportDefinitionSchema)
})
