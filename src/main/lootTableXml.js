// The <Table> and <Loot> mapping that lootXml, creatureXml and spawngroupXml
// share (HTOO-522). See src/shared/lootModel.js for the model.
//
// The rule is that a save writes back every loot element it read. Each mapper
// here has a builder that is its inverse, and lootRoundTrip.test.js compares
// the <Loot> and <LootSet> trees before and after a save with no edit.

const first = (arr, def = undefined) => (Array.isArray(arr) && arr.length ? arr[0] : def)
const a = (node, key, def = '') => node?.$?.[key] ?? def
const omitEmpty = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  )

// ── <Table> ───────────────────────────────────────────────────────────────────

function mapItemsList(items) {
  return {
    rolls: a(items, 'Rolls', ''),
    chance: a(items, 'Chance', ''),
    entries: (items?.Item || []).map((item) => ({
      name: typeof item === 'string' ? item : item._ || '',
      variants: a(item, 'Variants', '').split(' ').filter(Boolean),
      unique: a(item, 'Unique', 'false') === 'true',
      always: a(item, 'Always', 'false') === 'true',
      inInventory: a(item, 'InInventory', 'false') === 'true',
      max: a(item, 'Max', '')
    }))
  }
}

export function mapLootTable(table) {
  const gold = first(table?.Gold)
  const xp = first(table?.Xp)
  return {
    rolls: a(table, 'Rolls', ''),
    chance: a(table, 'Chance', ''),
    inInventory: a(table, 'InInventory', 'false') === 'true',
    gold: { min: a(gold, 'Min', ''), max: a(gold, 'Max', '') },
    xp: { min: a(xp, 'Min', ''), max: a(xp, 'Max', '') },
    lists: (table?.Items || []).map(mapItemsList)
  }
}

function buildItemsList(list) {
  const node = { $: omitEmpty({ Rolls: list.rolls, Chance: list.chance }) }
  node.Item = list.entries.map((entry) => {
    const itemAttrs = omitEmpty({
      Max: entry.max,
      Variants: entry.variants.length ? entry.variants.join(' ') : undefined
    })
    if (entry.unique) itemAttrs.Unique = 'true'
    if (entry.always) itemAttrs.Always = 'true'
    if (entry.inInventory) itemAttrs.InInventory = 'true'
    return { _: entry.name, $: itemAttrs }
  })
  return node
}

export function buildLootTable(table) {
  const attrs = omitEmpty({ Rolls: table.rolls, Chance: table.chance })
  if (table.inInventory) attrs.InInventory = 'true'
  const node = { $: attrs }

  // A list with no items and no attributes is a blank the editor added and the
  // author never filled. Writing it would give an <Items/> the XSD refuses.
  const lists = (table.lists || []).filter((l) => l.entries.length || l.rolls || l.chance)
  if (lists.length) node.Items = lists.map(buildItemsList)

  // xml2js writes keys in insertion order, and the XSD sequence is Items, Gold, Xp.
  if (table.gold.min || table.gold.max) {
    node.Gold = [{ $: omitEmpty({ Min: table.gold.min, Max: table.gold.max }) }]
  }
  if (table.xp.min || table.xp.max) {
    node.Xp = [{ $: omitEmpty({ Min: table.xp.min, Max: table.xp.max }) }]
  }
  return node
}

// ── <Loot> (a creature's, a creature type's, a spawn group's, a spawn's) ─────

/** The <Set> imports: the part of a <Loot> the editors show. */
export function mapLootSets(lootNode) {
  return (lootNode?.Set || []).map((s) => ({
    name: a(s, 'Name', ''),
    rolls: a(s, 'Rolls', ''),
    chance: a(s, 'Chance', '')
  }))
}

/**
 * Everything else in a <Loot>: inline <Table>s, a <Gold> and the Xp attribute,
 * or null when there is none. Loot is managed through named loot sets, so the
 * editors show this as a notice and a save writes it back unchanged.
 */
export function mapLootInline(lootNode) {
  if (!lootNode) return null
  const tables = (lootNode.Table || []).map(mapLootTable)
  const goldNode = first(lootNode.Gold)
  const gold = goldNode ? { min: a(goldNode, 'Min', ''), max: a(goldNode, 'Max', '') } : null
  const xp = a(lootNode, 'Xp', '')
  if (!tables.length && !gold && !xp) return null
  return { tables, gold, xp }
}

/** The <Loot> element for a set list and an inline part, or undefined for none. */
export function buildLootList(sets, inline) {
  const node = {}
  if (inline?.xp) node.$ = { Xp: inline.xp }
  if (sets?.length) {
    node.Set = sets.map((s) => ({
      $: omitEmpty({ Name: s.name, Rolls: s.rolls, Chance: s.chance })
    }))
  }
  if (inline?.tables?.length) node.Table = inline.tables.map(buildLootTable)
  if (inline?.gold) node.Gold = [{ $: omitEmpty({ Min: inline.gold.min, Max: inline.gold.max }) }]
  return Object.keys(node).length ? [node] : undefined
}
