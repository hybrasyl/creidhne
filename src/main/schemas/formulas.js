import { z } from 'zod'

// formulas.json shape from formulasJson.js. The outer container is
// strict (settings + patterns + formulas, in those positions); inner
// fields are permissive enough to evolve without churning this schema.

const Formula = z.object({
  id: z.string(),
  name: z.string(),
  formula: z.string()
  // description / category and any other fields pass through.
})

const BudgetSection = z.object({
  baseline: z.number(),
  step: z.number(),
  cap: z.number().nullable()
})

const BudgetModifier = z.object({
  mode: z.string(),
  application: z.string(),
  lines: BudgetSection,
  cooldown: BudgetSection
})

const Settings = z.object({
  budgetModifier: BudgetModifier.optional(),
  customVariables: z.record(z.string(), z.number()).optional(),
  coefficients: z.record(z.string(), z.unknown()).optional(),
  defaultPatternId: z.string().nullable().optional()
})

export const formulasSchema = z.object({
  settings: Settings,
  patterns: z.array(z.unknown()),
  formulas: z.array(Formula)
})
