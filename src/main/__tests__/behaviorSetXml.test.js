import { describe, it, expect } from 'vitest'
import { parseBehaviorSetXml, serializeBehaviorSetXml } from '../behaviorSetXml.js'
import xml2js from 'xml2js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_XML = `<?xml version="1.0"?>
<!-- Comment: Aggressive pack behavior -->
<BehaviorSet xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="Test Wolves" Import="base-aggressive">
  <StatAlloc>Str Con</StatAlloc>
  <Behavior>
    <CastingSets>
      <CastingSet Type="Offense" Interval="5" Random="true" Categories="magic">
        <Castable HealthPercentage="50" Interval="3">Punch</Castable>
      </CastingSet>
    </CastingSets>
    <Hostility>
      <Monsters ExceptCookie="no-aggro" />
      <Players OnlyCookie="pvp-zone" />
    </Hostility>
    <SetCookies>
      <Cookie Name="attacked" Value="true" />
    </SetCookies>
  </Behavior>
  <Immunities>
    <Immunity Type="Element" MessageType="Say" Message="Immune!">Fire</Immunity>
  </Immunities>
  <StatModifiers BaseStr="5" BaseCon="3">
    <ElementalModifiers>
      <ElementalModifier Type="Augment" Element="Fire" Modifier="1.5" />
    </ElementalModifiers>
  </StatModifiers>
