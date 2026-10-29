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
const CREATURE_PROPS = new Set(['WeaponSmallDamage', 'WeaponLargeDamage'])

// Properties on MapObject — routed to map.{Prop}
const MAP_PROPS = new Set(['X', 'Y', 'Tiles', 'BaseLevel'])

// All StatInfo [FormulaVariable] property names (uppercased for matching)
// Everything not in CREATURE_PROPS or MAP_PROPS that appears after a
// SOURCE/TARGET/ORIGINALCASTER prefix is assumed to be a StatInfo property.
// We keep a complete set for validation, but the transpiler falls through
// to Stats.{Prop} for any unrecognized SOURCE/TARGET token.
const STAT_INFO_PROPS = new Set([
  'Level',
  'Experience',
  'Faith',
  'Gold',
  'Ability',
  'AbilityExp',
  'BaseHp',
  'BonusHp',
  'Hp',
  'BaseMp',
  'BonusMp',
  'Mp',
  'BaseStr',
  'BonusStr',
  'BaseInt',
  'BonusInt',
  'BaseWis',
  'BonusWis',
  'BaseCon',
  'BonusCon',
  'BaseDex',
  'BonusDex',
  'BaseCrit',
  'BonusCrit',
  'Crit',
  'BaseMagicCrit',
  'BonusMagicCrit',
  'MagicCrit',
  'BaseDmg',
  'BonusDmg',
  'BaseHit',
  'BonusHit',
  'BaseAc',
  'BonusAc',
  'BaseMr',
  'BonusMr',
  'BaseRegen',
  'BonusRegen',
  'BonusInboundDamageModifier',
  'InboundDamageModifier',
  'BaseInboundHealModifier',
  'BonusInboundHealModifier',
  'BonusOutboundDamageModifier',
  'OutboundDamageModifier',
  'BaseOutboundHealModifier',
  'BonusOutboundHealModifier',
  'OutboundHealModifier',
  'BaseReflectMagical',
  'BonusReflectMagical',
  'ReflectMagical',
  'BaseReflectPhysical',
  'BonusReflectPhysical',
  'ReflectPhysical',
  'BaseExtraGold',
  'BonusExtraGold',
  'ExtraGold',
  'BaseDodge',
  'BonusDodge',
  'Dodge',
  'BaseMagicDodge',
  'BonusMagicDodge',
  'MagicDodge',
  'BaseExtraXp',
  'BonusExtraXp',
  'ExtraXp',
  'BaseExtraItemFind',
  'BonusExtraItemFind',
  'ExtraItemFind',
  'BaseExtraFaith',
  'BonusExtraFaith',
  'ExtraFaith',
  'BaseLifeSteal',
  'BonusLifeSteal',
  'LifeSteal',
  'BaseManaSteal',
  'BonusManaSteal',
  'ManaSteal',
  'BaseInboundDamageToMp',
  'BonusInboundDamageToMp',
  'InboundDamageToMp',
  'Shield',
  'MaximumHp',
  'MaximumMp',
  'Str',
  'Int',
  'Wis',
  'Con',
  'Dex',
  'Ac',
  'Hit',
  'Mr',
  'Regen',
  'Dmg'
])

// Build a case-insensitive lookup: UPPERCASED name → original cased name
const STAT_LOOKUP = new Map()
for (const p of STAT_INFO_PROPS) STAT_LOOKUP.set(p.toUpperCase(), p)

const CREATURE_LOOKUP = new Map()
for (const p of CREATURE_PROPS) CREATURE_LOOKUP.set(p.toUpperCase(), p)

const MAP_LOOKUP = new Map()
for (const p of MAP_PROPS) MAP_LOOKUP.set(p.toUpperCase(), p)

// --- Transpile a single NCalc expression string to Lua ---

/** An NCalc expression that has no faithful Lua form. */
export class TranspileError extends Error {
  constructor(message) {
    super(message)
    this.name = 'TranspileError'
  }
}

// The server fixes each of these once per evaluation (FormulaParser.Parameterize),
// so `RAND_10 - RAND_10` is always 0 there. Each becomes one local per call.
const RANDOM_TOKEN_RE = /\b(RAND_\d+|RANDDOUBLE)\b/g

/**
 * The random tokens an NCalc expression uses, in first-use order, each with
 * the Lua that draws it the way the server does (Random.Shared.Next(0, n + 1)
 * is 0..n inclusive; NextDouble is [0, 1)).
 */
export function randomLocals(ncalc) {
  const seen = new Map()
  for (const [, token] of (ncalc || '').matchAll(RANDOM_TOKEN_RE)) {
    if (seen.has(token)) continue
    seen.set(
      token,
      token === 'RANDDOUBLE' ? 'math.random()' : `math.random(0, ${token.slice('RAND_'.length)})`
    )
  }
  return [...seen].map(([name, draw]) => ({ name, draw }))
}

/**
 * Transpile an NCalc expression to a Lua expression.
 *
 * Follows NCalcSync 6.3.1 as the server runs it (HTOO-578): `**` is the power
 * (Lua `^`), and `^` is bitwise XOR, which has no Lua 5.2 operator, so it
 * throws a TranspileError rather than turn into a power. `Round(x, digits)`
 * rounds half away from zero through `ncalc_round`; `math.floor(0.5 + x)`
 * dropped the digits and rounded -2.5 to -2. Random tokens stay as names: the
 * function that holds the expression draws each once (see randomLocals).
 */
