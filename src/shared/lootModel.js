// The editor model of a loot table (HTOO-522).
//
// A <LootSet> holds one or more <Table>s, and a <Table> holds any number of
// <Items> lists, a <Gold> and an <Xp>. A creature's or a spawn group's <Loot>
// can hold the same <Table>s inline, plus a <Gold> and an Xp attribute. Every
// value stays the string the file holds, so a save with no edit writes back
// what it read; '' is an attribute the file does not have.
//
// The parser read the first <Table> and its first <Items> before, and a save
// deleted the rest. The Mileth Crypt sets in ceridwen give each item its own
// table, so a save kept one item of twenty.

export const emptyLootEntry = () => ({
  name: '',
  variants: [],
  unique: false,
  always: false,
  inInventory: false,
  max: ''
})

export const emptyItemsList = () => ({ rolls: '', chance: '', entries: [] })

export const emptyLootTable = () => ({
  rolls: '',
  chance: '',
  inInventory: false,
  gold: { min: '', max: '' },
  xp: { min: '', max: '' },
  lists: [emptyItemsList()]
})

/**
 * A short description of a <Loot>'s inline part (`lootInline`), for the notice
 * the creature and spawn group editors show. Returns '' when there is none.
 */
export function describeInlineLoot(inline) {
  if (!inline) return ''
  const parts = []
  const n = inline.tables?.length ?? 0
  if (n) parts.push(`${n} inline loot table${n === 1 ? '' : 's'}`)
  if (inline.gold) parts.push('a Gold element')
  if (inline.xp) parts.push(`Xp="${inline.xp}"`)
  if (parts.length < 2) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}