</BehaviorSet>`

const MINIMAL_XML = `<?xml version="1.0"?>
<BehaviorSet xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="Minimalist">
</BehaviorSet>`

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
// (Hostility excluded from FULL_XML fixture; see mismatch note at top)
// ---------------------------------------------------------------------------

describe('Parse round-trip', () => {
  it('serializing a parsed behavior set and re-parsing yields the same object', async () => {
    const first = await parseBehaviorSetXml(FULL_XML)
    const xml = serializeBehaviorSetXml(first)
    const second = await parseBehaviorSetXml(xml)
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Field coverage — all optional fields present
// ---------------------------------------------------------------------------

describe('Field coverage — all fields', () => {
  it('parses name attribute', async () => {
    const bvs = await parseBehaviorSetXml(FULL_XML)
    expect(bvs.name).toBe('Test Wolves')
  })

  it('parses comment', async () => {
    const bvs = await parseBehaviorSetXml(FULL_XML)
    expect(bvs.comment).toBe('Aggressive pack behavior')
  })

  it('parses import attribute', async () => {
    const bvs = await parseBehaviorSetXml(FULL_XML)
    expect(bvs.import).toBe('base-aggressive')
  })

  it('parses statAlloc', async () => {
    const bvs = await parseBehaviorSetXml(FULL_XML)
    expect(bvs.statAlloc).toBe('Str Con')
  })

  it('parses casting sets', async () => {
    const bvs = await parseBehaviorSetXml(FULL_XML)
    expect(bvs.castingSets).toHaveLength(1)
    const cs = bvs.castingSets[0]
    expect(cs.type).toBe('Offense')
    expect(cs.interval).toBe('5')
    expect(cs.random).toBe(true)
    expect(cs.categories).toBe('magic')
  })

  it('parses castables within a casting set', async () => {
    const bvs = await parseBehaviorSetXml(FULL_XML)
    const castables = bvs.castingSets[0].castables
    expect(castables).toHaveLength(1)
    expect(castables[0].name).toBe('Punch')
    expect(castables[0].healthPercentage).toBe('50')
    expect(castables[0].interval).toBe('3')
  })

  it('parses monster hostility', async () => {
    const bvs = await parseBehaviorSetXml(FULL_XML)
    expect(bvs.hostility.monsters.enabled).toBe(true)
    expect(bvs.hostility.monsters.exceptCookie).toBe('no-aggro')
  })

  it('parses player hostility', async () => {
    const bvs = await parseBehaviorSetXml(FULL_XML)
    expect(bvs.hostility.players.enabled).toBe(true)
    expect(bvs.hostility.players.onlyCookie).toBe('pvp-zone')
  })

  it('parses cookies', async () => {
    const bvs = await parseBehaviorSetXml(FULL_XML)
    expect(bvs.cookies).toHaveLength(1)
    expect(bvs.cookies[0]).toEqual({ name: 'attacked', value: 'true' })
  })

  it('parses immunities', async () => {
    const bvs = await parseBehaviorSetXml(FULL_XML)
    expect(bvs.immunities).toHaveLength(1)
    expect(bvs.immunities[0]).toEqual({
      type: 'Element',
      value: 'Fire',
      messageType: 'Say',
      message: 'Immune!',
    })
  })

  it('parses stat modifier attribute rows', async () => {
    const bvs = await parseBehaviorSetXml(FULL_XML)
    const keys = bvs.statModifiers.rows.map((r) => r.key)
    expect(keys).toContain('BaseStr')
    expect(keys).toContain('BaseCon')
    const str = bvs.statModifiers.rows.find((r) => r.key === 'BaseStr')
    expect(str.value).toBe('5')
  })

  it('parses elemental modifiers', async () => {
    const bvs = await parseBehaviorSetXml(FULL_XML)
    expect(bvs.statModifiers.elementalModifiers).toHaveLength(1)
    expect(bvs.statModifiers.elementalModifiers[0]).toEqual({
      type: 'Augment',
      element: 'Fire',
      modifier: '1.5',
    })
  })
})

// ---------------------------------------------------------------------------
// Test 3: Field coverage — minimal (required fields only)
// ---------------------------------------------------------------------------

describe('Field coverage — minimal', () => {
  it('parses name', async () => {
    const bvs = await parseBehaviorSetXml(MINIMAL_XML)
    expect(bvs.name).toBe('Minimalist')
  })

  it('defaults comment to empty string', async () => {
    const bvs = await parseBehaviorSetXml(MINIMAL_XML)
    expect(bvs.comment).toBe('')
  })

  it('defaults import to empty string', async () => {
    const bvs = await parseBehaviorSetXml(MINIMAL_XML)
    expect(bvs.import).toBe('')
  })

  it('defaults statAlloc to empty string', async () => {
    const bvs = await parseBehaviorSetXml(MINIMAL_XML)
    expect(bvs.statAlloc).toBe('')
  })

  it('defaults castingSets to empty array', async () => {
    const bvs = await parseBehaviorSetXml(MINIMAL_XML)
    expect(bvs.castingSets).toEqual([])
  })

  it('defaults hostility monsters and players to disabled', async () => {
    const bvs = await parseBehaviorSetXml(MINIMAL_XML)
    expect(bvs.hostility.monsters.enabled).toBe(false)
    expect(bvs.hostility.players.enabled).toBe(false)
  })

  it('defaults cookies to empty array', async () => {
    const bvs = await parseBehaviorSetXml(MINIMAL_XML)
    expect(bvs.cookies).toEqual([])
  })

  it('defaults immunities to empty array', async () => {
    const bvs = await parseBehaviorSetXml(MINIMAL_XML)
    expect(bvs.immunities).toEqual([])
  })

  it('defaults statModifiers to empty rows and elementalModifiers', async () => {
    const bvs = await parseBehaviorSetXml(MINIMAL_XML)
    expect(bvs.statModifiers).toEqual({ rows: [], elementalModifiers: [] })
  })
})

// ---------------------------------------------------------------------------
// Test 4: Schema validation
// Serialize a behavior set and assert the output XML structure matches the
// constraints defined in the CreatureBehaviorSet type in Common.xsd /
// BehaviorSet element in Creature.xsd.
// ---------------------------------------------------------------------------

describe('Schema validation', () => {
  const bvs = {
    name: 'Schema Wolves',
    comment: '',
    import: '',
    statAlloc: 'Str',
    castingSets: [
      {
        type: 'Offense',
        interval: '10',
        targetPriority: '',
        healthPercentage: '',
        random: true,
        categories: '',
        castables: [{ name: 'Bite', healthPercentage: '', interval: '' }],
      },
    ],
    hostility: {
      monsters: { enabled: true, exceptCookie: '', onlyCookie: '' },
      players: { enabled: false, exceptCookie: '', onlyCookie: '' },
    },
    cookies: [{ name: 'bit', value: 'true' }],
    immunities: [{ type: 'Element', value: 'Fire', messageType: 'Say', message: '' }],
    statModifiers: {
      rows: [{ key: 'BaseStr', value: '2' }],
      elementalModifiers: [{ type: 'Augment', element: 'Wind', modifier: '1.2' }],
    },
  }

  it('serializes valid XML that re-parses without error', async () => {
    const xml = serializeBehaviorSetXml(bvs)
    await expect(parseRaw(xml)).resolves.toBeDefined()
  })

  it('root element is BehaviorSet', async () => {
    const xml = serializeBehaviorSetXml(bvs)
    const parsed = await parseRaw(xml)
    expect(parsed).toHaveProperty('BehaviorSet')
  })

  it('Name attribute is present and non-empty', async () => {
    const xml = serializeBehaviorSetXml(bvs)
    const parsed = await parseRaw(xml)
    const name = parsed.BehaviorSet.$?.Name
    expect(typeof name).toBe('string')
    expect(name.length).toBeGreaterThanOrEqual(1)
  })

  it('StatAlloc element, when present, is non-empty text', async () => {
    const xml = serializeBehaviorSetXml(bvs)
    const parsed = await parseRaw(xml)
    const statAlloc = parsed.BehaviorSet.StatAlloc?.[0]
    if (statAlloc !== undefined) {
      expect(typeof statAlloc).toBe('string')
      expect(statAlloc.trim().length).toBeGreaterThan(0)
    }
  })

  it('CastingSet has required Type attribute', async () => {
    const xml = serializeBehaviorSetXml(bvs)
    const parsed = await parseRaw(xml)
    const sets = parsed.BehaviorSet.Behavior?.[0]?.CastingSets?.[0]?.CastingSet ?? []
    for (const cs of sets) {
      expect(typeof cs.$?.Type).toBe('string')
      expect(cs.$?.Type.length).toBeGreaterThan(0)
    }
  })

  it('each Castable inside a CastingSet has a name (text content)', async () => {
    const xml = serializeBehaviorSetXml(bvs)
    const parsed = await parseRaw(xml)
    const sets = parsed.BehaviorSet.Behavior?.[0]?.CastingSets?.[0]?.CastingSet ?? []
    for (const cs of sets) {
      for (const castable of cs.Castable ?? []) {
        const name = typeof castable === 'string' ? castable : castable._
        expect(typeof name).toBe('string')
        expect(name.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('Cookie elements have required Name attribute', async () => {
    const xml = serializeBehaviorSetXml(bvs)
    const parsed = await parseRaw(xml)
    const cookies = parsed.BehaviorSet.Behavior?.[0]?.SetCookies?.[0]?.Cookie ?? []
    for (const c of cookies) {
      expect(typeof c.$?.Name).toBe('string')
      expect(c.$?.Name.length).toBeGreaterThan(0)
    }
  })

  it('Immunity elements have required Type attribute and text content', async () => {
    const xml = serializeBehaviorSetXml(bvs)
    const parsed = await parseRaw(xml)
    const immunities = parsed.BehaviorSet.Immunities?.[0]?.Immunity ?? []
    for (const imm of immunities) {
      expect(typeof imm.$?.Type).toBe('string')
      expect(imm.$?.Type.length).toBeGreaterThan(0)
      // value is the text content (imm._ for mixed-content nodes)
      expect(typeof (imm._ ?? imm)).toBe('string')
    }
  })

  it('StatModifiers ElementalModifier has Type, Element, and Modifier attributes', async () => {
    const xml = serializeBehaviorSetXml(bvs)
    const parsed = await parseRaw(xml)
    const modifiers =
      parsed.BehaviorSet.StatModifiers?.[0]?.ElementalModifiers?.[0]?.ElementalModifier ?? []
    for (const em of modifiers) {
      expect(typeof em.$?.Type).toBe('string')
      expect(typeof em.$?.Element).toBe('string')
      expect(typeof em.$?.Modifier).toBe('string')
    }
  })

  it('serializer wraps active hostility in a Hostility element inside Behavior', async () => {
    const xml = serializeBehaviorSetXml(bvs)
    const parsed = await parseRaw(xml)
    const behavior = parsed.BehaviorSet.Behavior?.[0]
    expect(behavior?.Hostility).toBeDefined()
    expect(behavior?.Hostility?.[0]?.Monsters).toBeDefined()
  })
})
