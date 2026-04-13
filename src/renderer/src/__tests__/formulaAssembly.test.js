import { describe, it, expect } from 'vitest';
import { assembleFormula } from '../utils/formulaAssembly';

// ── Helper: minimal param defs ──────────────────────────────────────────────
const numDef   = (key) => ({ key, type: 'number' });
const randDef  = (key) => ({ key, type: 'rand' });
const statDef  = (key) => ({ key, type: 'stat_block' });
const settDef  = (key) => ({ key, type: 'setting' });
const coefDef  = (key) => ({ key, type: 'coefficient' });
const costDef  = (key) => ({ key, type: 'castable_cost' });

// ── Basic substitution ──────────────────────────────────────────────────────

describe('assembleFormula — basic substitution', () => {
  it('substitutes number values', () => {
    const result = assembleFormula('{Base} * SOURCELEVEL', { Base: 5 }, [numDef('Base')]);
    expect(result).toBe('5 * SOURCELEVEL');
  });

  it('substitutes missing number as 0', () => {
    const result = assembleFormula('{Base} * SOURCELEVEL', {}, [numDef('Base')]);
    expect(result).toBe('0 * SOURCELEVEL');
  });

  it('substitutes setting values', () => {
    const result = assembleFormula('SOURCELEVEL / {LevelDiv}', { LevelDiv: 10 }, [settDef('LevelDiv')]);
    expect(result).toBe('SOURCELEVEL / 10');
  });

  it('substitutes coefficient values', () => {
    const result = assembleFormula('damage * {Coefficient}', { Coefficient: 1.03 }, [coefDef('Coefficient')]);
    expect(result).toBe('damage * 1.03');
  });

  it('substitutes castable_cost values', () => {
    const result = assembleFormula('{ManaCost} * stats', { ManaCost: 400 }, [costDef('ManaCost')]);
    expect(result).toBe('400 * stats');
  });

  it('replaces multiple occurrences of the same placeholder', () => {
    const result = assembleFormula('{X} + {X}', { X: 3 }, [numDef('X')]);
    expect(result).toBe('3 + 3');
  });

  it('returns empty string for null template', () => {
    expect(assembleFormula(null, {}, [])).toBe('');
    expect(assembleFormula('', {}, [])).toBe('');
  });
});

// ── Rand substitution ───────────────────────────────────────────────────────

describe('assembleFormula — rand', () => {
  it('substitutes rand with multiplier', () => {
    const result = assembleFormula('base + {Rand}', { Rand: { variable: 'RAND_10', multiplier: 4 } }, [randDef('Rand')]);
    expect(result).toBe('base + RAND_10 * 4');
  });

  it('substitutes rand with multiplier of 1 as just the variable', () => {
    const result = assembleFormula('base + {Rand}', { Rand: { variable: 'RAND_10', multiplier: 1 } }, [randDef('Rand')]);
    expect(result).toBe('base + RAND_10');
  });

  it('strips empty rand term from formula', () => {
    const result = assembleFormula('base + {Rand}', { Rand: { variable: '', multiplier: 1 } }, [randDef('Rand')]);
    expect(result).toBe('base');
  });

  it('strips missing rand term from formula', () => {
    const result = assembleFormula('base + {Rand}', {}, [randDef('Rand')]);
    expect(result).toBe('base');
  });
});

// ── Stat block substitution ─────────────────────────────────────────────────

describe('assembleFormula — stat_block', () => {
  it('substitutes stat block rows', () => {
    const rows = [
      { stat: 'SOURCESTR', weight: 3 },
      { stat: 'SOURCEDEX', weight: 1 },
    ];
    const result = assembleFormula('({StatBlock}) / 1500', { StatBlock: rows }, [statDef('StatBlock')]);
    expect(result).toBe('(SOURCESTR * 3 + SOURCEDEX * 1) / 1500');
  });

  it('substitutes empty stat block as 0', () => {
    const result = assembleFormula('({StatBlock}) / 1500', { StatBlock: [] }, [statDef('StatBlock')]);
    expect(result).toBe('(0) / 1500');
  });
});

// ── Optional term stripping (Rand) ──────────────────────────────────────────

describe('assembleFormula — optional rand stripping', () => {
  it('strips + {Rand} when rand has no variable', () => {
    const template = '({Base} * SOURCELEVEL + {Rand} + WEAPON)';
    const result = assembleFormula(template, { Base: 1, Rand: { variable: '', multiplier: 1 } }, [numDef('Base'), randDef('Rand')]);
    expect(result).toBe('(1 * SOURCELEVEL + WEAPON)');
  });

  it('strips + {Rand} when rand is missing', () => {
    const template = '({Base} * SOURCELEVEL + {Rand} + WEAPON)';
    const result = assembleFormula(template, { Base: 1 }, [numDef('Base'), randDef('Rand')]);
    expect(result).toBe('(1 * SOURCELEVEL + WEAPON)');
  });

  it('keeps rand when variable is set', () => {
    const template = '({Base} * SOURCELEVEL + {Rand} + WEAPON)';
    const result = assembleFormula(template, { Base: 1, Rand: { variable: 'RAND_10', multiplier: 4 } }, [numDef('Base'), randDef('Rand')]);
    expect(result).toBe('(1 * SOURCELEVEL + RAND_10 * 4 + WEAPON)');
  });
});