export function transpileFormula(ncalc) {
  if (!ncalc || !ncalc.trim()) return "''"
  if (/\^/.test(ncalc)) {
    throw new TranspileError('"^" is bitwise XOR in NCalc, and Lua has no such operator here')
  }
  let lua = ncalc

  // 1. Operators: power, and NCalc's two spellings of "not equal"
  lua = lua.replace(/\*\*/g, '^')
  lua = lua.replace(/!=|<>/g, '~=')

  // 2. Replace NCalc functions with Lua equivalents. `if` is a Lua keyword,
  //    so it becomes a helper; the helpers are defined at the top of the file.
  lua = lua.replace(/\bMAX\s*\(/gi, 'math.max(')
  lua = lua.replace(/\bMIN\s*\(/gi, 'math.min(')
  lua = lua.replace(/\bABS\s*\(/gi, 'math.abs(')
  lua = lua.replace(/\bSQRT\s*\(/gi, 'math.sqrt(')
  lua = lua.replace(/\bFLOOR\s*\(/gi, 'math.floor(')
  lua = lua.replace(/\bCEILING\s*\(/gi, 'math.ceil(')
  lua = lua.replace(/\bROUND\s*\(/gi, 'ncalc_round(')
  lua = lua.replace(/\bTRUNCATE\s*\(/gi, 'ncalc_truncate(')
  lua = lua.replace(/\bSIGN\s*\(/gi, 'ncalc_sign(')
  lua = lua.replace(/\bPOW\s*\(/gi, 'math.pow(')
  lua = lua.replace(/\bIF\s*\(/gi, 'ncalc_if(')

  // 3. Replace DAMAGE token
  lua = lua.replace(/\bDAMAGE\b/g, 'damage')

  // 4. Replace prefixed tokens: SOURCE, TARGET, ORIGINALCASTER, MAP, CASTABLE, ITEM
  //    Must process longer prefixes first to avoid partial matches.
  lua = replaceOriginalCasterTokens(lua)
  lua = replacePrefixedTokens(lua, 'SOURCE', 'source')
  lua = replacePrefixedTokens(lua, 'TARGET', 'target')
  lua = replaceSimplePrefixedTokens(lua, 'MAP', 'map', MAP_LOOKUP)
  lua = replaceSimplePrefixedTokens(lua, 'CASTABLE', 'castable', new Map())
  lua = replaceSimplePrefixedTokens(lua, 'ITEM', 'item', new Map())

  return lua
}

/**
 * ORIGINALCASTER tokens. The server reads them off a StatInfo directly
 * (FormulaEvaluation.OriginalCaster), not off a creature's `.Stats`, and only
 * StatInfo properties are defined for it.
 */
function replaceOriginalCasterTokens(lua) {
  return lua.replace(/\bORIGINALCASTER([A-Z][A-Z0-9_]*)\b/g, (_, propUpper) => {
    return `originalCaster.${STAT_LOOKUP.get(propUpper) || titleCase(propUpper)}`
  })
}

/**
 * Replace tokens with SOURCE/TARGET prefix.
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

// NCalc functions with no Lua 5.2 equivalent (MoonSharp 2.0.0 is Lua 5.2).
// ncalc_round is .NET's Math.Round(x, digits, MidpointRounding.AwayFromZero),
// the server's RoundAwayFromZero. ncalc_if takes a number or a boolean, as
// NCalc's if() does; unlike NCalc, it evaluates both branches.
const NCALC_HELPERS = [
  'local function ncalc_round(x, digits)',
  '    local p = 10 ^ digits',
  '    local scaled = x * p',
  '    local whole = scaled >= 0 and math.floor(scaled) or math.ceil(scaled)',
  '    local fraction = scaled - whole',
  '    if fraction >= 0.5 then whole = whole + 1 elseif fraction <= -0.5 then whole = whole - 1 end',
  '    return whole / p',
  'end',
  '',
  'local function ncalc_truncate(x)',
  '    if x >= 0 then return math.floor(x) end',
  '    return math.ceil(x)',
  'end',
  '',
  'local function ncalc_sign(x)',
  '    if x > 0 then return 1 elseif x < 0 then return -1 end',
  '    return 0',
  'end',
  '',
  'local function ncalc_if(cond, a, b)',
  '    if cond and cond ~= 0 then return a end',
  '    return b',
  'end'
]

/** A Lua double-quoted string literal. */
function luaString(text) {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
}

/**
 * Sanitize a formula name into a valid Lua identifier.
 * Lowercases, replaces spaces/hyphens with underscores, strips non-alphanum.
 */
function toLuaName(name) {
  return (
    name
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/^(\d)/, '_$1') || // can't start with digit
    'unnamed'
  )
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
      ''
    ].join('\n')
  }

  const lines = [
    '-- Auto-generated by Creidhne from world/.creidhne/formulas.json',
    '-- Do not edit manually — changes will be overwritten on next formula save.',
    '',
    ...NCALC_HELPERS,
    '',
    'local formulas = {}'
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

    lines.push('')
    lines.push(`---${f.name}${f.category ? ' (' + f.category + ')' : ''}`)
    if (f.description) lines.push(`---${f.description}`)
    lines.push(`---NCalc: ${f.formula}`)
    // originalCaster is last, so a caller that passes the first six is unchanged.
    lines.push(
      `function formulas.${luaName}(source, target, castable, map, item, damage, originalCaster)`
    )
    try {
      const luaExpr = transpileFormula(f.formula)
      for (const { name, draw } of randomLocals(f.formula)) {
        lines.push(`    local ${name} = ${draw}`)
      }
      lines.push(`    return ${luaExpr}`)
    } catch (err) {
      if (!(err instanceof TranspileError)) throw err
      // The file still loads, and a call names the formula and the reason.
      lines.push(`    error(${luaString(`formulas.${luaName}: ${err.message}`)})`)
    }
    lines.push('end')
  }

  lines.push('')
  lines.push('return formulas')
  lines.push('')

  return lines.join('\n')
}
