// One canonical, flat, presentation-ready record per castable. Both CSV exports
// and the web JSON are column selections over this object, so a derivation is
// written once and cannot drift between them.
//
// Electron-free on purpose: WP2's report builder needs the derivations and the
// column catalogue in the renderer, and this module must stay importable there.
// Disk access lives in src/main/exportCastables.js.
//
// Some fields come in pairs (bookType/type, castCostSummary/castCost). That is
// deliberate: the balancing sheet and the website have different presentation
// needs for the same underlying value. They are two fields, not a drift.

export const ALL_CLASSES = ['Warrior', 'Wizard', 'Priest', 'Rogue', 'Monk', 'Peasant']

/** Balancing label: skills and spells only, anything else passes through. */
export function bookToType(book) {
  if (!book) return ''
  const b = book.toLowerCase()
  if (b.includes('skill')) return 'Skill'
  if (b.includes('spell')) return 'Spell'
  return book
}

/** Web label: distinguishes utility books, which the ability browser shows. */
export function deriveType(book) {
  switch (book) {
    case 'PrimarySkill':
    case 'SecondarySkill':
      return 'Skill'
    case 'PrimarySpell':
    case 'SecondarySpell':
      return 'Spell'
    case 'UtilitySkill':
      return 'Utility Skill'
    case 'UtilitySpell':
      return 'Utility Spell'
    default:
      return book
  }
}

/** The icon filename the website serves, derived from the book and icon id. */
export function deriveIcon(book, icon) {
  const isSpell = String(book || '').includes('Spell')
  return isSpell ? `spell${icon}.png` : `skill${icon}.png`
}

/** No class, or all six, both mean "anyone can learn this". */
export function deriveClass(cls) {
  if (!cls) return 'Universal'
  const words = cls.split(/\s+/).filter(Boolean)
  if (words.length === 0 || ALL_CLASSES.every((c) => words.includes(c))) return 'Universal'
  return cls
}

/** Learning cost, as the trainer would state it. */
export function formatMats(req) {
  if (!req) return 'No Cost'
  const parts = []
  if (req.gold) parts.push(`${req.gold} gold`)
  for (const item of req.items || []) {
    const qty = Number(item.quantity) > 1 ? `${item.quantity} ` : ''
    parts.push(`${qty}${item.itemName}`)
  }
  return parts.length > 0 ? parts.join(', ') : 'No Cost'
}

/** Balancing view of cast cost: raw values, fixed Hp/Mp/Gold/Item order. */
export function deriveCastCostSummary(castCosts) {
  const costs = castCosts || []
  const hp = costs.find((c) => c.type === 'Hp')
  const mp = costs.find((c) => c.type === 'Mp')
  const gold = costs.find((c) => c.type === 'Gold')
  const item = costs.find((c) => c.type === 'Item')
  return [
    hp?.value ? `${hp.value} HP` : null,
    mp?.value ? `${mp.value} MP` : null,
    gold?.value ? `${gold.value} Gold` : null,
    item?.itemName
      ? item.quantity > 1
        ? `${item.itemName} x${item.quantity}`
        : item.itemName
      : null
  ]
    .filter(Boolean)
    .join(', ')
}

/** Web view of cast cost: source-stat formulas rendered as readable percentages. */
export function formatCastCost(castCosts) {
  if (!castCosts || castCosts.length === 0) return ''
  return castCosts
    .map((cost) => {
      if (cost.type === 'Item') return `${cost.quantity || 1} ${cost.itemName}`
      const val = String(cost.value || '')
      const hpMatch = /SOURCEBASEHP\s*\*\s*([\d.]+)/.exec(val)
      const mpMatch = /SOURCEBASEMP\s*\*\s*([\d.]+)/.exec(val)
      const gldMatch = /SOURCEGOLD\s*\*\s*([\d.]+)/.exec(val)
      if (hpMatch) return `${Math.round(Number(hpMatch[1]) * 100)}% of Base Health`
      if (mpMatch) return `${Math.round(Number(mpMatch[1]) * 100)}% of Base Mana`
      if (gldMatch) return `${Math.round(Number(gldMatch[1]) * 100)}% of Gold`
      if (/^SOURCEBASEHP$/i.test(val)) return '100% of Base Health'
      if (/^SOURCEBASEMP$/i.test(val)) return '100% of Base Mana'
      if (/^SOURCEGOLD$/i.test(val)) return '100% of Gold'
      if (cost.type === 'Hp') return `${val} HP`
      if (cost.type === 'Mp') return `${val} Mana`
      if (cost.type === 'Gold') return `${val} Gold`
      return val
    })
    .join(', ')
}

