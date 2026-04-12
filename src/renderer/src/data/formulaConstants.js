// ── Budget Modifier Modes ────────────────────────────────────────────────────
export const BUDGET_MODES = ['none', 'linearStep', 'binary', 'steppedTiers'];
export const BUDGET_APPLICATIONS = ['additive', 'multiplicative'];

export const DEFAULT_BUDGET_MODIFIER = {
  mode: 'none',
  application: 'additive',
  lines: { baseline: 4, step: 0.03, cap: null },
  cooldown: { baseline: 6, step: 0.01, cap: 0.2 },
};

// ── Formula Constants (known scalar variables used by patterns) ───────────────
// These are stored in settings.customVariables but displayed in a dedicated
// "Formula Constants" section above free-form custom variables.
export const FORMULA_CONSTANTS = [
  { key: 'LevelUpper', label: 'Level Upper', default: 110,
    description: 'Upper level constant for inverse-level scaling. Used by Old Hybrasyl pattern.' },
  { key: 'LevelDiv',   label: 'Level Divisor', default: 10,
    description: 'Divisor for inverse-level scaling. Used by Old Hybrasyl pattern.' },
  { key: 'Divisor',    label: 'New Divisor', default: 1500,
    description: 'Stat block divisor for multiplicative scaling. Used by New Hybrasyl pattern.' },
];

export const FORMULA_CONSTANT_KEYS = FORMULA_CONSTANTS.map((c) => c.key);

// ── Coefficient Definitions ──────────────────────────────────────────────────
// Each group maps to a collapsible section in the Globals modal.
// Keys are the canonical coefficient identifiers used in formulas.json.
// `skillOnly` means the spell column is disabled (e.g. Assail).

export const COEFFICIENT_GROUPS = [
  {
    id: 'damage',
    label: 'Damage',
    coefficients: [
      { key: 'DMG_ST',      label: 'Single Target',              description: 'Direct single-target damage' },
      { key: 'DMG_ST_DOT',  label: 'Single Target DOT',          description: 'Single-target damage over time' },
      { key: 'DMG_ST_HDIR', label: 'Single Target Hybrid Direct', description: 'Direct portion of a hybrid ST spell' },
      { key: 'DMG_ST_HDOT', label: 'Single Target Hybrid DOT',   description: 'DOT portion of a hybrid ST spell' },
      { key: 'DMG_AOE',     label: 'AOE',                        description: 'Direct area-of-effect damage' },
      { key: 'DMG_AOE_DOT', label: 'AOE DOT',                    description: 'Area-of-effect damage over time' },
      { key: 'DMG_AOE_HDIR', label: 'AOE Hybrid Direct',         description: 'Direct portion of a hybrid AOE spell' },
      { key: 'DMG_AOE_HDOT', label: 'AOE Hybrid DOT',            description: 'DOT portion of a hybrid AOE spell' },
      { key: 'DMG_ASSAIL',  label: 'Assail',                     description: 'Assail (skill only)', skillOnly: true },
    ],
  },
  {
    id: 'heal',
    label: 'Heal',
    coefficients: [
      { key: 'HEAL_ST',      label: 'Single Target',              description: 'Direct single-target heal' },
      { key: 'HEAL_ST_HOT',  label: 'Single Target HOT',          description: 'Single-target heal over time' },
      { key: 'HEAL_ST_HDIR', label: 'Single Target Hybrid Direct', description: 'Direct portion of a hybrid ST heal' },
      { key: 'HEAL_ST_HDOT', label: 'Single Target Hybrid HOT',   description: 'HOT portion of a hybrid ST heal' },
      { key: 'HEAL_AOE',     label: 'AOE',                        description: 'Direct area-of-effect heal' },
      { key: 'HEAL_AOE_HOT', label: 'AOE HOT',                    description: 'Area-of-effect heal over time' },
      { key: 'HEAL_AOE_HDIR', label: 'AOE Hybrid Direct',         description: 'Direct portion of a hybrid AOE heal' },
      { key: 'HEAL_AOE_HDOT', label: 'AOE Hybrid HOT',            description: 'HOT portion of a hybrid AOE heal' },
    ],
  },
  {
    id: 'conversion',
    label: 'Conversion',
    coefficients: [
      { key: 'CONV_ST',      label: 'Single Target',              description: 'Direct single-target conversion (e.g. HP/MP to damage)' },
      { key: 'CONV_ST_DOT',  label: 'Single Target DOT',          description: 'Single-target conversion over time' },
      { key: 'CONV_ST_HDIR', label: 'Single Target Hybrid Direct', description: 'Direct portion of a hybrid ST conversion' },
      { key: 'CONV_ST_HDOT', label: 'Single Target Hybrid DOT',   description: 'DOT portion of a hybrid ST conversion' },
      { key: 'CONV_AOE',     label: 'AOE',                        description: 'Direct area-of-effect conversion' },
      { key: 'CONV_AOE_DOT', label: 'AOE DOT',                    description: 'Area-of-effect conversion over time' },
      { key: 'CONV_AOE_HDIR', label: 'AOE Hybrid Direct',         description: 'Direct portion of a hybrid AOE conversion' },
      { key: 'CONV_AOE_HDOT', label: 'AOE Hybrid DOT',            description: 'DOT portion of a hybrid AOE conversion' },
    ],
  },
  {
    id: 'shield',
    label: 'Shield',
    coefficients: [
      { key: 'SHIELD_ST',  label: 'Single Target', description: 'Single-target damage absorption' },
      { key: 'SHIELD_AOE', label: 'AOE',           description: 'Area-of-effect damage absorption' },
    ],
  },
];

// Flat list of all coefficient keys for validation / iteration
export const ALL_COEFFICIENT_KEYS = COEFFICIENT_GROUPS.flatMap((g) =>
  g.coefficients.map((c) => c.key),
);

// ── Empty settings object ────────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  budgetModifier: { ...DEFAULT_BUDGET_MODIFIER },
  customVariables: {},
  coefficients: {},   // keyed by coefficient key → { spell: number|null, skill: number|null }
  defaultPatternId: null, // id of the default builtin pattern for new formulas
};
