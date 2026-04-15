import { describe, it, expect } from 'vitest';
import {
  tokenize,
  compile,
  evaluate,
  variablesUsed,
  UnknownVariableError,
  UnknownFunctionError,
} from '../formulaEval.js';

// ── Tokenizer ────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('numbers, operators, identifiers', () => {
    expect(tokenize('1 + 2.5 * SOURCESTR')).toEqual([
      { type: 'num', value: 1 },
      { type: 'op', value: '+' },
      { type: 'num', value: 2.5 },
      { type: 'op', value: '*' },
      { type: 'ident', value: 'SOURCESTR' },
    ]);
  });

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
      { type: 'op', value: ')' },
    ]);
  });

  it('underscored + digit identifiers', () => {
    const toks = tokenize('RAND_100 + SOURCELEVEL');
    expect(toks[0]).toEqual({ type: 'ident', value: 'RAND_100' });
    expect(toks[2]).toEqual({ type: 'ident', value: 'SOURCELEVEL' });
  });

  it('decimal-only numbers', () => {
    expect(tokenize('.5')).toEqual([{ type: 'num', value: 0.5 }]);
  });
});

// ── Arithmetic + precedence ──────────────────────────────────────────────────

describe('evaluate — arithmetic', () => {
  it('basic ops', () => {
    expect(evaluate('1 + 2')).toBe(3);
    expect(evaluate('10 - 3')).toBe(7);
    expect(evaluate('4 * 5')).toBe(20);
    expect(evaluate('20 / 4')).toBe(5);
    expect(evaluate('10 % 3')).toBe(1);
  });

  it('mul binds tighter than add', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14);
    expect(evaluate('(2 + 3) * 4')).toBe(20);
  });

  it('power is right-associative and tightest', () => {
    expect(evaluate('2 ^ 3')).toBe(8);
    expect(evaluate('2 ^ 3 ^ 2')).toBe(512); // 2^(3^2) = 2^9
    expect(evaluate('2 * 3 ^ 2')).toBe(18);  // 2 * (3^2)
  });

  it('unary minus', () => {
    expect(evaluate('-5')).toBe(-5);
    expect(evaluate('-5 + 3')).toBe(-2);
    expect(evaluate('-(2 + 3)')).toBe(-5);
    expect(evaluate('- -5')).toBe(5);
  });
});

// ── Variables ────────────────────────────────────────────────────────────────

describe('evaluate — variables', () => {
  it('substitutes from the vars map', () => {
    expect(evaluate('SOURCESTR * 3', { SOURCESTR: 10 })).toBe(30);
  });

  it('throws UnknownVariableError with the name', () => {
    try {
      evaluate('SOURCEWIS', {});
      throw new Error('expected UnknownVariableError');
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownVariableError);
      expect(e.variable).toBe('SOURCEWIS');
    }
  });

  it('uses many variables in a Hybrasyl-ish formula', () => {
    const vars = { SOURCESTR: 15, SOURCELEVEL: 50, RAND_10: 5 };
    expect(evaluate('SOURCESTR + SOURCELEVEL + RAND_10', vars)).toBe(70);
    expect(evaluate('(SOURCESTR * 2) + floor(SOURCELEVEL / 10)', vars)).toBe(35);
  });
});

// ── Functions ────────────────────────────────────────────────────────────────

describe('evaluate — functions', () => {
  it('min / max accept variadic args', () => {
    expect(evaluate('min(3, 1, 2)')).toBe(1);
    expect(evaluate('max(3, 1, 2)')).toBe(3);
  });

  it('floor / ceil / round / abs / sqrt', () => {
    expect(evaluate('floor(3.8)')).toBe(3);
    expect(evaluate('ceil(3.2)')).toBe(4);
    expect(evaluate('round(3.5)')).toBe(4);
    expect(evaluate('abs(-7)')).toBe(7);
    expect(evaluate('sqrt(16)')).toBe(4);
  });

  it('function names are case-insensitive (Excel-ish)', () => {
    expect(evaluate('FLOOR(3.9)')).toBe(3);
    expect(evaluate('Min(10, 5)')).toBe(5);
  });

  it('unknown function throws UnknownFunctionError', () => {
    try {
      evaluate('notreal(1, 2)');
      throw new Error('expected UnknownFunctionError');
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownFunctionError);
      expect(e.function).toBe('notreal');
    }
  });
});

// ── if() + relational ops ───────────────────────────────────────────────────

