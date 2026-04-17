/**
 * NCalc → Lua formula transpiler.
 *
 * Converts NCalc expression strings (used by Hybrasyl's FormulaParser) into
 * pure Lua functions that script authors can require("formulas") and call.
 *
 * Token mapping is derived from [FormulaVariable]-annotated C# properties
 * in the server codebase (StatInfo, Creature, MapObject).
 */

// --- Token maps (from [FormulaVariable] grep of server source) ---

// Properties on Creature — routed to source.{Prop}, NOT source.Stats.{Prop}
const CREATURE_PROPS = new Set([
  'WeaponSmallDamage',
  'WeaponLargeDamage',
])

// Properties on MapObject — routed to map.{Prop}
const MAP_PROPS = new Set([
  'X', 'Y', 'Tiles', 'BaseLevel',
])

// All StatInfo [FormulaVariable] property names (uppercased for matching)
// Everything not in CREATURE_PROPS or MAP_PROPS that appears after a
// SOURCE/TARGET/ORIGINALCASTER prefix is assumed to be a StatInfo property.
// We keep a complete set for validation, but the transpiler falls through
// to Stats.{Prop} for any unrecognized SOURCE/TARGET token.
const STAT_INFO_PROPS = new Set([
  'Level', 'Experience', 'Faith', 'Gold', 'Ability', 'AbilityExp',
  'BaseHp', 'BonusHp', 'Hp', 'BaseMp', 'BonusMp', 'Mp',
  'BaseStr', 'BonusStr', 'BaseInt', 'BonusInt', 'BaseWis', 'BonusWis',
  'BaseCon', 'BonusCon', 'BaseDex', 'BonusDex',
  'BaseCrit', 'BonusCrit', 'Crit', 'BaseMagicCrit', 'BonusMagicCrit', 'MagicCrit',
  'BaseDmg', 'BonusDmg', 'BaseHit', 'BonusHit',
  'BaseAc', 'BonusAc', 'BaseMr', 'BonusMr',
  'BaseRegen', 'BonusRegen',
  'BonusInboundDamageModifier', 'InboundDamageModifier',
  'BaseInboundHealModifier', 'BonusInboundHealModifier',
  'BonusOutboundDamageModifier', 'OutboundDamageModifier',
  'BaseOutboundHealModifier', 'BonusOutboundHealModifier', 'OutboundHealModifier',
  'BaseReflectMagical', 'BonusReflectMagical', 'ReflectMagical',
  'BaseReflectPhysical', 'BonusReflectPhysical', 'ReflectPhysical',
  'BaseExtraGold', 'BonusExtraGold', 'ExtraGold',
  'BaseDodge', 'BonusDodge', 'Dodge',
  'BaseMagicDodge', 'BonusMagicDodge', 'MagicDodge',
  'BaseExtraXp', 'BonusExtraXp', 'ExtraXp',
  'BaseExtraItemFind', 'BonusExtraItemFind', 'ExtraItemFind',
  'BaseExtraFaith', 'BonusExtraFaith', 'ExtraFaith',
  'BaseLifeSteal', 'BonusLifeSteal', 'LifeSteal',
  'BaseManaSteal', 'BonusManaSteal', 'ManaSteal',
  'BaseInboundDamageToMp', 'BonusInboundDamageToMp', 'InboundDamageToMp',
  'Shield',
  'MaximumHp', 'MaximumMp',
  'Str', 'Int', 'Wis', 'Con', 'Dex',
  'Ac', 'Hit', 'Mr', 'Regen', 'Dmg',
])

// Build a case-insensitive lookup: UPPERCASED name → original cased name
const STAT_LOOKUP = new Map()
for (const p of STAT_INFO_PROPS) STAT_LOOKUP.set(p.toUpperCase(), p)

const CREATURE_LOOKUP = new Map()
for (const p of CREATURE_PROPS) CREATURE_LOOKUP.set(p.toUpperCase(), p)

const MAP_LOOKUP = new Map()
for (const p of MAP_PROPS) MAP_LOOKUP.set(p.toUpperCase(), p)

// --- Transpile a single NCalc expression string to Lua ---

