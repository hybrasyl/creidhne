import { describe, it, expect } from 'vitest'
import { parseCreatureXml, serializeCreatureXml } from '../creatureXml.js'
import xml2js from 'xml2js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_XML = `<?xml version="1.0"?>
<!-- Comment: A test wolf -->
<Creature xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="Wolf" Sprite="101" BehaviorSet="wolf-behavior" MinDmg="5" MaxDmg="15" AssailSound="1">
  <Description>A fierce wolf</Description>
  <Loot>
    <Set Name="wolf-loot" Rolls="1" Chance="75" />
  </Loot>
  <Hostility>
    <Monsters ExceptCookie="no-aggro" />
    <Players OnlyCookie="pvp-zone" />
  </Hostility>
  <SetCookies>
    <Cookie Name="wolf-seen" Value="1" />
  </SetCookies>
  <Types>
    <Type Name="Alpha Wolf" Sprite="102" BehaviorSet="alpha-behavior" MinDmg="10" MaxDmg="25" AssailSound="2">
      <Description>The alpha of the pack</Description>
      <Loot>
        <Set Name="alpha-loot" Rolls="2" Chance="50" />
      </Loot>
      <Hostility>
        <Players />
      </Hostility>
    </Type>
  </Types>
</Creature>`

const MINIMAL_XML = `<?xml version="1.0"?>
<Creature xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="Slime" Sprite="1" BehaviorSet="slime-behavior">
</Creature>`

const META_XML = `<?xml version="1.0"?>
<Creature xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="Pack Wolf" Sprite="101" BehaviorSet="wolf-behavior">
  <!-- creidhne:meta {"family":"wolf"} -->
