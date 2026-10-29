import { describe, it, expect } from 'vitest'
import {
  tokenize,
  compile,
  evaluate,
  variablesUsed,
  UnknownVariableError,
  UnknownFunctionError,
  ServerZeroError,
  roundAwayFromZero
} from '../formulaEval.js'

// ── Tokenizer ────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('numbers, operators, identifiers', () => {
    expect(tokenize('1 + 2.5 * SOURCESTR')).toEqual([
      { type: 'num', value: 1 },
      { type: 'op', value: '+' },
      { type: 'num', value: 2.5 },
      { type: 'op', value: '*' },
      { type: 'ident', value: 'SOURCESTR' }
    ])
  })

  it('multi-char ops and parens/commas', () => {
    expect(tokenize('if(A >= B, 1, 2)')).toEqual([
      { type: 'ident', value: 'if' },
      { type: 'op', value: '(' },
      { type: 'ident', value: 'A' },
      { type: 'op', value: '>=' },
      { type: 'ident', value: 'B' },
      { type: 'op', value: ',' },
      { type: 'num', value: 1 },
      { type: 'op', value: ',' },
      { type: 'num', value: 2 },
      { type: 'op', value: ')' }
    ])
  })

  it('underscored + digit identifiers', () => {
    const toks = tokenize('RAND_100 + SOURCELEVEL')
    expect(toks[0]).toEqual({ type: 'ident', value: 'RAND_100' })
    expect(toks[2]).toEqual({ type: 'ident', value: 'SOURCELEVEL' })
  })

  it('decimal-only numbers', () => {
    expect(tokenize('.5')).toEqual([{ type: 'num', value: 0.5 }])
  })
})

// ── Arithmetic + precedence ──────────────────────────────────────────────────

describe('evaluate — arithmetic', () => {
  it('basic ops', () => {
    expect(evaluate('1 + 2')).toBe(3)
    expect(evaluate('10 - 3')).toBe(7)
    expect(evaluate('4 * 5')).toBe(20)
    expect(evaluate('20 / 4')).toBe(5)
    expect(evaluate('10 % 3')).toBe(1)
  })

  it('mul binds tighter than add', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14)
    expect(evaluate('(2 + 3) * 4')).toBe(20)
  })

  it('power is **, right-associative and tighter than unary minus', () => {
    expect(evaluate('2 ** 3')).toBe(8)
    expect(evaluate('2 ** 3 ** 2')).toBe(512) // 2**(3**2) = 2**9
    expect(evaluate('2 * 3 ** 2')).toBe(18) // 2 * (3**2)
    expect(evaluate('-2 ** 2')).toBe(-4) // -(2**2), as NCalc
    expect(evaluate('(-2) ** 2')).toBe(4)
    expect(evaluate('2 ** -1')).toBe(0.5)
  })

  it('rejects ^, which is bitwise XOR on the server', () => {
    expect(() => evaluate('2 ^ 3')).toThrow(/XOR.*\*\*/)
    expect(() => compile('SOURCESTR ^ 2')).toThrow(/XOR/)
  })

  it('unary minus', () => {
    expect(evaluate('-5')).toBe(-5)
    expect(evaluate('-5 + 3')).toBe(-2)
    expect(evaluate('-(2 + 3)')).toBe(-5)
    expect(evaluate('- -5')).toBe(5)
  })
})

// ── Variables ────────────────────────────────────────────────────────────────

describe('evaluate — results the server turns into 0', () => {
  it('a division by zero', () => {
    expect(() => evaluate('7 / 0')).toThrow(ServerZeroError)
    expect(() => evaluate('7 % 0')).toThrow(ServerZeroError)
    expect(() => evaluate('SOURCESTR / TARGETAC', { SOURCESTR: 3, TARGETAC: 0 })).toThrow(
      'Division by zero: the server evaluates this formula to 0'
    )
  })

  it('a result that is not a finite number', () => {
    expect(() => evaluate('Sqrt(-1)')).toThrow(ServerZeroError)
    expect(() => evaluate('10 ** 400')).toThrow('Not a finite number')
  })
})

