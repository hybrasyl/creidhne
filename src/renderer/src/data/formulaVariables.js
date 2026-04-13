/**
 * NCalc runtime variables available in Hybrasyl formula expressions.
 * Derived from server-side [FormulaVariable] attributes:
 *   - StatInfo.cs  → SOURCE / TARGET prefix
 *   - Creature.cs  → SOURCE / TARGET prefix
 *   - MapObject.cs → MAP prefix
 *   - CASTABLE / ITEM prefixes exist in FormulaParser.cs but have NO tagged
 *     properties on the server — they silently produce nothing at runtime.
 *     Included here for documentation but flagged as serverGap.
 *
 * The stat block builder uses VARIABLE_PREFIXES × STAT_DEFINITIONS to generate
 * the full list (e.g. prefix "SOURCE" + stat "STR" → "SOURCESTR").
 */

// ── Variable prefixes ────────────────────────────────────────────────────────
export const VARIABLE_PREFIXES = [
  { key: 'SOURCE', label: 'Source (Caster)' },
  { key: 'TARGET', label: 'Target' },
  { key: 'MAP',    label: 'Map' },
];

// ── Stat definitions by group ────────────────────────────────────────────────
// Each stat has a `suffix` that gets appended to the prefix.
// `prefixes` controls which prefixes are valid for this stat.
// If omitted, SOURCE and TARGET are assumed.

