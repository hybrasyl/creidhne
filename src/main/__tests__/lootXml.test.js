import { describe, it, expect } from 'vitest'
import { parseLootXml, serializeLootXml } from '../lootXml.js'
import xml2js from 'xml2js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Each Item uses mixed content: text body (the name) plus attributes.
// unique and always default to 'true' when the attribute is absent.
// variants is a space-separated attribute; absent = empty array.

const FULL_XML = `<?xml version="1.0"?>
<!-- Comment: Test loot set -->
<LootSet xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="TestLoot">
  <Table Rolls="2" Chance="75">
    <Gold Min="10" Max="100" />
    <Xp Min="5" Max="50" />
    <Items Rolls="1" Chance="50">
      <Item Variants="Blessed Holy" Unique="false" Always="false" Max="3">Iron Sword</Item>
      <Item Unique="true" Always="true">Gold Coin</Item>
    </Items>
  </Table>
</LootSet>`

// Minimal: only Name and Table required; Table can have no children.
const MINIMAL_XML = `<?xml version="1.0"?>
<LootSet xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="EmptyLoot">
  <Table />
</LootSet>`

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function parseRaw(xmlString) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}

// ---------------------------------------------------------------------------
// Test 1: Parse round-trip
// ---------------------------------------------------------------------------

