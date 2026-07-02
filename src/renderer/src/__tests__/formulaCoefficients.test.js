import { describe, it, expect } from 'vitest'
import { ASSAIL_KEY, buildCoefficientKey, resolveCoefficient } from '../utils/formulaCoefficients'
import { ALL_COEFFICIENT_KEYS } from '../data/formulaConstants'

// ── buildCoefficientKey ──────────────────────────────────────────────────────

describe('buildCoefficientKey', () => {
  it('drops the suffix for DIRECT delivery', () => {
    expect(buildCoefficientKey('DMG', 'ST', 'DIRECT')).toBe('DMG_ST')
    expect(buildCoefficientKey('HEAL', 'AOE', 'DIRECT')).toBe('HEAL_AOE')
  })

  it('appends DOT for damage/conversion over-time', () => {
    expect(buildCoefficientKey('DMG', 'ST', 'DOT')).toBe('DMG_ST_DOT')
    expect(buildCoefficientKey('CONV', 'AOE', 'DOT')).toBe('CONV_AOE_DOT')
  })

  it('maps HEAL pure over-time to HOT (the bug fix)', () => {
    expect(buildCoefficientKey('HEAL', 'ST', 'DOT')).toBe('HEAL_ST_HOT')
    expect(buildCoefficientKey('HEAL', 'AOE', 'DOT')).toBe('HEAL_AOE_HOT')
  })

  it('keeps hybrid suffixes uniform across effects', () => {
    expect(buildCoefficientKey('DMG', 'ST', 'HDIR')).toBe('DMG_ST_HDIR')
    expect(buildCoefficientKey('DMG', 'ST', 'HDOT')).toBe('DMG_ST_HDOT')
    // heal hybrid over-time is HDOT, NOT HHOT
    expect(buildCoefficientKey('HEAL', 'ST', 'HDIR')).toBe('HEAL_ST_HDIR')
    expect(buildCoefficientKey('HEAL', 'ST', 'HDOT')).toBe('HEAL_ST_HDOT')
  })

  it('returns the Assail key for damage skills regardless of delivery', () => {
    expect(buildCoefficientKey('DMG', 'ASSAIL', 'DIRECT')).toBe(ASSAIL_KEY)
    expect(buildCoefficientKey('DMG', 'ASSAIL', 'DOT')).toBe(ASSAIL_KEY)
  })

  it('only produces keys that exist in the coefficient catalog', () => {
    const effects = ['DMG', 'HEAL', 'CONV', 'SHIELD']
    const targetings = ['ST', 'AOE']
    // Deliveries that the catalog actually defines per effect vary, so we assert
    // every key the editor can build for the shared set is a real catalog key.
    for (const effect of effects) {
      for (const targeting of targetings) {
        for (const delivery of ['DIRECT', 'DOT', 'HDIR', 'HDOT']) {
          const key = buildCoefficientKey(effect, targeting, delivery)
          // SHIELD has no over-time/hybrid variants in the catalog — skip those.
          if (effect === 'SHIELD' && delivery !== 'DIRECT') continue
          expect(ALL_COEFFICIENT_KEYS).toContain(key)
        }
      }
    }
    expect(ALL_COEFFICIENT_KEYS).toContain(ASSAIL_KEY)
  })
})

// ── resolveCoefficient ───────────────────────────────────────────────────────

describe('resolveCoefficient', () => {
  const coeffs = {
    DMG_ST: { spell: 1.0, skill: 0.8 },
    HEAL_ST_HOT: { spell: 0.9, skill: null }
  }

  it('returns null for an unknown key', () => {
    expect(resolveCoefficient(coeffs, 'NOPE', 'spell')).toBeNull()
  })

  it('reads the spell vs skill column', () => {
    expect(resolveCoefficient(coeffs, 'DMG_ST', 'spell')).toBe(1.0)
    expect(resolveCoefficient(coeffs, 'DMG_ST', 'skill')).toBe(0.8)
  })

  it('returns null when the requested column is unset', () => {
    expect(resolveCoefficient(coeffs, 'HEAL_ST_HOT', 'skill')).toBeNull()
  })

  it('returns the base value when no budget modifier applies', () => {
    expect(resolveCoefficient(coeffs, 'DMG_ST', 'spell', { mode: 'none' })).toBe(1.0)
    expect(resolveCoefficient(coeffs, 'DMG_ST', 'spell', null, null)).toBe(1.0)
  })

  it('applies an additive linearStep budget modifier', () => {
    const bm = {
      mode: 'linearStep',
      application: 'additive',
      cooldown: { baseline: 6, step: 0.01, cap: null }
    }
    const ref = { budgetDimension: 'cd', cooldown: 10 }
    // base 1.0 + (10 - 6) * 0.01 = 1.04
    expect(resolveCoefficient(coeffs, 'DMG_ST', 'spell', bm, ref)).toBe(1.04)
  })

  it('respects the cap on a linearStep modifier', () => {
    const bm = {
      mode: 'linearStep',
      application: 'additive',
      cooldown: { baseline: 6, step: 0.01, cap: 0.02 }
    }
    const ref = { budgetDimension: 'cd', cooldown: 100 }
    // delta would be 0.94, capped to 0.02 → 1.02
    expect(resolveCoefficient(coeffs, 'DMG_ST', 'spell', bm, ref)).toBe(1.02)
  })
})
