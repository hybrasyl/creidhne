import { describe, it, expect } from 'vitest'
import xml2js from 'xml2js'
import { parseLootXml, serializeLootXml } from '../lootXml.js'
import { parseCreatureXml, serializeCreatureXml } from '../creatureXml.js'
import { parseSpawngroupXml, serializeSpawngroupXml } from '../spawngroupXml.js'
import { describeInlineLoot } from '../../shared/lootModel.js'

// HTOO-522: a save with no edit must write back every loot element the XSD
// allows. The parsers read the first <Table> and its first <Items> of a loot
// set, and only the <Set>s of a creature's or spawn group's <Loot>; a save
// deleted the rest. The Mileth Crypt sets in ceridwen give each item its own
// table, so a save kept one item of twenty, and nothing said so.
//
// The check compares the <LootSet> and <Loot> trees before and after, not
// the text, because the serializer normalizes layout and drops an attribute
// that is at its default ("false"). That is not a loss, so the comparison
// drops it too. Measured against ceridwen and world (1028 files, `.ignore/`
// included): with this comparison, every file the XSD allows keeps its loot.

const NS = 'xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02"'

const LOOTSET = `<?xml version="1.0"?>
<LootSet ${NS} Name="Crypt Chest">
  <Table Rolls="1" Chance="0.5">
    <Items Rolls="2" Chance="0.25">
      <Item Max="1">Bone</Item>
      <Item Variants="Rusty Fine">Dagger</Item>
    </Items>
    <Items>
      <Item Always="true">Dust</Item>
    </Items>
    <Gold Min="1" Max="20"/>
    <Xp Min="5" Max="10"/>
  </Table>
  <Table Rolls="1" Chance="0.05" InInventory="true">
    <Items>
      <Item Unique="true">Crypt Key</Item>
    </Items>
  </Table>
  <Table Chance="0.01">
    <Items>
      <Item>Rare Ring</Item>
    </Items>
  </Table>
</LootSet>`

const INLINE_LOOT = `<Loot Xp="500">
    <Set Name="Crypt Chest" Rolls="1" Chance="0.25"/>
    <Table Rolls="2" Chance="0.2">
      <Items Rolls="1" Chance="0.5">
        <Item>Spider Leg</Item>
        <Item Max="2">Spider Egg</Item>
      </Items>
      <Gold Min="0" Max="75"/>
    </Table>
    <Table>
      <Items>
        <Item>Silk</Item>
      </Items>
    </Table>
    <Gold Min="10" Max="40"/>
  </Loot>`

const CREATURE = `<?xml version="1.0"?>
<Creature ${NS} Name="Spider" Sprite="10">
  ${INLINE_LOOT}
  <Types>
    <Type Name="Great Spider" Sprite="11">
      <Loot Xp="900">
        <Table>
          <Items>
            <Item>Great Silk</Item>
          </Items>
        </Table>
      </Loot>
    </Type>
  </Types>
</Creature>`

const SPAWNGROUP = `<?xml version="1.0"?>
<SpawnGroup ${NS} Name="Crypt 1">
  <Spawns>
    <Spawn Name="Spider">
      ${INLINE_LOOT}
    </Spawn>
  </Spawns>
  <Loot>
    <Table Rolls="1">
      <Items>
        <Item>Candle</Item>
      </Items>
    </Table>
  </Loot>
</SpawnGroup>`

const tree = (xml) =>
  new Promise((res, rej) =>
    xml2js.parseString(xml, { trim: true }, (e, r) => (e ? rej(e) : res(r)))
  )

// The serializer writes a bare-string Item when it has no attributes and
// drops a boolean at its default; neither is a loss. Keys are sorted, because
// xml2js groups children by name and the order of the groups is the XSD's.
function canon(n, parent = '') {
  if (Array.isArray(n)) return n.map((c) => canon(c, parent))
  if (typeof n === 'string') return parent === 'Item' ? { _: n } : n
  if (!n || typeof n !== 'object') return n
  const out = {}
  for (const k of Object.keys(n).sort()) {
    if (k === '$') {
      const attrs = Object.fromEntries(
        Object.entries(n.$).filter(([ak, av]) => ak !== 'xmlns' && av !== 'false')
      )
      if (Object.keys(attrs).length) out.$ = attrs
    } else out[k] = canon(n[k], k)
  }
  return out
}

/** Every <LootSet> and <Loot> subtree, by path, in canonical form. */
function lootTrees(t) {
  const out = []
  const visit = (n, path) => {
    if (Array.isArray(n)) return n.forEach((c, i) => visit(c, `${path}[${i}]`))
    if (!n || typeof n !== 'object') return
    for (const [k, v] of Object.entries(n)) {
      if (k === '$' || k === '_') continue
      if (k === 'Loot' || k === 'LootSet') out.push([`${path}/${k}`, canon(v, k)])
      else visit(v, `${path}/${k}`)
    }
  }
  visit(t, '')
  return out
}

