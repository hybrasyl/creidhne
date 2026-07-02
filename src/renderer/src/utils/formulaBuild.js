import { assembleFormula } from './formulaAssembly'
import {
  ASSAIL_KEY,
  buildCoefficientKey,
  resolveCoefficient,
  applyHybridSplit
} from './formulaCoefficients'
import BUILTIN_PATTERNS from '../data/formulaPatterns'

// Assemble the symbolic NCalc string for a formula *record* (the same string
// the FormulaEditor produces and saves). Shared by the editor's live preview,
// the hybrid generator, and hybrid-pair re-assembly so they can never diverge.
//
// `formula` fields used: patternId, paramValues, coeffEffect, coeffTargeting,
// coeffDelivery, spellOrSkill, hybridSplit, budgetDimension, castableLines,
// castableCooldown. Returns '' when the pattern is missing.
export function buildFormulaString(formula, settings, patterns = BUILTIN_PATTERNS) {
  const pattern = patterns.find((p) => p.id === formula.patternId) || null
  if (!pattern) return ''

  const paramValues = formula.paramValues || {}
  const coeffKey =
    formula.coeffTargeting === 'ASSAIL'
      ? ASSAIL_KEY
      : buildCoefficientKey(
          formula.coeffEffect || 'DMG',
          formula.coeffTargeting || 'ST',
          formula.coeffDelivery || 'DIRECT'
        )

  const castableRef = {
    budgetDimension: formula.budgetDimension === 'line' ? 'line' : 'cd',
    lines: formula.castableLines ?? null,
    cooldown: formula.castableCooldown ?? null
  }
  const resolved0 = resolveCoefficient(
    settings?.coefficients,
    coeffKey,
    formula.spellOrSkill || 'spell',
    settings?.budgetModifier,
    castableRef
  )
  const splitCoefficient = applyHybridSplit(resolved0, formula.coeffDelivery, formula.hybridSplit)

  // Inject settings + coefficient; per-formula overrides win over globals.
  const resolved = { ...paramValues }
  for (const p of pattern.parameters) {
    if (p.type === 'setting' && p.settingKey) {
      const overrideKey = `_override_${p.key}`
      resolved[p.key] =
        paramValues[overrideKey] != null
          ? paramValues[overrideKey]
          : (settings?.customVariables?.[p.settingKey] ?? 0)
    }
    if (p.type === 'coefficient') {
      const overrideKey = '_override_Coefficient'
      resolved[p.key] =
        paramValues[overrideKey] != null ? paramValues[overrideKey] : (splitCoefficient ?? 0)
    }
  }
  return assembleFormula(pattern.ncalc, resolved, pattern.parameters)
}

const EFFECT_CATEGORY = { DMG: 'damage', HEAL: 'heal', CONV: 'conversion' }

// Generate a complementary hybrid pair — a direct half (used by a castable,
// HDIR) and an over-time half (used by a status, HYOT) — sharing a pairId and
// split by `directPct`. Each half's coefficient is scaled by its portion via
// buildFormulaString. Caller supplies ids so the result is deterministic.
export function generateHybridPair(opts, settings, patterns = BUILTIN_PATTERNS) {
  const {
    baseName,
    effect = 'DMG',
    targeting = 'ST',
    spellOrSkill = 'spell',
    patternId = null,
    directPct = 50,
    pairId,
    directId,
    overtimeId
  } = opts

  const category = EFFECT_CATEGORY[effect] || 'damage'
  const overtimeSuffix = effect === 'HEAL' ? '_hot' : '_dot'
  const shared = {
    description: '',
    category,
    patternId,
    coeffEffect: effect,
    coeffTargeting: targeting,
    spellOrSkill,
    paramValues: {},
    isArchived: false,
    pairId
  }

  const directRecord = {
    ...shared,
    id: directId,
    name: `${baseName}_direct`,
    refType: 'castable',
    coeffDelivery: 'HDIR',
    hybridRole: 'direct',
    hybridSplit: directPct
  }
  const overtimeRecord = {
    ...shared,
    id: overtimeId,
    name: `${baseName}${overtimeSuffix}`,
    refType: 'status',
    coeffDelivery: 'HYOT',
    hybridRole: 'overtime',
    hybridSplit: 100 - directPct
  }
  directRecord.formula = buildFormulaString(directRecord, settings, patterns)
  overtimeRecord.formula = buildFormulaString(overtimeRecord, settings, patterns)
  return [directRecord, overtimeRecord]
}