describe('evaluate — variables', () => {
  it('substitutes from the vars map', () => {
    expect(evaluate('SOURCESTR * 3', { SOURCESTR: 10 })).toBe(30)
  })

  it('throws UnknownVariableError with the name', () => {
    try {
      evaluate('SOURCEWIS', {})
      throw new Error('expected UnknownVariableError')
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownVariableError)
      expect(e.variable).toBe('SOURCEWIS')
    }
  })

  it('uses many variables in a Hybrasyl-ish formula', () => {
    const vars = { SOURCESTR: 15, SOURCELEVEL: 50, RAND_10: 5 }
    expect(evaluate('SOURCESTR + SOURCELEVEL + RAND_10', vars)).toBe(70)
    expect(evaluate('(SOURCESTR * 2) + Floor(SOURCELEVEL / 10)', vars)).toBe(35)
  })
})

// ── Functions ────────────────────────────────────────────────────────────────

describe('evaluate — functions', () => {
  it('Max / Min take exactly two arguments, as on the server', () => {
    expect(evaluate('Min(3, 1)')).toBe(1)
    expect(evaluate('Max(3, 1)')).toBe(3)
    expect(() => compile('Max(3, 1, 2)')).toThrow('Max() takes exactly 2 arguments')
    expect(() => compile('Min(2)')).toThrow('Min() takes exactly 2 arguments')
  })

  it('Floor / Ceiling / Abs / Sqrt / Pow / Sign / Truncate', () => {
    expect(evaluate('Floor(3.8)')).toBe(3)
    expect(evaluate('Ceiling(3.2)')).toBe(4)
    expect(evaluate('Abs(-7)')).toBe(7)
    expect(evaluate('Sqrt(16)')).toBe(4)
    expect(evaluate('Pow(2, 3)')).toBe(8)
    expect(evaluate('Sign(-3)')).toBe(-1)
    expect(evaluate('Truncate(-2.7)')).toBe(-2)
  })

  it('Ceil is not an NCalc function', () => {
    expect(() => compile('Ceil(3.2)')).toThrow(UnknownFunctionError)
  })

  it('Round needs its digits, and rounds half away from zero', () => {
    expect(() => compile('Round(3.5)')).toThrow(
      /Round\(\) takes exactly 2 arguments.*Round\(x, 0\)/
    )
    expect(evaluate('Round(2.5, 0)')).toBe(3)
    expect(evaluate('Round(-2.5, 0)')).toBe(-3)
    expect(evaluate('Round(7.0 / 3, 2)')).toBe(2.33)
  })

  it('function names match in any case, as with IgnoreCaseAtBuiltInFunctions', () => {
    expect(evaluate('FLOOR(3.9)')).toBe(3)
    expect(evaluate('MAX(10, 5)')).toBe(10)
    expect(evaluate('IF(1, 2, 3)')).toBe(2)
  })

  it('unknown function throws UnknownFunctionError', () => {
    try {
      evaluate('notreal(1, 2)')
      throw new Error('expected UnknownFunctionError')
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownFunctionError)
      expect(e.function).toBe('notreal')
    }
  })
})

// ── if() + relational ops ───────────────────────────────────────────────────

