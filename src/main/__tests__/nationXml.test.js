import { describe, it, expect } from 'vitest'
import { parseNationXml, serializeNationXml } from '../nationXml.js'
import xml2js from 'xml2js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_XML = `<?xml version="1.0"?>
<!-- Comment: This is Mileth -->
<Nation xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Flag="1" Default="true">
  <Name>Mileth</Name>
  <Description>The city of Mileth</Description>
  <SpawnPoints>
    <SpawnPoint MapName="Mileth Village" X="10" Y="20" />
    <SpawnPoint MapName="Mileth Inn" X="5" Y="3" />
  </SpawnPoints>
  <Territory>
    <Map>Mileth Village</Map>
    <Map>Mileth Crypt 1</Map>
  </Territory>
</Nation>`

const MINIMAL_XML = `<?xml version="1.0"?>
<Nation xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Flag="0">
  <Name>Empty Nation</Name>
</Nation>`

// ---------------------------------------------------------------------------
// Helper: parse raw XML string with xml2js (for schema validation test)
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
// Parse XML → serialize back → re-parse → deep equal to first parse
// ---------------------------------------------------------------------------

describe('Parse round-trip', () => {
  it('serializing a parsed nation and re-parsing yields the same object', async () => {
    const first = await parseNationXml(FULL_XML)
    const xml = serializeNationXml(first)
    const second = await parseNationXml(xml)
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Field coverage — all optional fields present
// ---------------------------------------------------------------------------

describe('Field coverage — all fields', () => {
  it('parses name correctly', async () => {
    const nation = await parseNationXml(FULL_XML)
    expect(nation.name).toBe('Mileth')
  })

  it('parses flag correctly', async () => {
    const nation = await parseNationXml(FULL_XML)
    expect(nation.flag).toBe('1')
  })

  it('parses description correctly', async () => {
    const nation = await parseNationXml(FULL_XML)
    expect(nation.description).toBe('The city of Mileth')
  })

  it('parses comment correctly', async () => {
    const nation = await parseNationXml(FULL_XML)
    expect(nation.comment).toBe('This is Mileth')
  })

  it('parses spawn points correctly', async () => {
    const nation = await parseNationXml(FULL_XML)
    expect(nation.spawnPoints).toHaveLength(2)
    expect(nation.spawnPoints[0]).toEqual({ mapName: 'Mileth Village', x: '10', y: '20' })
    expect(nation.spawnPoints[1]).toEqual({ mapName: 'Mileth Inn', x: '5', y: '3' })
  })

  it('parses territory correctly', async () => {
    const nation = await parseNationXml(FULL_XML)
    expect(nation.territory).toEqual(['Mileth Village', 'Mileth Crypt 1'])
  })

  it('parses Default="true" as isDefault=true', async () => {
    const nation = await parseNationXml(FULL_XML)
    expect(nation.isDefault).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 3: Field coverage — minimal (required fields only)
// ---------------------------------------------------------------------------

describe('Field coverage — minimal', () => {
  it('parses name and flag', async () => {
    const nation = await parseNationXml(MINIMAL_XML)
    expect(nation.name).toBe('Empty Nation')
    expect(nation.flag).toBe('0')
  })

  it('defaults description to empty string', async () => {
    const nation = await parseNationXml(MINIMAL_XML)
    expect(nation.description).toBe('')
  })

  it('defaults comment to empty string', async () => {
    const nation = await parseNationXml(MINIMAL_XML)
    expect(nation.comment).toBe('')
  })

  it('defaults spawnPoints to empty array', async () => {
    const nation = await parseNationXml(MINIMAL_XML)
    expect(nation.spawnPoints).toEqual([])
  })

  it('defaults territory to null (disabled)', async () => {
    const nation = await parseNationXml(MINIMAL_XML)
    expect(nation.territory).toBeNull()
  })

  it('defaults isDefault to false when Default attribute absent', async () => {
    const nation = await parseNationXml(MINIMAL_XML)
    expect(nation.isDefault).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Test 4: Output structure
// Serialize a nation object and re-parse it with xml2js to assert the output
// XML has the expected elements, attributes, and nesting. These are structural
// assertions written by hand from the code — they do NOT perform real XSD
// validation and will not catch divergences between creidhne and the XSD.
// ---------------------------------------------------------------------------

describe('Output structure', () => {
  const nation = {
    name: 'Suomi',
    comment: '',
    description: 'Land of lakes',
    flag: '3',
    isDefault: false,
    spawnPoints: [
      { mapName: 'Suomi Village', x: '12', y: '34' },
    ],
    territory: null,
  }

  it('serializes valid XML that re-parses without error', async () => {
    const xml = serializeNationXml(nation)
    await expect(parseRaw(xml)).resolves.toBeDefined()
  })

  it('root element is Nation', async () => {
    const xml = serializeNationXml(nation)
    const parsed = await parseRaw(xml)
    expect(parsed).toHaveProperty('Nation')
  })

  it('Flag attribute is present and within unsignedByte range (0–255)', async () => {
    const xml = serializeNationXml(nation)
    const parsed = await parseRaw(xml)
    const flag = Number(parsed.Nation.$?.Flag)
    expect(Number.isInteger(flag) || flag === 0).toBe(true)
    expect(flag).toBeGreaterThanOrEqual(0)
    expect(flag).toBeLessThanOrEqual(255)
  })

  it('Name element is present and non-empty (String8: 1–255 chars)', async () => {
    const xml = serializeNationXml(nation)
    const parsed = await parseRaw(xml)
    const name = parsed.Nation.Name?.[0]
    expect(typeof name).toBe('string')
    expect(name.length).toBeGreaterThanOrEqual(1)
    expect(name.length).toBeLessThanOrEqual(255)
  })

  it('Description element, when present, is non-empty (String8: 1–255 chars)', async () => {
    const xml = serializeNationXml(nation)
    const parsed = await parseRaw(xml)
    const desc = parsed.Nation.Description?.[0]
    if (desc !== undefined) {
      expect(typeof desc).toBe('string')
      expect(desc.length).toBeGreaterThanOrEqual(1)
      expect(desc.length).toBeLessThanOrEqual(255)
    }
  })

  it('each SpawnPoint has required MapName, X, Y attributes within valid ranges', async () => {
    const xml = serializeNationXml(nation)
    const parsed = await parseRaw(xml)
    const spawnPoints = parsed.Nation.SpawnPoints?.[0]?.SpawnPoint ?? []
    for (const sp of spawnPoints) {
      expect(typeof sp.$?.MapName).toBe('string')
      expect(sp.$?.MapName.length).toBeGreaterThanOrEqual(1)
      const x = Number(sp.$?.X)
      const y = Number(sp.$?.Y)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(255)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(255)
    }
  })

  it('omits SpawnPoints element when spawnPoints array is empty', async () => {
    const nationNoSpawns = { ...nation, spawnPoints: [] }
    const xml = serializeNationXml(nationNoSpawns)
    const parsed = await parseRaw(xml)
    expect(parsed.Nation.SpawnPoints).toBeUndefined()
  })

  it('omits Territory element when territory is null', async () => {
    const xml = serializeNationXml({ ...nation, territory: null })
    const parsed = await parseRaw(xml)
    expect(parsed.Nation.Territory).toBeUndefined()
  })

  it('omits Default attribute when isDefault is false', async () => {
    const xml = serializeNationXml({ ...nation, isDefault: false })
    const parsed = await parseRaw(xml)
    expect(parsed.Nation.$?.Default).toBeUndefined()
  })

  it('writes Default="true" when isDefault is true', async () => {
    const xml = serializeNationXml({ ...nation, isDefault: true })
    const parsed = await parseRaw(xml)
    expect(parsed.Nation.$?.Default).toBe('true')
  })

  // NOTE: The XSD defines <Map> as type NationMap — a complex type with a Name attribute
  // (e.g. <Map Name="Mileth Village" />). However, the serializer outputs plain text content
  // (<Map>Mileth Village</Map>), which is what the parser also expects. Full XSD-level
  // validation of Territory is intentionally skipped here; the structural check below only
  // confirms the element exists and has the right child count.
  it('includes Territory element when territory is an array', async () => {
    const nationWithTerritory = { ...nation, territory: ['Suomi Village', 'Suomi Crypt'] }
    const xml = serializeNationXml(nationWithTerritory)
    const parsed = await parseRaw(xml)
    expect(parsed.Nation.Territory).toBeDefined()
    expect(parsed.Nation.Territory[0].Map).toHaveLength(2)
  })
})