</Creature>`

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
// ---------------------------------------------------------------------------

describe('Parse round-trip', () => {
  it('serializing a parsed creature and re-parsing yields the same object', async () => {
    const first = await parseCreatureXml(FULL_XML)
    const xml = serializeCreatureXml(first)
    const second = await parseCreatureXml(xml)
    expect(second).toEqual(first)
  })

  it('round-trips a creature with meta.family annotation', async () => {
    const first = await parseCreatureXml(META_XML)
    const xml = serializeCreatureXml(first)
    const second = await parseCreatureXml(xml)
    expect(second.meta.family).toBe('wolf')
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Field coverage — all optional fields present
// ---------------------------------------------------------------------------

describe('Field coverage — all fields', () => {
  it('parses name attribute', async () => {
    const c = await parseCreatureXml(FULL_XML)
    expect(c.name).toBe('Wolf')
  })

  it('parses sprite attribute', async () => {
    const c = await parseCreatureXml(FULL_XML)
    expect(c.sprite).toBe('101')
  })

  it('parses behaviorSet attribute', async () => {
    const c = await parseCreatureXml(FULL_XML)
    expect(c.behaviorSet).toBe('wolf-behavior')
  })

  it('parses minDmg and maxDmg', async () => {
    const c = await parseCreatureXml(FULL_XML)
    expect(c.minDmg).toBe('5')
    expect(c.maxDmg).toBe('15')
  })

  it('parses assailSound', async () => {
    const c = await parseCreatureXml(FULL_XML)
    expect(c.assailSound).toBe('1')
  })

  it('parses comment', async () => {
    const c = await parseCreatureXml(FULL_XML)
    expect(c.comment).toBe('A test wolf')
  })

  it('parses description', async () => {
    const c = await parseCreatureXml(FULL_XML)
    expect(c.description).toBe('A fierce wolf')
  })

  it('parses loot sets', async () => {
    const c = await parseCreatureXml(FULL_XML)
    expect(c.loot).toHaveLength(1)
    expect(c.loot[0]).toEqual({ name: 'wolf-loot', rolls: '1', chance: '75' })
  })

  it('parses monster hostility', async () => {
    const c = await parseCreatureXml(FULL_XML)
    expect(c.hostility.monsters).toBe(true)
    expect(c.hostility.monsterExceptCookie).toBe('no-aggro')
  })

  it('parses player hostility', async () => {
    const c = await parseCreatureXml(FULL_XML)
    expect(c.hostility.players).toBe(true)
    expect(c.hostility.playerOnlyCookie).toBe('pvp-zone')
  })

  it('parses cookies', async () => {
    const c = await parseCreatureXml(FULL_XML)
    expect(c.cookies).toHaveLength(1)
    expect(c.cookies[0]).toEqual({ name: 'wolf-seen', value: '1' })
  })

  it('parses subtypes', async () => {
    const c = await parseCreatureXml(FULL_XML)
    expect(c.subtypes).toHaveLength(1)
    const sub = c.subtypes[0]
    expect(sub.name).toBe('Alpha Wolf')
    expect(sub.sprite).toBe('102')
    expect(sub.behaviorSet).toBe('alpha-behavior')
    expect(sub.minDmg).toBe('10')
    expect(sub.maxDmg).toBe('25')
    expect(sub.assailSound).toBe('2')
    expect(sub.description).toBe('The alpha of the pack')
  })

  it('parses subtype loot', async () => {
    const c = await parseCreatureXml(FULL_XML)
    expect(c.subtypes[0].loot).toHaveLength(1)
    expect(c.subtypes[0].loot[0]).toEqual({ name: 'alpha-loot', rolls: '2', chance: '50' })
  })

  it('parses subtype hostility', async () => {
    const c = await parseCreatureXml(FULL_XML)
    expect(c.subtypes[0].hostility.players).toBe(true)
    expect(c.subtypes[0].hostility.monsters).toBe(false)
  })

  it('defaults meta.family to empty string when no annotation present', async () => {
    const c = await parseCreatureXml(FULL_XML)
    expect(c.meta).toEqual({ family: '', weapon: '' })
  })
})

// ---------------------------------------------------------------------------
// Test 3: Field coverage — minimal (required fields only)
// ---------------------------------------------------------------------------

describe('Field coverage — minimal', () => {
  it('parses name, sprite, and behaviorSet', async () => {
    const c = await parseCreatureXml(MINIMAL_XML)
    expect(c.name).toBe('Slime')
    expect(c.sprite).toBe('1')
    expect(c.behaviorSet).toBe('slime-behavior')
  })

  it('defaults comment to empty string', async () => {
    const c = await parseCreatureXml(MINIMAL_XML)
    expect(c.comment).toBe('')
  })

  it('defaults description to empty string', async () => {
    const c = await parseCreatureXml(MINIMAL_XML)
    expect(c.description).toBe('')
  })

  it('defaults minDmg, maxDmg, assailSound to empty string', async () => {
    const c = await parseCreatureXml(MINIMAL_XML)
    expect(c.minDmg).toBe('')
    expect(c.maxDmg).toBe('')
    expect(c.assailSound).toBe('')
  })

  it('defaults loot to empty array', async () => {
    const c = await parseCreatureXml(MINIMAL_XML)
    expect(c.loot).toEqual([])
  })

  it('defaults hostility to all-false', async () => {
    const c = await parseCreatureXml(MINIMAL_XML)
    expect(c.hostility).toEqual({
      players: false,
      playerExceptCookie: '',
      playerOnlyCookie: '',
      monsters: false,
      monsterExceptCookie: '',
      monsterOnlyCookie: ''
    })
  })

  it('defaults cookies to empty array', async () => {
    const c = await parseCreatureXml(MINIMAL_XML)
    expect(c.cookies).toEqual([])
  })

  it('defaults subtypes to empty array', async () => {
    const c = await parseCreatureXml(MINIMAL_XML)
    expect(c.subtypes).toEqual([])
  })

  it('defaults meta.family to empty string', async () => {
    const c = await parseCreatureXml(MINIMAL_XML)
    expect(c.meta).toEqual({ family: '', weapon: '' })
  })
})

// ---------------------------------------------------------------------------
// Test 3b: meta annotation
// ---------------------------------------------------------------------------

describe('meta.family annotation', () => {
  it('parses family from creidhne:meta comment', async () => {
    const c = await parseCreatureXml(META_XML)
    expect(c.meta.family).toBe('wolf')
  })

  it('serializes creidhne:meta annotation when family is set', async () => {
    const c = await parseCreatureXml(META_XML)
    const xml = serializeCreatureXml(c)
    expect(xml).toContain('creidhne:meta')
    expect(xml).toContain('"family":"wolf"')
  })

  it('omits creidhne:meta annotation when family is empty', async () => {
    const c = await parseCreatureXml(MINIMAL_XML)
    const xml = serializeCreatureXml(c)
    expect(xml).not.toContain('creidhne:meta')
  })
})

// ---------------------------------------------------------------------------
// Test 4: Output structure
// Serialize a creature and re-parse it with xml2js to assert the output
// XML has the expected elements, attributes, and nesting. These are structural
// assertions written by hand from the code — they do NOT perform real XSD
// validation and will not catch divergences between creidhne and the XSD.
// ---------------------------------------------------------------------------

describe('Output structure', () => {
  const creature = {
    name: 'Schema Wolf',
    sprite: '50',
    behaviorSet: 'wolf-behavior',
    minDmg: '3',
    maxDmg: '9',
    assailSound: '',
    comment: '',
    meta: { family: 'wolf' },
    description: 'A wolf for schema testing',
    loot: [{ name: 'wolf-loot', rolls: '1', chance: '80' }],
    hostility: {
      monsters: true,
      monsterExceptCookie: 'truce',
      monsterOnlyCookie: '',
      players: false,
      playerExceptCookie: '',
      playerOnlyCookie: ''
    },
    cookies: [{ name: 'seen', value: '' }],
    subtypes: [
      {
        name: 'Pup',
        sprite: '51',
        behaviorSet: 'pup-behavior',
        minDmg: '1',
        maxDmg: '3',
        assailSound: '',
        description: '',
        loot: [],
        hostility: {
          monsters: false,
          monsterExceptCookie: '',
          monsterOnlyCookie: '',
          players: false,
          playerExceptCookie: '',
          playerOnlyCookie: ''
        },
        cookies: []
      }
    ]
  }

  it('serializes valid XML that re-parses without error', async () => {
    const xml = serializeCreatureXml(creature)
    await expect(parseRaw(xml)).resolves.toBeDefined()
  })

  it('root element is Creature', async () => {
    const xml = serializeCreatureXml(creature)
    const parsed = await parseRaw(xml)
    expect(parsed).toHaveProperty('Creature')
  })

  it('Name attribute is present and non-empty', async () => {
    const xml = serializeCreatureXml(creature)
    const parsed = await parseRaw(xml)
    const name = parsed.Creature.$?.Name
    expect(typeof name).toBe('string')
    expect(name.length).toBeGreaterThanOrEqual(1)
  })

  it('Sprite attribute is present', async () => {
    const xml = serializeCreatureXml(creature)
    const parsed = await parseRaw(xml)
    expect(parsed.Creature.$?.Sprite).toBeDefined()
  })

  it('BehaviorSet attribute is present and non-empty', async () => {
    const xml = serializeCreatureXml(creature)
    const parsed = await parseRaw(xml)
    const bs = parsed.Creature.$?.BehaviorSet
    expect(typeof bs).toBe('string')
    expect(bs.length).toBeGreaterThanOrEqual(1)
  })

  it('Loot/Set elements have Name attribute', async () => {
    const xml = serializeCreatureXml(creature)
    const parsed = await parseRaw(xml)
    const sets = parsed.Creature.Loot?.[0]?.Set ?? []
    for (const s of sets) {
      expect(typeof s.$?.Name).toBe('string')
      expect(s.$?.Name.length).toBeGreaterThan(0)
    }
  })

  it('Hostility wraps Monsters and Players elements', async () => {
    const xml = serializeCreatureXml(creature)
    const parsed = await parseRaw(xml)
    const hostility = parsed.Creature.Hostility?.[0]
    expect(hostility).toBeDefined()
    expect(hostility.Monsters).toBeDefined()
  })

  it('omits Hostility element when both monsters and players are false', async () => {
    const noHostility = {
      ...creature,
      hostility: {
        monsters: false,
        monsterExceptCookie: '',
        monsterOnlyCookie: '',
        players: false,
        playerExceptCookie: '',
        playerOnlyCookie: ''
      }
    }
    const xml = serializeCreatureXml(noHostility)
    const parsed = await parseRaw(xml)
    expect(parsed.Creature.Hostility).toBeUndefined()
  })

  it('each subtype Type element has a Name attribute', async () => {
    const xml = serializeCreatureXml(creature)
    const parsed = await parseRaw(xml)
    const types = parsed.Creature.Types?.[0]?.Type ?? []
    for (const t of types) {
      expect(typeof t.$?.Name).toBe('string')
      expect(t.$?.Name.length).toBeGreaterThan(0)
    }
  })

  it('omits Types element when subtypes array is empty', async () => {
    const noSubtypes = { ...creature, subtypes: [] }
    const xml = serializeCreatureXml(noSubtypes)
    const parsed = await parseRaw(xml)
    expect(parsed.Creature.Types).toBeUndefined()
  })

  it('injects creidhne:meta annotation after opening tag when family is set', async () => {
    const xml = serializeCreatureXml(creature)
    expect(xml).toContain('creidhne:meta')
    expect(xml).toContain('"family":"wolf"')
  })

  it('omits creidhne:meta annotation when family is empty string', async () => {
    const noFamily = { ...creature, meta: { family: '' } }
    const xml = serializeCreatureXml(noFamily)
    expect(xml).not.toContain('creidhne:meta')
  })
})
