import { describe, expect, it } from 'vitest'
import luaparse from 'luaparse'
import {
  TranspileError,
  generateFormulasLua,
  randomLocals,
  transpileFormula
} from '../formulaTranspiler.js'

// NCalc → Lua for scripts/formulas.lua (HTOO-578). The rules follow NCalcSync
// 6.3.1 as the server runs it, measured, not read from its docs.

/** Parse as Lua 5.2, the dialect of MoonSharp 2.0.0, or throw. */
const parseLua = (src) => luaparse.parse(src, { luaVersion: '5.2' })

describe('transpileFormula', () => {
  it('maps ** to the Lua power operator', () => {
    expect(transpileFormula('2 ** 3')).toBe('2 ^ 3')
    expect(transpileFormula('SOURCESTR ** 2')).toBe('source.Stats.Str ^ 2')
  })

  it('refuses ^, which is bitwise XOR in NCalc, not a power', () => {
    expect(() => transpileFormula('SOURCESTR ^ 2')).toThrow(TranspileError)
  })

  it('maps Round(x, digits) to the away-from-zero helper, keeping the digits', () => {
    expect(transpileFormula('Round(SOURCESTR / 3, 2)')).toBe('ncalc_round(source.Stats.Str / 3, 2)')
  })

  it('maps the other NCalc functions in any case', () => {
    expect(transpileFormula('MAX(1, 2) + Min(1, 2) + abs(-1)')).toBe(
      'math.max(1, 2) + math.min(1, 2) + math.abs(-1)'
    )
    expect(transpileFormula('Ceiling(1.5) + Floor(1.5) + Sqrt(4) + Pow(2, 3)')).toBe(
      'math.ceil(1.5) + math.floor(1.5) + math.sqrt(4) + math.pow(2, 3)'
    )
    expect(transpileFormula('Truncate(-1.5) + Sign(-3)')).toBe(
      'ncalc_truncate(-1.5) + ncalc_sign(-3)'
    )
  })

  it('maps if() to a helper, because if is a Lua keyword', () => {
    expect(transpileFormula('if(SOURCELEVEL != 1, 2, 3)')).toBe(
      'ncalc_if(source.Stats.Level ~= 1, 2, 3)'
    )
    expect(transpileFormula('IF(1 <> 2, 2, 3)')).toBe('ncalc_if(1 ~= 2, 2, 3)')
  })

  it('reads ORIGINALCASTER tokens off a StatInfo, not through .Stats', () => {
    expect(transpileFormula('ORIGINALCASTERSTR + ORIGINALCASTERMAXIMUMHP')).toBe(
      'originalCaster.Str + originalCaster.MaximumHp'
    )
  })

  it('keeps random tokens as names, for the function to draw once', () => {
    expect(transpileFormula('RAND_10 - RAND_10 + RANDDOUBLE')).toBe(
      'RAND_10 - RAND_10 + RANDDOUBLE'
    )
  })
})

describe('randomLocals', () => {
  it('draws each random token once, in first-use order, with the server range', () => {
    expect(randomLocals('RAND_100 + RAND_10 - RAND_100 * RANDDOUBLE')).toEqual([
      { name: 'RAND_100', draw: 'math.random(0, 100)' },
      { name: 'RAND_10', draw: 'math.random(0, 10)' },
      { name: 'RANDDOUBLE', draw: 'math.random()' }
    ])
  })

  it('is empty for a formula without one', () => {
    expect(randomLocals('SOURCESTR * 2')).toEqual([])
  })
})

describe('generateFormulasLua', () => {
  const formulas = [
    { name: 'Power', formula: 'SOURCESTR ** 2 + RAND_10 - RAND_10' },
    { name: 'Rounded', category: 'heal', formula: 'Round(SOURCEWIS / 3, 2)' },
    { name: 'Inherited', formula: 'ORIGINALCASTERINT * 2' },
    { name: 'Branch', formula: 'if(SOURCELEVEL >= 50, Max(SOURCESTR, 1), 0)' },
    { name: 'Xor "quoted"', formula: 'SOURCESTR ^ 2' }
  ]
  const lua = generateFormulasLua(formulas)

  it('is valid Lua 5.2', () => {
    expect(() => parseLua(lua)).not.toThrow()
  })

  it('defines the helpers once', () => {
    for (const helper of ['ncalc_round', 'ncalc_truncate', 'ncalc_sign', 'ncalc_if']) {
      expect(lua.match(new RegExp(`local function ${helper}\\(`, 'g'))).toHaveLength(1)
    }
  })

  it('passes originalCaster last', () => {
    expect(lua).toContain(
      'function formulas.inherited(source, target, castable, map, item, damage, originalCaster)'
    )
  })

  it('draws a random token once per call', () => {
    expect(lua).toContain(
      [
        'function formulas.power(source, target, castable, map, item, damage, originalCaster)',
        '    local RAND_10 = math.random(0, 10)',
        '    return source.Stats.Str ^ 2 + RAND_10 - RAND_10',
        'end'
      ].join('\n')
    )
  })

  it('turns a formula it cannot transpile into a function that names the reason', () => {
    expect(lua).toMatch(/function formulas\.xor_quoted\(.*\)\n {4}error\(".*XOR.*"\)\nend/)
  })
})