const CASES = [
  ['loot set', LOOTSET, parseLootXml, serializeLootXml, 1],
  ['creature', CREATURE, parseCreatureXml, serializeCreatureXml, 2],
  ['spawn group', SPAWNGROUP, parseSpawngroupXml, serializeSpawngroupXml, 2]
]

describe('a save with no edit keeps every loot element', () => {
  it.each(CASES)('%s', async (_label, xml, parse, serialize, count) => {
    const before = lootTrees(await tree(xml))
    // Guard the guard: a walk that found nothing would compare [] with [].
    expect(before).toHaveLength(count)
    const after = lootTrees(await tree(serialize(await parse(xml))))
    expect(after).toEqual(before)
  })

  it('a second save is the same text as the first', async () => {
    for (const [, xml, parse, serialize] of CASES) {
      const once = serialize(await parse(xml))
      expect(serialize(await parse(once))).toBe(once)
    }
  })
})

describe('the loot set model holds every table and list', () => {
  it('reads three tables, and two Items lists in the first', async () => {
    const loot = await parseLootXml(LOOTSET)
    expect(loot.tables).toHaveLength(3)
    expect(loot.tables[0].lists).toHaveLength(2)
    expect(loot.tables[0].lists[1].entries[0]).toMatchObject({ name: 'Dust', always: true })
    expect(loot.tables[1]).toMatchObject({ chance: '0.05', inInventory: true })
    expect(loot.tables[2].lists[0].entries[0].name).toBe('Rare Ring')
  })

  it('an edit to one table leaves the others as they were', async () => {
    const loot = await parseLootXml(LOOTSET)
    loot.tables[2].lists[0].entries[0].name = 'Rarer Ring'
    const out = await tree(serializeLootXml(loot))
    expect(out.LootSet.Table).toHaveLength(3)
    expect(out.LootSet.Table[0].Items).toHaveLength(2)
    expect(out.LootSet.Table[2].Items[0].Item).toEqual(['Rarer Ring'])
  })

  it('a removed table and a blank list are not written', async () => {
    const loot = await parseLootXml(LOOTSET)
    loot.tables.splice(1, 1)
    loot.tables[0].lists.push({ rolls: '', chance: '', entries: [] })
    const out = await tree(serializeLootXml(loot))
    expect(out.LootSet.Table).toHaveLength(2)
    // An <Items/> with no <Item> fails the XSD, so the blank list is left out.
    expect(out.LootSet.Table[0].Items).toHaveLength(2)
  })
})

describe('creature and spawn group inline loot', () => {
  it('keeps the inline part beside the sets the editor shows', async () => {
    const c = await parseCreatureXml(CREATURE)
    expect(c.loot).toEqual([{ name: 'Crypt Chest', rolls: '1', chance: '0.25' }])
    expect(c.lootInline.tables).toHaveLength(2)
    expect(c.lootInline.gold).toEqual({ min: '10', max: '40' })
    expect(c.lootInline.xp).toBe('500')
    expect(c.subtypes[0].lootInline).toMatchObject({ xp: '900', gold: null })
  })

  it('an edit to the sets keeps the inline part', async () => {
    const c = await parseCreatureXml(CREATURE)
    c.loot = [...c.loot, { name: 'Spider Parts', rolls: '', chance: '' }]
    const out = await tree(serializeCreatureXml(c))
    const loot = out.Creature.Loot[0]
    expect(loot.Set.map((s) => s.$.Name)).toEqual(['Crypt Chest', 'Spider Parts'])
    expect(loot.Table).toHaveLength(2)
    expect(loot.$.Xp).toBe('500')
  })

  it('a creature with no loot has no inline part and writes no <Loot>', async () => {
    const xml = `<?xml version="1.0"?>\n<Creature ${NS} Name="Slime" Sprite="1"/>`
    const c = await parseCreatureXml(xml)
    expect(c.lootInline).toBeNull()
    expect((await tree(serializeCreatureXml(c))).Creature.Loot).toBeUndefined()
  })

  it('the editor notice names what the file holds', async () => {
    const c = await parseCreatureXml(CREATURE)
    expect(describeInlineLoot(c.lootInline)).toBe(
      '2 inline loot tables, a Gold element and Xp="500"'
    )
    expect(describeInlineLoot(c.subtypes[0].lootInline)).toBe('1 inline loot table and Xp="900"')
    expect(describeInlineLoot(null)).toBe('')
  })
})