describe('evaluate — if / relational', () => {
  it('relational ops yield 1/0', () => {
    expect(evaluate('1 < 2')).toBe(1)
    expect(evaluate('1 > 2')).toBe(0)
    expect(evaluate('5 == 5')).toBe(1)
    expect(evaluate('5 != 5')).toBe(0)
    expect(evaluate('5 <= 5')).toBe(1)
    expect(evaluate('5 >= 6')).toBe(0)
  })

  it('if chooses branch by condition truthiness', () => {
    expect(evaluate('if(1, 10, 20)')).toBe(10)
    expect(evaluate('if(0, 10, 20)')).toBe(20)
    expect(
      evaluate('if(SOURCELEVEL >= 50, SOURCESTR * 3, SOURCESTR * 2)', {
        SOURCELEVEL: 60,
        SOURCESTR: 10
      })
    ).toBe(30)
    expect(
      evaluate('if(SOURCELEVEL >= 50, SOURCESTR * 3, SOURCESTR * 2)', {
        SOURCELEVEL: 40,
        SOURCESTR: 10
      })
    ).toBe(20)
  })

  it('if short-circuits unreferenced branches', () => {
    // UNSET would throw UnknownVariableError if evaluated; must not be
    expect(evaluate('if(1, 42, UNSET)', {})).toBe(42)
    expect(evaluate('if(0, UNSET, 42)', {})).toBe(42)
  })

  it('if requires exactly 3 args', () => {
    expect(() => evaluate('if(1, 2)')).toThrow()
    expect(() => evaluate('if(1, 2, 3, 4)')).toThrow()
  })
})

// ── Compile + reuse ─────────────────────────────────────────────────────────

describe('compile', () => {
  it('returns a reusable function', () => {
    const fn = compile('SOURCESTR * RAND_10')
    expect(fn({ SOURCESTR: 10, RAND_10: 5 })).toBe(50)
    expect(fn({ SOURCESTR: 20, RAND_10: 10 })).toBe(200)
  })
})

// ── variablesUsed ────────────────────────────────────────────────────────────

describe('variablesUsed', () => {
  it('extracts every referenced variable once', () => {
    const used = variablesUsed('SOURCESTR * 3 + SOURCELEVEL + RAND_10 + SOURCESTR')
    expect(used).toEqual(new Set(['SOURCESTR', 'SOURCELEVEL', 'RAND_10']))
  })

  it('walks through function args and if branches', () => {
    const used = variablesUsed('if(A > B, Min(C, D), Floor(E / F))')
    expect(used).toEqual(new Set(['A', 'B', 'C', 'D', 'E', 'F']))
  })

  it('returns empty set for constant-only expressions', () => {
    expect(variablesUsed('1 + 2 * 3').size).toBe(0)
  })

  it('compile() exposes .variables', () => {
    const fn = compile('X + Y')
    expect(fn.variables).toEqual(new Set(['X', 'Y']))
  })
})

// ── Realistic Hybrasyl formulas ──────────────────────────────────────────────

describe('realistic formulas', () => {
  const caster = {
    SOURCESTR: 30,
    SOURCEINT: 25,
    SOURCEWIS: 20,
    SOURCECON: 18,
    SOURCEDEX: 15,
    SOURCELEVEL: 75,
    SOURCEABILITY: 50,
    SOURCEHP: 1500,
    SOURCEMP: 800,
    SOURCEMAXIMUMHP: 1500,
    SOURCEMAXIMUMMP: 800,
    SOURCEWEAPONSMALLDAMAGE: 40,
    SOURCEWEAPONLARGEDAMAGE: 60,
    TARGETLEVEL: 70,
    RAND_5: 2,
    RAND_10: 5,
    RAND_100: 50,
    RAND_1000: 500
  }

  it('damage = STR * 3 + LEVEL', () => {
    expect(evaluate('SOURCESTR * 3 + SOURCELEVEL', caster)).toBe(165)
  })

  it('heal with bound: min(max STR * 2, MAXHP - HP)', () => {
    const vars = { ...caster, SOURCEHP: 1200 }
    expect(evaluate('Min(SOURCESTR * 2, SOURCEMAXIMUMHP - SOURCEHP)', vars)).toBe(60)
  })

  it('formula with RAND and level scaling', () => {
    expect(evaluate('SOURCEWEAPONSMALLDAMAGE + RAND_10 + Floor(SOURCELEVEL / 10)', caster)).toBe(52)
  })

  it('conditional crit based on level diff', () => {
    expect(
      evaluate('if(SOURCELEVEL - TARGETLEVEL >= 5, SOURCESTR * 3, SOURCESTR * 2)', caster)
    ).toBe(90) // 75-70=5, takes the true branch
  })
})