export const STAT_GROUPS = [
  {
    id: 'core',
    label: 'Core Stats',
    stats: [
      { suffix: 'STR',   label: 'Strength' },
      { suffix: 'INT',   label: 'Intelligence' },
      { suffix: 'WIS',   label: 'Wisdom' },
      { suffix: 'CON',   label: 'Constitution' },
      { suffix: 'DEX',   label: 'Dexterity' },
    ],
  },
  {
    id: 'level',
    label: 'Level / Progression',
    stats: [
      { suffix: 'LEVEL',      label: 'Level' },
      { suffix: 'EXPERIENCE', label: 'Experience' },
      { suffix: 'ABILITY',    label: 'Ability' },
      { suffix: 'ABILITYEXP', label: 'Ability Exp' },
      { suffix: 'FAITH',      label: 'Faith' },
      { suffix: 'GOLD',       label: 'Gold' },
      { suffix: 'FORMULALEVEL', label: 'Formula Level' },
    ],
  },
  {
    id: 'hp_mp',
    label: 'HP / MP',
    stats: [
      { suffix: 'HP',        label: 'Current HP' },
      { suffix: 'MP',        label: 'Current MP' },
      { suffix: 'MAXIMUMHP', label: 'Max HP' },
      { suffix: 'MAXIMUMMP', label: 'Max MP' },
      { suffix: 'BASEHP',    label: 'Base HP' },
      { suffix: 'BASEMP',    label: 'Base MP' },
      { suffix: 'BONUSHP',   label: 'Bonus HP' },
      { suffix: 'BONUSMP',   label: 'Bonus MP' },
    ],
  },
  {
    id: 'base_stats',
    label: 'Base Stats',
    stats: [
      { suffix: 'BASESTR', label: 'Base STR' },
      { suffix: 'BASEINT', label: 'Base INT' },
      { suffix: 'BASEWIS', label: 'Base WIS' },
      { suffix: 'BASECON', label: 'Base CON' },
      { suffix: 'BASEDEX', label: 'Base DEX' },
    ],
  },
  {
    id: 'bonus_stats',
    label: 'Bonus Stats',
    stats: [
      { suffix: 'BONUSSTR', label: 'Bonus STR' },
      { suffix: 'BONUSINT', label: 'Bonus INT' },
      { suffix: 'BONUSWIS', label: 'Bonus WIS' },
      { suffix: 'BONUSCON', label: 'Bonus CON' },
      { suffix: 'BONUSDEX', label: 'Bonus DEX' },
    ],
  },
  {
    id: 'combat',
    label: 'Combat',
    stats: [
      { suffix: 'DMG',       label: 'Dmg' },
      { suffix: 'HIT',       label: 'Hit' },
      { suffix: 'AC',        label: 'AC' },
      { suffix: 'MR',        label: 'MR' },
      { suffix: 'REGEN',     label: 'Regen' },
      { suffix: 'CRIT',      label: 'Crit' },
      { suffix: 'MAGICCRIT', label: 'Magic Crit' },
      { suffix: 'SHIELD',    label: 'Shield' },
    ],
  },
  {
    id: 'base_combat',
    label: 'Base Combat',
    stats: [
      { suffix: 'BASEDMG',       label: 'Base Dmg' },
      { suffix: 'BASEHIT',       label: 'Base Hit' },
      { suffix: 'BASEAC',        label: 'Base AC' },
      { suffix: 'BASEMR',        label: 'Base MR' },
      { suffix: 'BASEREGEN',     label: 'Base Regen' },
      { suffix: 'BASECRIT',      label: 'Base Crit' },
      { suffix: 'BASEMAGICCRIT', label: 'Base Magic Crit' },
    ],
  },
  {
    id: 'bonus_combat',
    label: 'Bonus Combat',
    stats: [
      { suffix: 'BONUSDMG',       label: 'Bonus Dmg' },
      { suffix: 'BONUSHIT',       label: 'Bonus Hit' },
      { suffix: 'BONUSAC',        label: 'Bonus AC' },
      { suffix: 'BONUSMR',        label: 'Bonus MR' },
      { suffix: 'BONUSREGEN',     label: 'Bonus Regen' },
      { suffix: 'BONUSCRIT',      label: 'Bonus Crit' },
      { suffix: 'BONUSMAGICCRIT', label: 'Bonus Magic Crit' },
    ],
  },
  {
    id: 'modifiers',
    label: 'Modifiers',
    stats: [
      { suffix: 'INBOUNDDAMAGEMODIFIER',  label: 'Inbound Damage Modifier' },
      { suffix: 'OUTBOUNDDAMAGEMODIFIER', label: 'Outbound Damage Modifier' },
      { suffix: 'INBOUNDHEALMODIFIER',    label: 'Inbound Heal Modifier' },
      { suffix: 'OUTBOUNDHEALMODIFIER',   label: 'Outbound Heal Modifier' },
      { suffix: 'REFLECTMAGICAL',         label: 'Reflect Magical' },
      { suffix: 'REFLECTPHYSICAL',        label: 'Reflect Physical' },
      { suffix: 'DODGE',                  label: 'Dodge' },
      { suffix: 'MAGICDODGE',             label: 'Magic Dodge' },
      { suffix: 'LIFESTEAL',              label: 'Life Steal' },
      { suffix: 'MANASTEAL',              label: 'Mana Steal' },
      { suffix: 'INBOUNDDAMAGETOMP',      label: 'Inbound Damage to MP' },
    ],
  },
  {
    id: 'base_modifiers',
    label: 'Base Modifiers',
    stats: [
      { suffix: 'BASEINBOUNDDAMAGEMODIFIER',  label: 'Base Inbound Dmg Modifier' },
      { suffix: 'BASEOUTBOUNDDAMAGEMODIFIER', label: 'Base Outbound Dmg Modifier' },
      { suffix: 'BASEINBOUNDHEALMODIFIER',    label: 'Base Inbound Heal Modifier' },
      { suffix: 'BASEOUTBOUNDHEALMODIFIER',   label: 'Base Outbound Heal Modifier' },
      { suffix: 'BASEREFLECTMAGICAL',         label: 'Base Reflect Magical' },
      { suffix: 'BASEREFLECTPHYSICAL',        label: 'Base Reflect Physical' },
      { suffix: 'BASEDODGE',                  label: 'Base Dodge' },
      { suffix: 'BASEMAGICDODGE',             label: 'Base Magic Dodge' },
      { suffix: 'BASELIFESTEAL',              label: 'Base Life Steal' },
      { suffix: 'BASEMANASTEAL',              label: 'Base Mana Steal' },
      { suffix: 'BASEINBOUNDDAMAGETOMP',      label: 'Base Inbound Dmg to MP' },
    ],
  },
  {
    id: 'bonus_modifiers',
    label: 'Bonus Modifiers',
    stats: [
      { suffix: 'BONUSINBOUNDDAMAGEMODIFIER',  label: 'Bonus Inbound Dmg Modifier' },
      { suffix: 'BONUSOUTBOUNDDAMAGEMODIFIER', label: 'Bonus Outbound Dmg Modifier' },
      { suffix: 'BONUSINBOUNDHEALMODIFIER',    label: 'Bonus Inbound Heal Modifier' },
      { suffix: 'BONUSOUTBOUNDHEALMODIFIER',   label: 'Bonus Outbound Heal Modifier' },
      { suffix: 'BONUSREFLECTMAGICAL',         label: 'Bonus Reflect Magical' },
      { suffix: 'BONUSREFLECTPHYSICAL',        label: 'Bonus Reflect Physical' },
      { suffix: 'BONUSDODGE',                  label: 'Bonus Dodge' },
      { suffix: 'BONUSMAGICDODGE',             label: 'Bonus Magic Dodge' },
      { suffix: 'BONUSLIFESTEAL',              label: 'Bonus Life Steal' },
      { suffix: 'BONUSMANASTEAL',              label: 'Bonus Mana Steal' },
    ],
  },
  {
    id: 'extras',
    label: 'Extras',
    stats: [
      { suffix: 'EXTRAGOLD',     label: 'Extra Gold' },
      { suffix: 'EXTRAXP',       label: 'Extra XP' },
      { suffix: 'EXTRAITEMFIND', label: 'Extra Item Find' },
      { suffix: 'EXTRAFAITH',    label: 'Extra Faith' },
    ],
  },
  {
    id: 'weapon',
    label: 'Weapon',
    stats: [
      { suffix: 'WEAPONSMALLDAMAGE', label: 'Weapon Small Damage' },
      { suffix: 'WEAPONLARGEDAMAGE', label: 'Weapon Large Damage' },
    ],
  },
  {
    id: 'map',
    label: 'Map',
    stats: [
      { suffix: 'X',         label: 'Map X', prefixes: ['MAP'] },
      { suffix: 'Y',         label: 'Map Y', prefixes: ['MAP'] },
      { suffix: 'TILES',     label: 'Map Tiles', prefixes: ['MAP'] },
      { suffix: 'BASELEVEL', label: 'Map Base Level', prefixes: ['MAP'] },
    ],
  },
];

