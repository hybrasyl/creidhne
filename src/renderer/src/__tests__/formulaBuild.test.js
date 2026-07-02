import { describe, it, expect } from 'vitest'
import { buildFormulaString, generateHybridPair } from '../utils/formulaBuild'

// Uses the real 'old-hybrasyl' builtin pattern, whose ncalc ends with
// `* {Coefficient})`, so the injected coefficient appears as `* <n>)`.

const settings = {
  customVariables: { LevelUpper: 110, LevelDiv: 10 },
  coefficients: {
    DMG_ST: { spell: 2, skill: 1 },
    DMG_ST_HDIR: { spell: 1, skill: 1 },
    DMG_ST_HYOT: { spell: 1, skill: 1 },
    HEAL_ST_HDIR: { spell: 1, skill: 1 },
    HEAL_ST_HYOT: { spell: 1, skill: 1 }
  }
}

describe('buildFormulaString', () => {
  it('returns empty string when there is no pattern', () => {
    expect(buildFormulaString({ patternId: null }, settings)).toBe('')
    expect(buildFormulaString({ patternId: 'does-not-exist' }, settings)).toBe('')
  })

  it('injects the resolved coefficient into the assembled string', () => {
    const out = buildFormulaString(
      {
        patternId: 'old-hybrasyl',
        coeffEffect: 'DMG',
        coeffTargeting: 'ST',
        coeffDelivery: 'DIRECT',
        spellOrSkill: 'spell',
        paramValues: {}
      },
      settings
    )
    expect(out).toContain('* 2)') // DMG_ST spell coefficient
  })

  it('scales the coefficient by the hybrid split', () => {
    const out = buildFormulaString(
      {
        patternId: 'old-hybrasyl',
        coeffEffect: 'DMG',
        coeffTargeting: 'ST',
        coeffDelivery: 'HDIR',
        spellOrSkill: 'spell',
        hybridSplit: 50,
        paramValues: {}
      },
      settings
    )
    // DMG_ST_HDIR spell (1) × 50% = 0.5
    expect(out).toContain('* 0.5)')
  })
})

describe('generateHybridPair', () => {
  const ids = { pairId: 'pair-1', directId: 'dir-1', overtimeId: 'ot-1' }

  it('creates a complementary direct + over-time pair sharing a pairId', () => {
    const [direct, overtime] = generateHybridPair(
      { baseName: 'fireball', effect: 'DMG', directPct: 60, ...ids },
      settings
    )

    expect(direct.name).toBe('fireball_direct')
    expect(direct.refType).toBe('castable')
    expect(direct.coeffDelivery).toBe('HDIR')
    expect(direct.hybridRole).toBe('direct')
    expect(direct.hybridSplit).toBe(60)

    expect(overtime.name).toBe('fireball_dot')
    expect(overtime.refType).toBe('status')
    expect(overtime.coeffDelivery).toBe('HYOT')
    expect(overtime.hybridRole).toBe('overtime')
    expect(overtime.hybridSplit).toBe(40)

    expect(direct.pairId).toBe('pair-1')
    expect(overtime.pairId).toBe('pair-1')
    expect(direct.category).toBe('damage')
  })

  it('uses the _hot suffix and heal category for heal effect', () => {
    const [, overtime] = generateHybridPair(
      { baseName: 'renew', effect: 'HEAL', directPct: 50, ...ids },
      settings
    )
    expect(overtime.name).toBe('renew_hot')
    expect(overtime.category).toBe('heal')
  })

  it('bakes the split-scaled coefficient into each half', () => {
    const [direct, overtime] = generateHybridPair(
      { baseName: 'fireball', effect: 'DMG', patternId: 'old-hybrasyl', directPct: 60, ...ids },
      settings
    )
    // HDIR spell (1) × 60% = 0.6 ; HYOT spell (1) × 40% = 0.4
    expect(direct.formula).toContain('* 0.6)')
    expect(overtime.formula).toContain('* 0.4)')
  })

  it('uses the "damage" category and _dot suffix for a non-heal/conv effect', () => {
    const [direct, overtime] = generateHybridPair(
      { baseName: 'ward', effect: 'SHIELD', directPct: 50, ...ids },
      settings
    )
    expect(direct.category).toBe('damage')
    expect(overtime.name).toBe('ward_dot')
  })
})

// ── buildFormulaString: injection branches ───────────────────────────────────

describe('buildFormulaString — injection branches', () => {
  const base = {
    patternId: 'old-hybrasyl',
    coeffEffect: 'DMG',
    coeffTargeting: 'ST',
    coeffDelivery: 'DIRECT',
    spellOrSkill: 'spell'
  }

  it('resolves the Assail key for ASSAIL targeting', () => {
    const out = buildFormulaString(
      { ...base, coeffTargeting: 'ASSAIL', spellOrSkill: 'skill' },
      { coefficients: { DMG_ASSAIL: { skill: 7 } } }
    )
    expect(out).toContain('* 7)')
  })

  it('applies a per-formula setting override over the global value', () => {
    const out = buildFormulaString({ ...base, paramValues: { _override_LevelDiv: 99 } }, settings)
    expect(out).toContain('/ 99)')
  })

  it('applies a per-formula coefficient override over the resolved value', () => {
    const out = buildFormulaString({ ...base, paramValues: { _override_Coefficient: 5 } }, settings)
    expect(out).toContain('* 5)')
  })

  it('falls back to 0 for missing settings + coefficient', () => {
    const out = buildFormulaString(base, {})
    expect(out).toContain('/ 0)') // LevelDiv unset
    expect(out).toContain('* 0)') // coefficient unresolved
  })
})