describe('Parse round-trip', () => {
  it('serializing a parsed loot set and re-parsing yields the same object', async () => {
    const first = await parseLootXml(FULL_XML)
    const xml = serializeLootXml(first)
    const second = await parseLootXml(xml)
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Field coverage — all fields
// ---------------------------------------------------------------------------

describe('Field coverage — all fields', () => {
  it('parses name attribute', async () => {
    const l = await parseLootXml(FULL_XML)
    expect(l.name).toBe('TestLoot')
  })

  it('parses comment', async () => {
    const l = await parseLootXml(FULL_XML)
    expect(l.comment).toBe('Test loot set')
  })

  it('parses table rolls and chance', async () => {
    const l = await parseLootXml(FULL_XML)
    expect(l.table.rolls).toBe('2')
    expect(l.table.chance).toBe('75')
  })

  it('parses gold min and max', async () => {
    const l = await parseLootXml(FULL_XML)
    expect(l.table.gold.min).toBe('10')
    expect(l.table.gold.max).toBe('100')
  })

  it('parses xp min and max', async () => {
    const l = await parseLootXml(FULL_XML)
    expect(l.table.xp.min).toBe('5')
    expect(l.table.xp.max).toBe('50')
  })

  it('parses items rolls and chance', async () => {
    const l = await parseLootXml(FULL_XML)
    expect(l.table.items.rolls).toBe('1')
    expect(l.table.items.chance).toBe('50')
  })

  it('parses item count', async () => {
    const l = await parseLootXml(FULL_XML)
    expect(l.table.items.entries).toHaveLength(2)
  })

  it('parses item name from element text content', async () => {
    const l = await parseLootXml(FULL_XML)
    expect(l.table.items.entries[0].name).toBe('Iron Sword')
  })

  it('parses item variants as an array', async () => {
    const l = await parseLootXml(FULL_XML)
    expect(l.table.items.entries[0].variants).toEqual(['Blessed', 'Holy'])
  })

  it('parses explicit unique=false', async () => {
    const l = await parseLootXml(FULL_XML)
    expect(l.table.items.entries[0].unique).toBe(false)
  })

  it('parses explicit always=false', async () => {
    const l = await parseLootXml(FULL_XML)
    expect(l.table.items.entries[0].always).toBe(false)
  })

  it('parses item max', async () => {
    const l = await parseLootXml(FULL_XML)
    expect(l.table.items.entries[0].max).toBe('3')
  })

  it('absent Variants attribute defaults to empty array', async () => {
    const l = await parseLootXml(FULL_XML)
    expect(l.table.items.entries[1].variants).toEqual([])
  })

  it('absent Unique attribute defaults to true', async () => {
    // The parser defaults Unique to 'true' when the attribute is absent.
    const l = await parseLootXml(FULL_XML)
    expect(l.table.items.entries[1].unique).toBe(true)
  })

  it('absent Always attribute defaults to true', async () => {
    const l = await parseLootXml(FULL_XML)
    expect(l.table.items.entries[1].always).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 3: Field coverage — minimal
// ---------------------------------------------------------------------------

describe('Field coverage — minimal', () => {
  it('parses name', async () => {
    const l = await parseLootXml(MINIMAL_XML)
    expect(l.name).toBe('EmptyLoot')
  })

  it('defaults comment to empty string', async () => {
    const l = await parseLootXml(MINIMAL_XML)
    expect(l.comment).toBe('')
  })

  it('defaults table rolls to empty string', async () => {
    const l = await parseLootXml(MINIMAL_XML)
    expect(l.table.rolls).toBe('')
  })

  it('defaults table chance to empty string', async () => {
    const l = await parseLootXml(MINIMAL_XML)
    expect(l.table.chance).toBe('')
  })

  it('defaults gold min and max to empty string', async () => {
    const l = await parseLootXml(MINIMAL_XML)
    expect(l.table.gold.min).toBe('')
    expect(l.table.gold.max).toBe('')
  })

  it('defaults xp min and max to empty string', async () => {
    const l = await parseLootXml(MINIMAL_XML)
    expect(l.table.xp.min).toBe('')
    expect(l.table.xp.max).toBe('')
  })

  it('defaults items entries to empty array', async () => {
    const l = await parseLootXml(MINIMAL_XML)
    expect(l.table.items.entries).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Test 4: Output structure
// Serialize a loot set and re-parse it with xml2js to assert the output XML
// has the expected elements, attributes, and nesting. These are structural
// assertions written by hand from the code — they do NOT perform real XSD
// validation and will not catch divergences between creidhne and the XSD.
// ---------------------------------------------------------------------------

describe('Output structure', () => {
  const loot = {
    name: 'DropLoot',
    comment: '',
    table: {
      rolls: '3',
      chance: '100',
      gold: { min: '50', max: '200' },
      xp: { min: '10', max: '40' },
      items: {
        rolls: '1',
        chance: '80',
        entries: [
          { name: 'Short Sword', variants: ['Rusty'], unique: false, always: true, max: '1' },
        ],
      },
    },
  }

  it('root element is LootSet', async () => {
    const parsed = await parseRaw(serializeLootXml(loot))
    expect(parsed).toHaveProperty('LootSet')
  })

  it('Name attribute is present', async () => {
    const parsed = await parseRaw(serializeLootXml(loot))
    expect(parsed.LootSet.$?.Name).toBe('DropLoot')
  })

  it('Table element has Rolls and Chance attributes', async () => {
    const parsed = await parseRaw(serializeLootXml(loot))
    const table = parsed.LootSet.Table?.[0]
    expect(table.$?.Rolls).toBe('3')
    expect(table.$?.Chance).toBe('100')
  })

  it('Gold element has Min and Max attributes', async () => {
    const parsed = await parseRaw(serializeLootXml(loot))
    const gold = parsed.LootSet.Table?.[0]?.Gold?.[0]
    expect(gold.$?.Min).toBe('50')
    expect(gold.$?.Max).toBe('200')
  })

  it('Xp element has Min and Max attributes', async () => {
    const parsed = await parseRaw(serializeLootXml(loot))
    const xp = parsed.LootSet.Table?.[0]?.Xp?.[0]
    expect(xp.$?.Min).toBe('10')
    expect(xp.$?.Max).toBe('40')
  })

  it('Items element has Rolls and Chance attributes', async () => {
    const parsed = await parseRaw(serializeLootXml(loot))
    const items = parsed.LootSet.Table?.[0]?.Items?.[0]
    expect(items.$?.Rolls).toBe('1')
    expect(items.$?.Chance).toBe('80')
  })

  it('Item has text content, Variants, Unique, and Always attributes', async () => {
    const parsed = await parseRaw(serializeLootXml(loot))
    const item = parsed.LootSet.Table?.[0]?.Items?.[0]?.Item?.[0]
    expect(item._).toBe('Short Sword')
    expect(item.$?.Variants).toBe('Rusty')
    expect(item.$?.Unique).toBe('false')
    expect(item.$?.Always).toBe('true')
  })

  it('omits Gold element when both min and max are empty', async () => {
    const noGold = { ...loot, table: { ...loot.table, gold: { min: '', max: '' } } }
    const parsed = await parseRaw(serializeLootXml(noGold))
    expect(parsed.LootSet.Table?.[0]?.Gold).toBeUndefined()
  })

  it('omits Xp element when both min and max are empty', async () => {
    const noXp = { ...loot, table: { ...loot.table, xp: { min: '', max: '' } } }
    const parsed = await parseRaw(serializeLootXml(noXp))
    expect(parsed.LootSet.Table?.[0]?.Xp).toBeUndefined()
  })

  it('omits Items element when entries is empty and no rolls/chance', async () => {
    const noItems = { ...loot, table: { ...loot.table, items: { rolls: '', chance: '', entries: [] } } }
    const parsed = await parseRaw(serializeLootXml(noItems))
    expect(parsed.LootSet.Table?.[0]?.Items).toBeUndefined()
  })
})