// ── Build flat stat list for a given prefix ──────────────────────────────────
export function getStatsForPrefix(prefix) {
  const result = [];
  for (const group of STAT_GROUPS) {
    for (const stat of group.stats) {
      const validPrefixes = stat.prefixes || ['SOURCE', 'TARGET'];
      if (validPrefixes.includes(prefix)) {
        result.push({
          key: `${prefix}${stat.suffix}`,
          label: stat.label,
          group: group.label,
          groupId: group.id,
        });
      }
    }
  }
  return result;
}

// ── Grouped stats for a given prefix (for the builder dropdown) ──────────────
export function getStatGroupsForPrefix(prefix) {
  const result = [];
  for (const group of STAT_GROUPS) {
    const stats = group.stats
      .filter((s) => (s.prefixes || ['SOURCE', 'TARGET']).includes(prefix))
      .map((s) => ({ key: `${prefix}${s.suffix}`, label: s.label }));
    if (stats.length > 0) result.push({ label: group.label, stats });
  }
  return result;
}

// Legacy exports for backward compat with StatBlockBuilder
export const STAT_BLOCK_GROUPS = getStatGroupsForPrefix('SOURCE');
export const ALL_STAT_BLOCK_STATS = getStatsForPrefix('SOURCE');

// ── Random variables ─────────────────────────────────────────────────────────
export const RAND_VARIABLES = [
  { key: 'RAND_5', label: 'RAND_5', max: 5 },
  { key: 'RAND_10', label: 'RAND_10', max: 10 },
  { key: 'RAND_100', label: 'RAND_100', max: 100 },
  { key: 'RAND_1000', label: 'RAND_1000', max: 1000 },
];

// ── Weapon variables ─────────────────────────────────────────────────────────
export const WEAPON_VARIABLES = [
  { key: 'SOURCEWEAPONSMALLDAMAGE', label: 'Weapon Small Damage' },
  { key: 'SOURCEWEAPONLARGEDAMAGE', label: 'Weapon Large Damage' },
];

// ── Static bindings ──────────────────────────────────────────────────────────
export const STATIC_VARIABLES = [
  { key: 'DAMAGE', label: 'Current Damage (reactive/incoming formulas)' },
];

// ── Server gap variables (wired but no properties tagged) ────────────────────
// CASTABLE* and ITEM* prefixes exist in FormulaParser.cs but no C# classes
// have [FormulaVariable] properties. These silently produce nothing at runtime.
export const SERVER_GAP_PREFIXES = ['CASTABLE', 'ITEM'];