/** A compact description of an intent's target shapes. */
export function deriveShape(crosses = [], squares = [], cones = [], lines = [], tiles = []) {
  const parts = []
  if (crosses.length) parts.push(`Cross(r=${crosses[0].radius ?? '?'})`)
  if (squares.length) parts.push(`Square(s=${squares[0].side ?? '?'})`)
  if (cones.length) parts.push(`Cone(r=${cones[0].radius ?? '?'})`)
  if (lines.length > 1) parts.push(`Line x${lines.length}`)
  else if (lines.length) parts.push(`Line(len=${lines[0].length ?? '?'})`)
  if (tiles.length > 1) parts.push(`Tile x${tiles.length}`)
  else if (tiles.length) parts.push('Tile')
  return parts.join(', ')
}

/**
 * Where a player learns this. Trainer names come from the world index, keyed by
 * lowercased castable name; a castable with no trainer but flagged as given by
 * a script is quest-awarded.
 */
export function deriveLocation(name, ctx = {}) {
  const trainers = ctx.castableTrainers?.[String(name || '').toLowerCase()] || []
  if (trainers.length > 0) return trainers.join(', ')
  return ctx.givenViaScript ? 'Awarded by a Quest' : ''
}

/** Builds the canonical record. `ctx` carries `castableTrainers` from the index. */
export function castableToRecord(castable, ctx = {}) {
  const meta = castable.meta || {}
  const req = castable.requirements?.[0] || null
  const descriptions = castable.descriptions || []
  const cats = castable.categories || []
  const intent = castable.intents?.[0] || {}
  const add = castable.statuses?.add || []
  const rem = castable.statuses?.remove || []

  const classLabel = deriveClass(castable.class)
  const location = deriveLocation(castable.name, {
    castableTrainers: ctx.castableTrainers,
    givenViaScript: meta.givenViaScript
  })

  return {
    // Identity and top-level attributes
    name: castable.name,
    description: descriptions[0]?.text ?? '',
    book: castable.book ?? '',
    bookType: bookToType(castable.book),
    type: deriveType(castable.book),
    // `icon` is the filename the website serves; `iconId` is the raw attribute
    // it derives from. The consumer's word for the filename is "icon", so that
    // is the name it gets — the web JSON keys off this directly.
    iconId: castable.icon ?? '',
    icon: deriveIcon(castable.book, castable.icon),
    elements: castable.elements ?? '',
    lines: castable.lines ?? '',
    cooldown: castable.cooldown ?? '',
    classRaw: castable.class ?? '',
    class: classLabel,
    subclass: meta.specialty || classLabel,
    specialty: meta.specialty ?? '',
    isAssail: castable.isAssail ?? false,
    deprecated: meta.deprecated ?? false,
    isTest: meta.isTest ?? false,
    isGM: meta.isGM ?? false,
    givenViaScript: meta.givenViaScript ?? false,
    location,

    // Categories, flattened to the six the balancing sheet carries
    category1: cats[0] ?? '',
    category2: cats[1] ?? '',
    category3: cats[2] ?? '',
    category4: cats[3] ?? '',
    category5: cats[4] ?? '',
    category6: cats[5] ?? '',

    // First intent
    intentUseType: intent.useType ?? '',
    intentShape: deriveShape(
      intent.crosses,
      intent.squares,
      intent.cones,
      intent.lines,
      intent.tiles
    ),
    intentTargets: intent.maxTargets ?? '',

    // First requirement, raw — blank when the castable has no <Requirement>
    reqClass: req?.class ?? '',
    reqLevelMin: req?.levelMin ?? '',
    reqStr: req?.str ?? '',
    reqInt: req?.int ?? '',
    reqWis: req?.wis ?? '',
    reqCon: req?.con ?? '',
    reqDex: req?.dex ?? '',

    // First requirement, defaulted to the minimums the website displays
    statStr: req?.str || '3',
    statInt: req?.int || '3',
    statWis: req?.wis || '3',
    statCon: req?.con || '3',
    statDex: req?.dex || '3',
    level: req?.levelMin || '1',
    mats: formatMats(req),

    // Cast cost, both views
    castCostSummary: deriveCastCostSummary(castable.castCosts),
    castCost: formatCastCost(castable.castCosts),

    // Heal and damage
    healType: castable.heal?.kind ?? '',
    healFormula: castable.heal?.formula ?? '',
    damageType: castable.damage?.type ?? '',
    damageFlags: (castable.damage?.flags || []).join(' '),
    damageFormula: castable.damage?.formula ?? '',

    // Statuses applied (three slots) and removed (four slots)
    statusAdd1Name: add[0]?.name ?? '',
    statusAdd1Duration: add[0]?.duration ?? '',
    statusAdd1Intensity: add[0]?.intensity ?? '',
    statusAdd1Tick: add[0]?.tick ?? '',
    statusAdd2Name: add[1]?.name ?? '',
    statusAdd2Duration: add[1]?.duration ?? '',
    statusAdd2Intensity: add[1]?.intensity ?? '',
    statusAdd2Tick: add[1]?.tick ?? '',
    statusAdd3Name: add[2]?.name ?? '',
    statusAdd3Duration: add[2]?.duration ?? '',
    statusAdd3Intensity: add[2]?.intensity ?? '',
    statusAdd3Tick: add[2]?.tick ?? '',

    statusRemove1Name: rem[0]?.name ?? '',
    statusRemove1IsCategory: rem[0]?.isCategory ?? false,
    statusRemove1Quantity: rem[0]?.quantity ?? '',
    statusRemove2Name: rem[1]?.name ?? '',
    statusRemove2IsCategory: rem[1]?.isCategory ?? false,
    statusRemove2Quantity: rem[1]?.quantity ?? '',
    statusRemove3Name: rem[2]?.name ?? '',
    statusRemove3IsCategory: rem[2]?.isCategory ?? false,
    statusRemove3Quantity: rem[2]?.quantity ?? '',
    statusRemove4Name: rem[3]?.name ?? '',
    statusRemove4IsCategory: rem[3]?.isCategory ?? false,
    statusRemove4Quantity: rem[3]?.quantity ?? '',

    // Everything the flat fields dropped, for WP2's report builder. No
    // serializer reads this — `recordsToCsv` and `recordsToJson` take an
    // explicit column list, so `raw` can never leak into an export by accident.
    raw: {
      categories: cats,
      castCosts: castable.castCosts || [],
      requirements: castable.requirements || [],
      intents: castable.intents || [],
      statuses: castable.statuses || { add: [], remove: [] },
      heal: castable.heal ?? null,
      damage: castable.damage ?? null,
      meta
    }
  }
}