describe('evaluate — if / relational', () => {
  it('relational ops yield 1/0', () => {
    expect(evaluate('1 < 2')).toBe(1);
    expect(evaluate('1 > 2')).toBe(0);
    expect(evaluate('5 == 5')).toBe(1);
    expect(evaluate('5 != 5')).toBe(0);
    expect(evaluate('5 <= 5')).toBe(1);
    expect(evaluate('5 >= 6')).toBe(0);
  });

  it('if chooses branch by condition truthiness', () => {
    expect(evaluate('if(1, 10, 20)')).toBe(10);
    expect(evaluate('if(0, 10, 20)')).toBe(20);
    expect(evaluate('if(SOURCELEVEL >= 50, SOURCESTR * 3, SOURCESTR * 2)', {
      SOURCELEVEL: 60, SOURCESTR: 10,
    })).toBe(30);
    expect(evaluate('if(SOURCELEVEL >= 50, SOURCESTR * 3, SOURCESTR * 2)', {
      SOURCELEVEL: 40, SOURCESTR: 10,
    })).toBe(20);
  });

  it('if short-circuits unreferenced branches', () => {
    // UNSET would throw UnknownVariableError if evaluated; must not be
    expect(evaluate('if(1, 42, UNSET)', {})).toBe(42);
    expect(evaluate('if(0, UNSET, 42)', {})).toBe(42);
  });

  it('if requires exactly 3 args', () => {
    expect(() => evaluate('if(1, 2)')).toThrow();
    expect(() => evaluate('if(1, 2, 3, 4)')).toThrow();
  });
});

// ── Compile + reuse ─────────────────────────────────────────────────────────

describe('compile', () => {
  it('returns a reusable function', () => {
    const fn = compile('SOURCESTR * RAND_10');
    expect(fn({ SOURCESTR: 10, RAND_10: 5 })).toBe(50);
    expect(fn({ SOURCESTR: 20, RAND_10: 10 })).toBe(200);
  });
});

// ── variablesUsed ────────────────────────────────────────────────────────────

describe('variablesUsed', () => {
  it('extracts every referenced variable once', () => {
    const used = variablesUsed('SOURCESTR * 3 + SOURCELEVEL + RAND_10 + SOURCESTR');
    expect(used).toEqual(new Set(['SOURCESTR', 'SOURCELEVEL', 'RAND_10']));
  });

  it('walks through function args and if branches', () => {
    const used = variablesUsed('if(A > B, min(C, D), floor(E / F))');
    expect(used).toEqual(new Set(['A', 'B', 'C', 'D', 'E', 'F']));
  });

  it('returns empty set for constant-only expressions', () => {
    expect(variablesUsed('1 + 2 * 3').size).toBe(0);
  });

  it('compile() exposes .variables', () => {
    const fn = compile('X + Y');
    expect(fn.variables).toEqual(new Set(['X', 'Y']));
  });
});

// ── Realistic Hybrasyl formulas ──────────────────────────────────────────────

describe('realistic formulas', () => {
  const caster = {
    SOURCESTR: 30, SOURCEINT: 25, SOURCEWIS: 20, SOURCECON: 18, SOURCEDEX: 15,
    SOURCELEVEL: 75, SOURCEABILITY: 50,
    SOURCEHP: 1500, SOURCEMP: 800, SOURCEMAXIMUMHP: 1500, SOURCEMAXIMUMMP: 800,
    SOURCEWEAPONSMALLDAMAGE: 40, SOURCEWEAPONLARGEDAMAGE: 60,
    TARGETLEVEL: 70,
    RAND_5: 2, RAND_10: 5, RAND_100: 50, RAND_1000: 500,
  };

  it('damage = STR * 3 + LEVEL', () => {
    expect(evaluate('SOURCESTR * 3 + SOURCELEVEL', caster)).toBe(165);
  });

  it('heal with bound: min(max STR * 2, MAXHP - HP)', () => {
    const vars = { ...caster, SOURCEHP: 1200 };
    expect(evaluate('min(SOURCESTR * 2, SOURCEMAXIMUMHP - SOURCEHP)', vars)).toBe(60);
  });

  it('formula with RAND and level scaling', () => {
    expect(evaluate('SOURCEWEAPONSMALLDAMAGE + RAND_10 + floor(SOURCELEVEL / 10)', caster)).toBe(52);
  });

  it('conditional crit based on level diff', () => {
    expect(evaluate(
      'if(SOURCELEVEL - TARGETLEVEL >= 5, SOURCESTR * 3, SOURCESTR * 2)',
      caster,
    )).toBe(90); // 75-70=5, takes the true branch
  });
});