export function transpileFormula(ncalc) {
  if (!ncalc || !ncalc.trim()) return "''"
  let lua = ncalc

  // 1. Replace NCalc functions with Lua math equivalents
  lua = lua.replace(/\bMAX\s*\(/gi, 'math.max(')
  lua = lua.replace(/\bMIN\s*\(/gi, 'math.min(')
  lua = lua.replace(/\bABS\s*\(/gi, 'math.abs(')
  lua = lua.replace(/\bSQRT\s*\(/gi, 'math.sqrt(')
  lua = lua.replace(/\bFLOOR\s*\(/gi, 'math.floor(')
  lua = lua.replace(/\bCEILING\s*\(/gi, 'math.ceil(')
  lua = lua.replace(/\bROUND\s*\(/gi, 'math.floor(0.5 + ')
  lua = lua.replace(/\bPOW\s*\(/gi, 'math.pow(')

  // 2. Replace static random tokens
  lua = lua.replace(/\bRANDDOUBLE\b/g, 'math.random()')
  lua = lua.replace(/\bRAND_(\d+)\b/g, (_, n) => `math.random(0, ${n})`)

  // 3. Replace DAMAGE token
  lua = lua.replace(/\bDAMAGE\b/g, 'damage')

  // 4. Replace prefixed tokens: SOURCE, TARGET, ORIGINALCASTER, MAP, CASTABLE, ITEM
  //    Must process longer prefixes first to avoid partial matches.
  lua = replacePrefixedTokens(lua, 'ORIGINALCASTER', 'originalCaster')
  lua = replacePrefixedTokens(lua, 'SOURCE', 'source')
  lua = replacePrefixedTokens(lua, 'TARGET', 'target')
  lua = replaceSimplePrefixedTokens(lua, 'MAP', 'map', MAP_LOOKUP)
  lua = replaceSimplePrefixedTokens(lua, 'CASTABLE', 'castable', new Map())
  lua = replaceSimplePrefixedTokens(lua, 'ITEM', 'item', new Map())

  return lua
}

/**
 * Replace tokens with SOURCE/TARGET/ORIGINALCASTER prefix.
 * These can resolve to either Creature props (direct) or StatInfo props (.Stats.).
 */
function replacePrefixedTokens(lua, prefix, luaVar) {
  const re = new RegExp(`\\b${prefix}([A-Z][A-Z0-9_]*)\\b`, 'g')
  return lua.replace(re, (_, propUpper) => {
    // Check Creature props first (direct on the object)
    if (CREATURE_LOOKUP.has(propUpper)) {
      return `${luaVar}.${CREATURE_LOOKUP.get(propUpper)}`
    }
    // Otherwise it's a StatInfo prop (through .Stats)
    const statName = STAT_LOOKUP.get(propUpper)
    if (statName) {
      return `${luaVar}.Stats.${statName}`
    }
    // Unknown — fall through to Stats with best-guess casing
    return `${luaVar}.Stats.${titleCase(propUpper)}`
  })
}

/**
 * Replace tokens with a simple prefix (MAP, CASTABLE, ITEM) that route
 * directly to object properties without a Stats intermediary.
 */
function replaceSimplePrefixedTokens(lua, prefix, luaVar, lookup) {
  const re = new RegExp(`\\b${prefix}([A-Z][A-Z0-9_]*)\\b`, 'g')
  return lua.replace(re, (_, propUpper) => {
    const name = lookup.get(propUpper)
    return `${luaVar}.${name || titleCase(propUpper)}`
  })
}

/** UPPERCASENAME → Uppercasename (naive title-case for unknown tokens) */
function titleCase(upper) {
  return upper.charAt(0) + upper.slice(1).toLowerCase()
}

// --- Generate the complete formulas.lua file ---

/**
 * Sanitize a formula name into a valid Lua identifier.
 * Lowercases, replaces spaces/hyphens with underscores, strips non-alphanum.
 */
function toLuaName(name) {
  return name
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^(\d)/, '_$1') // can't start with digit
    || 'unnamed'
}

/**
 * Generate a complete formulas.lua file from an array of formula objects.
 * Each formula object has: { id, name, category, formula, description? }
 */
export function generateFormulasLua(formulas) {
  if (!formulas || formulas.length === 0) {
    return [
      '-- Auto-generated by Creidhne from world/.creidhne/formulas.json',
      '-- No formulas defined yet.',
      '',
      'local formulas = {}',
      '',
      'return formulas',
      '',
    ].join('\n')
  }

  const lines = [
    '-- Auto-generated by Creidhne from world/.creidhne/formulas.json',
    '-- Do not edit manually — changes will be overwritten on next formula save.',
    '',
    'local formulas = {}',
  ]

  // Track names for collision avoidance
  const usedNames = new Map()

  for (const f of formulas) {
    if (!f.formula || !f.name) continue

    let luaName = toLuaName(f.name)

    // Handle collisions
    if (usedNames.has(luaName)) {
      let counter = usedNames.get(luaName) + 1
      usedNames.set(luaName, counter)
      luaName = `${luaName}_${counter}`
    } else {
      usedNames.set(luaName, 1)
    }

    const luaExpr = transpileFormula(f.formula)

    lines.push('')
    lines.push(`---${f.name}${f.category ? ' (' + f.category + ')' : ''}`)
    if (f.description) lines.push(`---${f.description}`)
    lines.push(`---NCalc: ${f.formula}`)
    lines.push(`function formulas.${luaName}(source, target, castable, map, item, damage)`)
    lines.push(`    return ${luaExpr}`)
    lines.push('end')
  }

  lines.push('')
  lines.push('return formulas')
  lines.push('')

  return lines.join('\n')
}