/**
 * Every flat field a report can select, with a default label and a grouping.
 * WP2's column picker reads this; a test asserts it stays in step with what
 * `castableToRecord` actually produces.
 */
export const CASTABLE_COLUMNS = [
  { key: 'name', label: 'Name', group: 'Identity' },
  { key: 'description', label: 'Description', group: 'Identity' },
  { key: 'book', label: 'Book', group: 'Identity' },
  { key: 'bookType', label: 'Type (skill/spell)', group: 'Identity' },
  { key: 'type', label: 'Type', group: 'Identity' },
  { key: 'iconId', label: 'Icon id', group: 'Identity' },
  { key: 'icon', label: 'Icon', group: 'Identity' },
  { key: 'elements', label: 'Element', group: 'Identity' },
  { key: 'lines', label: 'Lines', group: 'Identity' },
  { key: 'cooldown', label: 'Cooldown', group: 'Identity' },
  { key: 'classRaw', label: 'Class (raw)', group: 'Identity' },
  { key: 'class', label: 'Class', group: 'Identity' },
  { key: 'subclass', label: 'Subclass', group: 'Identity' },
  { key: 'specialty', label: 'Specialty', group: 'Identity' },
  { key: 'isAssail', label: 'Is assail', group: 'Flags' },
  { key: 'deprecated', label: 'Deprecated', group: 'Flags' },
  { key: 'isTest', label: 'Is test', group: 'Flags' },
  { key: 'isGM', label: 'Is GM', group: 'Flags' },
  { key: 'givenViaScript', label: 'Given via script', group: 'Flags' },
  { key: 'location', label: 'Location', group: 'Learning' },
  { key: 'category1', label: 'Category 1', group: 'Categories' },
  { key: 'category2', label: 'Category 2', group: 'Categories' },
  { key: 'category3', label: 'Category 3', group: 'Categories' },
  { key: 'category4', label: 'Category 4', group: 'Categories' },
  { key: 'category5', label: 'Category 5', group: 'Categories' },
  { key: 'category6', label: 'Category 6', group: 'Categories' },
  { key: 'intentUseType', label: 'Intent use type', group: 'Intent' },
  { key: 'intentShape', label: 'Intent shape', group: 'Intent' },
  { key: 'intentTargets', label: 'Intent targets', group: 'Intent' },
  { key: 'reqClass', label: 'Req class', group: 'Requirements (raw)' },
  { key: 'reqLevelMin', label: 'Req level min', group: 'Requirements (raw)' },
  { key: 'reqStr', label: 'Req str', group: 'Requirements (raw)' },
  { key: 'reqInt', label: 'Req int', group: 'Requirements (raw)' },
  { key: 'reqWis', label: 'Req wis', group: 'Requirements (raw)' },
  { key: 'reqCon', label: 'Req con', group: 'Requirements (raw)' },
  { key: 'reqDex', label: 'Req dex', group: 'Requirements (raw)' },
  { key: 'statStr', label: 'Str', group: 'Requirements' },
  { key: 'statInt', label: 'Int', group: 'Requirements' },
  { key: 'statWis', label: 'Wis', group: 'Requirements' },
  { key: 'statCon', label: 'Con', group: 'Requirements' },
  { key: 'statDex', label: 'Dex', group: 'Requirements' },
  { key: 'level', label: 'Level', group: 'Requirements' },
  { key: 'mats', label: 'Mats', group: 'Learning' },
  { key: 'castCostSummary', label: 'Cast cost (raw)', group: 'Cast cost' },
  { key: 'castCost', label: 'Cast cost', group: 'Cast cost' },
  { key: 'healType', label: 'Heal type', group: 'Effects' },
  { key: 'healFormula', label: 'Heal formula', group: 'Effects' },
  { key: 'damageType', label: 'Damage type', group: 'Effects' },
  { key: 'damageFlags', label: 'Damage flags', group: 'Effects' },
  { key: 'damageFormula', label: 'Damage formula', group: 'Effects' },
  { key: 'statusAdd1Name', label: 'Status add 1', group: 'Statuses' },
  { key: 'statusAdd1Duration', label: 'Status add 1 duration', group: 'Statuses' },
  { key: 'statusAdd1Intensity', label: 'Status add 1 intensity', group: 'Statuses' },
  { key: 'statusAdd1Tick', label: 'Status add 1 tick', group: 'Statuses' },
  { key: 'statusAdd2Name', label: 'Status add 2', group: 'Statuses' },
  { key: 'statusAdd2Duration', label: 'Status add 2 duration', group: 'Statuses' },
  { key: 'statusAdd2Intensity', label: 'Status add 2 intensity', group: 'Statuses' },
  { key: 'statusAdd2Tick', label: 'Status add 2 tick', group: 'Statuses' },
  { key: 'statusAdd3Name', label: 'Status add 3', group: 'Statuses' },
  { key: 'statusAdd3Duration', label: 'Status add 3 duration', group: 'Statuses' },
  { key: 'statusAdd3Intensity', label: 'Status add 3 intensity', group: 'Statuses' },
  { key: 'statusAdd3Tick', label: 'Status add 3 tick', group: 'Statuses' },
  { key: 'statusRemove1Name', label: 'Status remove 1', group: 'Statuses' },
  { key: 'statusRemove1IsCategory', label: 'Status remove 1 is category', group: 'Statuses' },
  { key: 'statusRemove1Quantity', label: 'Status remove 1 quantity', group: 'Statuses' },
  { key: 'statusRemove2Name', label: 'Status remove 2', group: 'Statuses' },
  { key: 'statusRemove2IsCategory', label: 'Status remove 2 is category', group: 'Statuses' },
  { key: 'statusRemove2Quantity', label: 'Status remove 2 quantity', group: 'Statuses' },
  { key: 'statusRemove3Name', label: 'Status remove 3', group: 'Statuses' },
  { key: 'statusRemove3IsCategory', label: 'Status remove 3 is category', group: 'Statuses' },
  { key: 'statusRemove3Quantity', label: 'Status remove 3 quantity', group: 'Statuses' },
  { key: 'statusRemove4Name', label: 'Status remove 4', group: 'Statuses' },
  { key: 'statusRemove4IsCategory', label: 'Status remove 4 is category', group: 'Statuses' },
  { key: 'statusRemove4Quantity', label: 'Status remove 4 quantity', group: 'Statuses' }
]