// ── Agreement with NCalcSync 6.3.1 ───────────────────────────────────────────

// Each row was evaluated by NCalcSync 6.3.1 with the server's EvalOptions
// (OverflowProtection | RoundAwayFromZero) and IgnoreCaseAtBuiltInFunctions,
// on 2026-10-29 (HTOO-578). NCalc returns True/False for a relation; the server
// converts that to 1/0. Measure again when the server's NCalc version moves.
describe('agrees with NCalc', () => {
  const vars = { I7: 7, I2: 2, D25: 2.5, NEG: -2.5 }
  it.each([
    ['2 ** 3', 8],
    ['2 ** 3 ** 2', 512],
    ['-2 ** 2', -4],
    ['2 * 3 ** 2', 18],
    ['2 ** 3 * 2', 16],
    ['3 - 2 ** 2', -1],
    ['-I7 ** 2', -49],
    ['1 + 2 * 3', 7],
    ['7 / 2', 3.5],
    ['I7 / I2', 3.5],
    ['I7 % I2', 1],
    ['7.5 % 2', 1.5],
    ['2 * 3 % 4', 2],
    ['Max(3, 4)', 4],
    ['MAX(3, 4)', 4],
    ['Max(I7, D25)', 7],
    ['Min(3, 4)', 3],
    ['Floor(2.7)', 2],
    ['Ceiling(2.1)', 3],
    ['Ceiling(-2.5)', -2],
    ['Round(2.5, 0)', 3],
    ['Round(-2.5, 0)', -3],
    ['Round(D25, 0)', 3],
    ['Round(7.0 / 3, 2)', 2.33],
    ['Round(2.345, 2)', 2.35],
    ['Round(-2.345, 2)', -2.35],
    ['Round(I7 / I2, 0)', 4],
    ['Truncate(2.7)', 2],
    ['Truncate(-2.7)', -2],
    ['Sign(-3)', -1],
    ['Sign(0)', 0],
    ['Abs(NEG)', 2.5],
    ['Sqrt(16)', 4],
    ['Pow(2, 3)', 8],
    ['2 ** 0.5', Math.SQRT2],
    ['if(1 > 0, 7, 8)', 7],
    ['if(1, 7, 8)', 7],
    ['1 + 2 > 2', 1],
    ['2 > 1 + 5', 0],
    ['2 - -3', 5],
    ['1e3', 1000],
    ['.5 * 2', 1]
  ])('%s is %s', (expr, expected) => {
    expect(evaluate(expr, vars)).toBe(expected)
  })

  it.each([
    // NCalc: "Max() takes exactly 2 arguments", and so on.
    'Max(1, 2, 3)',
    'Min(1, 2, 3)',
    'Max(2)',
    'Round(2.5)',
    'Floor(2.5, 1)',
    'Abs(1, 2)',
    'Pow(2)',
    'if(1 > 0, 7)',
    'Ceil(2.1)',
    // NCalc: XOR, not a power.
    '5 ^ 2',
    // The server returns 0: OverflowException, DivideByZeroException, NaN.
    'I7 / 0',
    'I7 % 0',
    '0 / 0',
    'Sqrt(-1)'
  ])('%s does not give the author a number', (expr) => {
    expect(() => evaluate(expr, vars)).toThrow()
  })

  it('rounds as .NET does at the binary edges', () => {
    // Math.Round(x, d, MidpointRounding.AwayFromZero), measured in .NET 10.
    const cases = [
      [1.005, 2, 1],
      [2.675, 2, 2.68],
      [1.255, 2, 1.25],
      [1.255, 1, 1.3],
      [0.125, 2, 0.13],
      [0.125, 1, 0.1],
      [-1.005, 2, -1],
      [1234.5675, 2, 1234.57],
      [1234.5675, 3, 1234.568],
      [0.285, 2, 0.28]
    ]
    for (const [x, d, expected] of cases) {
      expect(roundAwayFromZero(x, d), `${x}, ${d}`).toBe(expected)
    }
  })
})