// ── Optional term stripping (Weapon) ────────────────────────────────────────

describe('assembleFormula — optional weapon stripping', () => {
  const weaponDef = { key: 'WeaponCoeff', type: 'number', optional: true };

  it('strips weapon term when _weaponEnabled is false', () => {
    const template = '({Base} * SOURCELEVEL + SOURCEWEAPONSMALLDAMAGE * {WeaponCoeff})';
    const result = assembleFormula(template, { Base: 1, _weaponEnabled: false }, [numDef('Base'), weaponDef]);
    expect(result).toBe('(1 * SOURCELEVEL)');
  });

  it('strips weapon term when _weaponEnabled is missing', () => {
    const template = '({Base} * SOURCELEVEL + SOURCEWEAPONSMALLDAMAGE * {WeaponCoeff})';
    const result = assembleFormula(template, { Base: 1 }, [numDef('Base'), weaponDef]);
    expect(result).toBe('(1 * SOURCELEVEL)');
  });

  it('keeps weapon term when _weaponEnabled is true', () => {
    const template = '({Base} * SOURCELEVEL + SOURCEWEAPONSMALLDAMAGE * {WeaponCoeff})';
    const result = assembleFormula(template, { Base: 1, _weaponEnabled: true, WeaponCoeff: 2 }, [numDef('Base'), weaponDef]);
    expect(result).toBe('(1 * SOURCELEVEL + SOURCEWEAPONSMALLDAMAGE * 2)');
  });
});

// ── Full pattern assembly ───────────────────────────────────────────────────

describe('assembleFormula — full patterns', () => {
  it('assembles New Hybrasyl with all params', () => {
    const template =
      '({Base} * MAX(SOURCELEVEL - 1, 1) + {Rand} + SOURCEWEAPONSMALLDAMAGE * {WeaponCoeff}) ' +
      '* (1 + {StatBlock} / {Divisor}) * {Coefficient}';
    const defs = [
      numDef('Base'), randDef('Rand'),
      { key: 'WeaponCoeff', type: 'number', optional: true },
      statDef('StatBlock'), settDef('Divisor'), coefDef('Coefficient'),
    ];
    const params = {
      Base: 1,
      Rand: { variable: 'RAND_10', multiplier: 4 },
      _weaponEnabled: true,
      WeaponCoeff: 1,
      StatBlock: [{ stat: 'SOURCESTR', weight: 3 }, { stat: 'SOURCECON', weight: 1 }],
      Divisor: 1500,
      Coefficient: 0.54,
    };
    const result = assembleFormula(template, params, defs);
    expect(result).toBe(
      '(1 * MAX(SOURCELEVEL - 1, 1) + RAND_10 * 4 + SOURCEWEAPONSMALLDAMAGE * 1) ' +
      '* (1 + SOURCESTR * 3 + SOURCECON * 1 / 1500) * 0.54',
    );
  });

  it('assembles New Hybrasyl with no rand and no weapon', () => {
    const template =
      '({Base} * MAX(SOURCELEVEL - 1, 1) + {Rand} + SOURCEWEAPONSMALLDAMAGE * {WeaponCoeff}) ' +
      '* (1 + {StatBlock} / {Divisor}) * {Coefficient}';
    const defs = [
      numDef('Base'), randDef('Rand'),
      { key: 'WeaponCoeff', type: 'number', optional: true },
      statDef('StatBlock'), settDef('Divisor'), coefDef('Coefficient'),
    ];
    const params = {
      Base: 1,
      _weaponEnabled: false,
      StatBlock: [{ stat: 'SOURCESTR', weight: 3 }],
      Divisor: 1500,
      Coefficient: 1.0,
    };
    const result = assembleFormula(template, params, defs);
    expect(result).toBe(
      '(1 * MAX(SOURCELEVEL - 1, 1)) * (1 + SOURCESTR * 3 / 1500) * 1',
    );
  });

  it('assembles DA Classic Spell', () => {
    const template = '{ManaCost} * {StatCalc} + {BaseDamage}';
    const defs = [costDef('ManaCost'), statDef('StatCalc'), numDef('BaseDamage')];
    const params = {
      ManaCost: 400,
      StatCalc: [{ stat: 'SOURCEINT', weight: 2 }],
      BaseDamage: 50,
    };
    const result = assembleFormula(template, params, defs);
    expect(result).toBe('400 * SOURCEINT * 2 + 50');
  });

  it('assembles DA Classic Skill', () => {
    const template = '{BaseDamage} + {StatBlock} + SOURCEWEAPONSMALLDAMAGE';
    const defs = [numDef('BaseDamage'), statDef('StatBlock')];
    const params = {
      BaseDamage: 100,
      StatBlock: [{ stat: 'SOURCESTR', weight: 3 }, { stat: 'SOURCEDEX', weight: 1 }],
    };
    const result = assembleFormula(template, params, defs);
    expect(result).toBe('100 + SOURCESTR * 3 + SOURCEDEX * 1 + SOURCEWEAPONSMALLDAMAGE');
  });
});
