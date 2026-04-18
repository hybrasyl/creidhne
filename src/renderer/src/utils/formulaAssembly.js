import { statBlockToExpression } from '../components/formulas/StatBlockBuilder'

/**
 * Assemble a formula NCalc string from a pattern template and parameter values.
 *
 * @param {string} ncalcTemplate — pattern's ncalc string with {Placeholder} tokens
 * @param {Object} paramValues   — keyed by parameter key, values depend on type:
 *   - number:        numeric value
 *   - rand:          { variable: 'RAND_10', multiplier: 4 }
 *   - stat_block:    [{ stat: 'SOURCESTR', weight: 3 }, ...]
 *   - setting:       numeric value (resolved from settings)
 *   - coefficient:   numeric value (resolved from coefficient table + budget)
 *   - castable_cost: numeric value (resolved from castable index)
 * @param {Array} paramDefs — the pattern's parameters array (for type info)
 * @returns {string} assembled NCalc expression
 */
export function assembleFormula(ncalcTemplate, paramValues, paramDefs) {
  if (!ncalcTemplate) return ''

  let result = ncalcTemplate

  // ── Pre-pass: strip optional terms that are disabled/empty ────────────────
  // Remove "+ {Rand}" when no random variable is selected
  const randDef = paramDefs.find((d) => d.type === 'rand')
  if (randDef) {
    const randVal = paramValues[randDef.key]
    if (!randVal?.variable) {
      // Remove " + {Rand}" or "{Rand} + " from template
      result = result.replace(new RegExp(`\\s*\\+\\s*\\{${randDef.key}\\}`, 'g'), '')
      result = result.replace(new RegExp(`\\{${randDef.key}\\}\\s*\\+\\s*`, 'g'), '')
    }
  }

  // Remove weapon damage term when weapon is disabled
  const weaponDef = paramDefs.find((d) => d.key === 'WeaponCoeff')
  if (weaponDef && !paramValues._weaponEnabled) {
    // Remove "+ SOURCEWEAPONSMALLDAMAGE * {WeaponCoeff}" (don't touch surrounding parens)
    result = result.replace(/\s*\+\s*SOURCEWEAPON\w+\s*\*\s*\{WeaponCoeff\}/g, '')
    result = result.replace(/SOURCEWEAPON\w+\s*\*\s*\{WeaponCoeff\}\s*\+\s*/g, '')
  }

  // ── Main substitution pass ────────────────────────────────────────────────
  for (const def of paramDefs) {
    const value = paramValues[def.key]
    const placeholder = `{${def.key}}`

    // Skip if placeholder was already removed in pre-pass
    if (!result.includes(placeholder)) continue

    let replacement = ''

    switch (def.type) {
      case 'number':
      case 'setting':
      case 'coefficient':
      case 'castable_cost':
        replacement = value != null && value !== '' ? String(value) : '0'
        break

      case 'rand':
        if (value?.variable) {
          replacement =
            value.multiplier && value.multiplier !== 1
              ? `${value.variable} * ${value.multiplier}`
              : value.variable
        } else {
          replacement = '0'
        }
        break

      case 'stat_block':
        replacement = statBlockToExpression(value)
        break

      default:
        replacement = value != null ? String(value) : '0'
    }

    while (result.includes(placeholder)) {
      result = result.replace(placeholder, replacement)
    }
  }

  // ── Cleanup: normalize whitespace ─────────────────────────────────────────
  result = result.replace(/\s{2,}/g, ' ').trim()

  return result
}
