// ── Coefficient key + resolver helpers ───────────────────────────────────────
// Pure functions extracted from FormulaEditor so they can be unit-tested and
// reused. A coefficient "key" (e.g. DMG_ST, HEAL_ST_HOT, DMG_ST_HYOT) indexes
// the numeric coefficients the user enters in the Globals dialog
// (settings.coefficients, keyed by the catalog keys in formulaConstants.js).

export const ASSAIL_KEY = 'DMG_ASSAIL'

// Hybrid deliveries: a paired direct hit (HDIR) + over-time portion (HYOT),
// each carrying a split percentage of the total budget.
export const HYBRID_DELIVERIES = new Set(['HDIR', 'HYOT'])

// Build the catalog key for an effect/targeting/delivery combination.
// - Assail is a special skill-only single key.
// - DIRECT drops the suffix (e.g. DMG_ST).
// - Pure over-time heal uses the catalog's 'HOT' suffix; DMG/CONV use 'DOT'.
//   Hybrid deliveries ('HDIR'/'HYOT') are uniform across effects.
export function buildCoefficientKey(effect, targeting, delivery) {
  if (effect === 'DMG' && targeting === 'ASSAIL') return ASSAIL_KEY
  const parts = [effect, targeting]
  if (delivery && delivery !== 'DIRECT') {
    const suffix = delivery === 'DOT' && effect === 'HEAL' ? 'HOT' : delivery
    parts.push(suffix)
  }
  return parts.join('_')
}

// Scale a resolved coefficient by a hybrid split percentage. Only applies to
// hybrid deliveries; otherwise (and when the coefficient or split is unset) the
// coefficient is returned unchanged. `hybridSplit` is this portion's percentage
// of the pair (e.g. 60 for the direct half of a 60/40 hybrid).
export function applyHybridSplit(coeff, delivery, hybridSplit) {
  if (coeff == null || !HYBRID_DELIVERIES.has(delivery)) return coeff
  if (hybridSplit == null || hybridSplit === '') return coeff
  const pct = Number(hybridSplit)
  if (!Number.isFinite(pct)) return coeff
  return Math.round(coeff * (pct / 100) * 10000) / 10000
}

// Resolve a coefficient key to a numeric value for the spell or skill column,
// applying the configured budget modifier against the referenced castable.
// Returns null when the key/column is unset.
export function resolveCoefficient(
  coefficients,
  coeffKey,
  spellOrSkill,
  budgetModifier,
  castableRef
) {
  const entry = coefficients?.[coeffKey]
  if (!entry) return null

  const base = spellOrSkill === 'skill' ? entry.skill : entry.spell
  if (base == null) return null

  // Apply budget modifier if configured
  if (!budgetModifier || budgetModifier.mode === 'none' || !castableRef) return base

  const bm = budgetModifier
  if (bm.mode === 'linearStep') {
    // Determine which dimension to use (lines or cooldown)
    const dim = castableRef.budgetDimension === 'line' ? bm.lines : bm.cooldown
    const actual = castableRef.budgetDimension === 'line' ? castableRef.lines : castableRef.cooldown
    if (dim?.baseline == null || actual == null) return base

    let delta = (actual - dim.baseline) * (dim.step || 0)
    if (dim.cap != null) delta = Math.min(delta, dim.cap)

    if (bm.application === 'multiplicative') {
      return Math.round(base * (1 + delta) * 10000) / 10000
    }
    return Math.round((base + delta) * 10000) / 10000
  }

  if (bm.mode === 'binary') {
    const dim = castableRef.budgetDimension === 'line' ? bm.lines : bm.cooldown
    const actual = castableRef.budgetDimension === 'line' ? castableRef.lines : castableRef.cooldown
    if (dim?.baseline == null || actual == null) return base

    const mod = actual >= dim.baseline ? dim.bonus || 0 : -(dim.penalty || 0)
    return Math.round((base + mod) * 10000) / 10000
  }

  return base
}
