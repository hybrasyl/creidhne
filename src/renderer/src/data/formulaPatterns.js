/**
 * Builtin formula patterns.
 *
 * Each pattern describes the structural shape of a formula — what terms it
 * contains, what parameters the user needs to supply, and how they assemble
 * into the final NCalc string.  Patterns are read-only references; the user
 * picks one when creating a formula and fills in parameters on the formula
 * editor page.
 *
 * `structure` is a human-readable template showing placeholders in {braces}.
 * `ncalc` is the actual NCalc template with {PLACEHOLDER} tokens that the
 * formula editor will substitute when assembling.
 */

const BUILTIN_PATTERNS = [
  {
    id: 'old-hybrasyl',
    name: 'Old Hybrasyl',
    description:
      'Two-term additive formula. The first term scales linearly with level, ' +
      'random damage, and weapon damage. The second term scales with a stat block ' +
      'plus an inverse-level component, then multiplied by the coefficient. ' +
      'Produces more variance due to the random term.',
    structure:
      '({Base} * SOURCELEVEL + {Rand} + SOURCEWEAPONSMALLDAMAGE * {WeaponCoeff})\n' +
      '  + ({StatBlock} + ({LevelUpper} - SOURCELEVEL) / {LevelDiv})\n' +
      '  * {Coefficient}',
    ncalc:
      '({Base} * SOURCELEVEL + {Rand} + SOURCEWEAPONSMALLDAMAGE * {WeaponCoeff}) ' +
      '+ (({StatBlock} + ({LevelUpper} - SOURCELEVEL) / {LevelDiv}) * {Coefficient})',
    parameters: [
      {
        key: 'Base',
        label: 'Base Damage',
        type: 'number',
        description: 'Flat multiplier on character level for the base damage term.',
      },
      {
        key: 'Rand',
        label: 'Random Term',
        type: 'rand',
        description:
          'Server random variable and multiplier. Uses RAND_5, RAND_10, RAND_100, or RAND_1000. ' +
          'Example: RAND_10 * 4',
      },
      {
        key: 'WeaponCoeff',
        label: 'Weapon Coefficient',
        type: 'number',
        description: 'Optional. Multiplier applied to SOURCEWEAPONSMALLDAMAGE (or SOURCEWEAPONLARGEDAMAGE). Set to 0 or leave empty to omit weapon damage.',
        optional: true,
      },
      {
        key: 'StatBlock',
        label: 'Stat Block',
        type: 'stat_block',
        description:
          'Weighted combination of character stats. Example: SOURCESTR * 3 + SOURCEDEX * 1 + SOURCECON * 1',
      },
      {
        key: 'LevelUpper',
        label: 'Level Upper',
        type: 'setting',
        settingKey: 'LevelUpper',
        description: 'Upper level constant for the inverse-level scaling term. Typically 110.',
      },
      {
        key: 'LevelDiv',
        label: 'Level Divisor',
        type: 'setting',
        settingKey: 'LevelDiv',
        description: 'Divisor for the inverse-level scaling term. Typically 10.',
      },
      {
        key: 'Coefficient',
        label: 'Coefficient',
        type: 'coefficient',
        description:
          'Derived from the coefficients table based on the formula\'s effect type, ' +
          'targeting, and delivery. Modified by the budget modifier (Lines or CD).',
      },
    ],
  },
  {
    id: 'new-hybrasyl',
    name: 'New Hybrasyl',
    description:
      'Multiplicative formula. Base damage scales with levels gained since the spell ' +
      'was acquired (SOURCELEVEL − ACQUIREDLEVEL, floor 1), plus optional random variance ' +
      'and weapon damage, then multiplied by a stat ratio (stat block / divisor) and ' +
      'the coefficient. The divisor controls how much stats amplify the base damage.',
    structure:
      '({Base} * MAX(SOURCELEVEL - ACQUIREDLEVEL, 1) + {Rand} + SOURCEWEAPONSMALLDAMAGE * {WeaponCoeff})\n' +
      '  * (1 + {StatBlock} / {Divisor})\n' +
      '  * {Coefficient}',
    ncalc:
      '({Base} * MAX(SOURCELEVEL - ACQUIREDLEVEL, 1) + {Rand} + SOURCEWEAPONSMALLDAMAGE * {WeaponCoeff}) ' +
      '* (1 + {StatBlock} / {Divisor}) * {Coefficient}',
    parameters: [
      {
        key: 'Base',
        label: 'Base Damage',
        type: 'number',
        description: 'Flat multiplier on the level delta (SOURCELEVEL − ACQUIREDLEVEL, floor 1) for the base damage term.',
      },
      {
        key: 'Rand',
        label: 'Random Term',
        type: 'rand',
        description:
          'Optional. Server random variable and multiplier. Uses RAND_5, RAND_10, RAND_100, or RAND_1000. ' +
          'Example: RAND_10 * 4. Leave as None for no random variance.',
      },
      {
        key: 'WeaponCoeff',
        label: 'Weapon Coefficient',
        type: 'number',
        description: 'Optional. Multiplier applied to SOURCEWEAPONSMALLDAMAGE (or SOURCEWEAPONLARGEDAMAGE). Set to 0 or leave empty to omit weapon damage.',
        optional: true,
      },
      {
        key: 'StatBlock',
        label: 'Stat Block',
        type: 'stat_block',
        description:
          'Weighted combination of character stats. Example: SOURCESTR * 3 + SOURCEDEX * 1 + SOURCECON * 1',
      },
      {
        key: 'Divisor',
        label: 'Divisor',
        type: 'setting',
        settingKey: 'Divisor',
        description:
          'Controls how much the stat block amplifies base damage. Higher = less amplification. Typically 1500.',
      },
      {
        key: 'Coefficient',
        label: 'Coefficient',
        type: 'coefficient',
        description:
          'Derived from the coefficients table based on the formula\'s effect type, ' +
          'targeting, and delivery. Modified by the budget modifier (Lines or CD).',
      },
    ],
  },
  {
    id: 'da-classic-spell',
    name: 'Dark Ages Classic Spell',
    description:
      'Simple cost-based spell formula from the original Dark Ages. Damage scales ' +
      'directly from the castable\'s mana cost (must be a static value, not ' +
      'percentage-based). Only works for castables with fixed MP costs. ' +
      'The mana cost is pulled from the castable index.',
    structure:
      '{ManaCost} * {StatCalc} + {BaseDamage}',
    ncalc:
      '{ManaCost} * {StatCalc} + {BaseDamage}',
    parameters: [
      {
        key: 'ManaCost',
        label: 'Mana Cost',
        type: 'castable_cost',
        description:
          'The castable\'s static MP cost, pulled from the castable index. ' +
          'Only supports fixed costs (e.g. 400 MP), not percentage-based costs.',
      },
      {
        key: 'StatCalc',
        label: 'Stat Calculation',
        type: 'stat_block',
        description:
          'Weighted combination of character stats used as a damage multiplier on the mana cost.',
      },
      {
        key: 'BaseDamage',
        label: 'Base Damage',
        type: 'number',
        description: 'Flat damage added after the cost × stat calculation.',
      },
    ],
  },
  {
    id: 'da-classic-skill',
    name: 'Dark Ages Classic Skill',
    description:
      'Simple skill formula from the original Dark Ages. Damage is a flat base ' +
      'plus a stat block and weapon damage. No mana cost scaling — skills rely ' +
      'on raw stats and weapon output.',
    structure:
      '{BaseDamage} + {StatBlock} + SOURCEWEAPONSMALLDAMAGE',
    ncalc:
      '{BaseDamage} + {StatBlock} + SOURCEWEAPONSMALLDAMAGE',
    parameters: [
      {
        key: 'BaseDamage',
        label: 'Base Damage',
        type: 'number',
        description: 'Flat base damage for the skill.',
      },
      {
        key: 'StatBlock',
        label: 'Stat Block',
        type: 'stat_block',
        description:
          'Weighted combination of character stats. Example: SOURCESTR * 3 + SOURCEDEX * 1',
      },
    ],
  },
];

export default BUILTIN_PATTERNS;
