import { describe, it, expect } from 'vitest'
import { parseSpawngroupXml, serializeSpawngroupXml } from '../spawngroupXml.js'
import xml2js from 'xml2js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// SpawnGroup has two loot levels: group-level Loot (shared across all spawns)
// and per-Spawn Loot. Both use the same Set ref format: { name, rolls, chance }.
//
// Hostility: players/monsters are boolean presence flags. Cookie attributes
// (ExceptCookie, OnlyCookie) are optional overrides on those elements.
//
// prefix is always '' after parsing — it is not stored in the XML but set
// externally (from the filename) when loading. Tests do not round-trip prefix.
//
// spec.disabled is serialized as Disabled="true" and omitted when false,
// consistent with how root-level disabled/despawnLoot are handled.

const FULL_XML = `<?xml version="1.0"?>
<!-- Comment: Test spawn group -->
<SpawnGroup xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02"
  Name="TestGroup" BaseLevel="10" DespawnAfter="30" Disabled="false">
  <Spawns>
    <Spawn Name="Goblin" Flags="Immortal Unique"
           ActiveFrom="06:00" ActiveTo="22:00" DespawnAfter="5" DespawnLoot="true">
      <Immunities>
        <Immunity Type="Element" MessageType="Say" Message="Ha!">Fire</Immunity>
      </Immunities>
      <Loot>
        <Set Name="goblin_loot" Rolls="2" Chance="50" />
      </Loot>
      <Coordinates>
        <Coordinate X="5" Y="10" />
        <Coordinate X="6" Y="11" />
      </Coordinates>
      <Damage MinDmg="10" MaxDmg="50" Elements="Fire" />
      <Defense Ac="5" Mr="10" Elements="Wind" />
      <Spec MinCount="1" MaxCount="5" MaxPerInterval="2" Interval="30"
            Limit="10" Percentage="75" Disabled="false" When="morning" />
      <Base Level="10" WeakChance="20" StrongChance="5" BehaviorSet="aggressive" />
      <Hostility>
        <Monsters ExceptCookie="friendly_town" />
        <Players OnlyCookie="pvp_zone" />
      </Hostility>
      <SetCookies>
        <Cookie Name="spawned_goblin" Value="true" />
      </SetCookies>
    </Spawn>
  </Spawns>
  <Loot>
    <Set Name="common_drops" Rolls="1" Chance="100" />
  </Loot>
</SpawnGroup>`

const MINIMAL_XML = `<?xml version="1.0"?>
<SpawnGroup xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="EmptyGroup">
  <Spawns>
  </Spawns>
</SpawnGroup>`

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
  it('serializing a parsed spawn group and re-parsing yields the same object', async () => {
    const first = await parseSpawngroupXml(FULL_XML)
    const xml = serializeSpawngroupXml(first)
    const second = await parseSpawngroupXml(xml)
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Field coverage — all fields
// ---------------------------------------------------------------------------

describe('Field coverage — all fields', () => {
  it('parses name', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    expect(sg.name).toBe('TestGroup')
  })

  it('parses comment', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    expect(sg.comment).toBe('Test spawn group')
  })

  it('parses baseLevel and despawnAfter', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    expect(sg.baseLevel).toBe('10')
    expect(sg.despawnAfter).toBe('30')
  })

  it('parses disabled as boolean', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    expect(sg.disabled).toBe(false)
  })

  it('parses despawnLoot as boolean on spawn', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    expect(sg.spawns[0].despawnLoot).toBe(true)
  })

  it('parses group-level loot sets', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    expect(sg.loot).toHaveLength(1)
    expect(sg.loot[0]).toEqual({ name: 'common_drops', rolls: '1', chance: '100' })
  })

  it('parses spawn name and flags', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    const sp = sg.spawns[0]
    expect(sp.name).toBe('Goblin')
    expect(sp.flags).toEqual(['Immortal', 'Unique'])
  })

  it('parses spawn immunity', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    const imm = sg.spawns[0].immunities[0]
    expect(imm).toEqual({ type: 'Element', value: 'Fire', messageType: 'Say', message: 'Ha!' })
  })

  it('parses spawn-level loot sets', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    expect(sg.spawns[0].loot).toHaveLength(1)
    expect(sg.spawns[0].loot[0]).toEqual({ name: 'goblin_loot', rolls: '2', chance: '50' })
  })

  it('parses spawn coordinates', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    const coords = sg.spawns[0].coordinates
    expect(coords).toHaveLength(2)
    expect(coords[0]).toEqual({ x: '5', y: '10' })
    expect(coords[1]).toEqual({ x: '6', y: '11' })
  })

  it('parses spawn combat damage', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    const c = sg.spawns[0].combat
    expect(c.minDmg).toBe('10')
    expect(c.maxDmg).toBe('50')
    expect(c.offensiveElement).toBe('Fire')
  })

  it('parses spawn combat defense', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    const c = sg.spawns[0].combat
    expect(c.ac).toBe('5')
    expect(c.mr).toBe('10')
    expect(c.defensiveElement).toBe('Wind')
  })

  it('parses spawn spec', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    const s = sg.spawns[0].spec
    expect(s.disabled).toBe(false)
    expect(s.minCount).toBe('1')
    expect(s.maxCount).toBe('5')
    expect(s.maxPerInterval).toBe('2')
    expect(s.interval).toBe('30')
    expect(s.limit).toBe('10')
    expect(s.percentage).toBe('75')
  })

  it('parses spawn-level activeFrom and activeTo', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    const sp = sg.spawns[0]
    expect(sp.activeFrom).toBe('06:00')
    expect(sp.activeTo).toBe('22:00')
  })

  it('parses spawn-level despawnAfter', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    expect(sg.spawns[0].despawnAfter).toBe('5')
  })

  it('parses spec.when', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    expect(sg.spawns[0].spec.when).toBe('morning')
  })

  it('parses spawn base', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    const b = sg.spawns[0].base
    expect(b.level).toBe('10')
    expect(b.weakChance).toBe('20')
    expect(b.strongChance).toBe('5')
    expect(b.behaviorSet).toBe('aggressive')
  })

  it('parses spawn hostility monsters and cookie', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    const h = sg.spawns[0].hostility
    expect(h.monsters).toBe(true)
    expect(h.monsterExceptCookie).toBe('friendly_town')
    expect(h.monsterOnlyCookie).toBe('')
  })

  it('parses spawn hostility players and cookie', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    const h = sg.spawns[0].hostility
    expect(h.players).toBe(true)
    expect(h.playerOnlyCookie).toBe('pvp_zone')
    expect(h.playerExceptCookie).toBe('')
  })

  it('parses spawn cookies', async () => {
    const sg = await parseSpawngroupXml(FULL_XML)
    expect(sg.spawns[0].cookies).toHaveLength(1)
    expect(sg.spawns[0].cookies[0]).toEqual({ name: 'spawned_goblin', value: 'true' })
  })

  it('hostility players=true with no cookies round-trips correctly', async () => {
    // When players/monsters is true but both cookie attributes are empty, the
    // serializer produces a bare <Players/> element with no attributes.
    // xml2js parses attribute-less empty elements as '' (falsy), so a naive
    // !!players check would silently drop the hostility flag on re-parse.
    const bareHostilityXml = `<?xml version="1.0"?>
<SpawnGroup xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="BareTest">
  <Spawns>
    <Spawn Name="Ghost">
      <Hostility>
        <Players />
      </Hostility>
    </Spawn>
  </Spawns>
</SpawnGroup>`
    const sg = await parseSpawngroupXml(bareHostilityXml)
    expect(sg.spawns[0].hostility.players).toBe(true)
    expect(sg.spawns[0].hostility.monsters).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Test 3: Field coverage — minimal
// ---------------------------------------------------------------------------

describe('Field coverage — minimal', () => {
  it('parses name', async () => {
    const sg = await parseSpawngroupXml(MINIMAL_XML)
    expect(sg.name).toBe('EmptyGroup')
  })

  it('defaults comment to empty string', async () => {
    const sg = await parseSpawngroupXml(MINIMAL_XML)
    expect(sg.comment).toBe('')
  })

  it('defaults baseLevel and despawnAfter to empty string', async () => {
    const sg = await parseSpawngroupXml(MINIMAL_XML)
    expect(sg.baseLevel).toBe('')
    expect(sg.despawnAfter).toBe('')
  })

  it('defaults disabled to false', async () => {
    const sg = await parseSpawngroupXml(MINIMAL_XML)
    expect(sg.disabled).toBe(false)
  })

  it('defaults group-level loot to empty array', async () => {
    const sg = await parseSpawngroupXml(MINIMAL_XML)
    expect(sg.loot).toEqual([])
  })

  it('defaults spawns to empty array', async () => {
    const sg = await parseSpawngroupXml(MINIMAL_XML)
    expect(sg.spawns).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Test 4: Output structure
// Serialize a spawn group and re-parse it with xml2js to assert the output
// XML has the expected elements, attributes, and nesting. These are structural
// assertions written by hand from the code — they do NOT perform real XSD
// validation and will not catch divergences between creidhne and the XSD.
// ---------------------------------------------------------------------------

describe('Output structure', () => {
  const sg = {
    name: 'OutGroup',
    prefix: '',
    comment: '',
    baseLevel: '5',
    despawnAfter: '',
    disabled: true,
    loot: [{ name: 'shared_loot', rolls: '1', chance: '80' }],
    spawns: [
      {
        name: 'Rat',
        import: '',
        flags: ['Wandering'],
        despawnAfter: '',
        activeFrom: '',
        activeTo: '',
        despawnLoot: false,
        immunities: [{ type: 'Element', value: 'Water', messageType: 'Say', message: '' }],
        loot: [],
        coordinates: [{ x: '3', y: '7' }],
        combat: {
          minDmg: '5',
          maxDmg: '15',
          offensiveElement: '',
          ac: '',
          mr: '',
          defensiveElement: ''
        },
        base: { level: '5', weakChance: '', strongChance: '', behaviorSet: '' },
        spec: {
          disabled: false,
          minCount: '2',
          maxCount: '4',
          maxPerInterval: '',
          interval: '60',
          limit: '',
          percentage: '',
          when: ''
        },
        hostility: {
          players: true,
          playerExceptCookie: '',
          playerOnlyCookie: '',
          monsters: false,
          monsterExceptCookie: '',
          monsterOnlyCookie: ''
        },
        cookies: []
      }
    ]
  }

  it('root element is SpawnGroup', async () => {
    const parsed = await parseRaw(serializeSpawngroupXml(sg))
    expect(parsed).toHaveProperty('SpawnGroup')
  })

  it('Name and BaseLevel attributes are present', async () => {
    const parsed = await parseRaw(serializeSpawngroupXml(sg))
    expect(parsed.SpawnGroup.$?.Name).toBe('OutGroup')
    expect(parsed.SpawnGroup.$?.BaseLevel).toBe('5')
  })

  it('Disabled="true" is written when disabled is true', async () => {
    const parsed = await parseRaw(serializeSpawngroupXml(sg))
    expect(parsed.SpawnGroup.$?.Disabled).toBe('true')
  })

  it('DespawnLoot is omitted when false', async () => {
    const parsed = await parseRaw(serializeSpawngroupXml(sg))
    expect(parsed.SpawnGroup.$?.DespawnLoot).toBeUndefined()
  })

  it('group-level Loot/Set has Name, Rolls, Chance attributes', async () => {
    const parsed = await parseRaw(serializeSpawngroupXml(sg))
    const set = parsed.SpawnGroup.Loot?.[0]?.Set?.[0]
    expect(set.$?.Name).toBe('shared_loot')
    expect(set.$?.Rolls).toBe('1')
    expect(set.$?.Chance).toBe('80')
  })

  it('Spawn has Name and Flags attributes', async () => {
    const parsed = await parseRaw(serializeSpawngroupXml(sg))
    const spawn = parsed.SpawnGroup.Spawns?.[0]?.Spawn?.[0]
    expect(spawn.$?.Name).toBe('Rat')
    expect(spawn.$?.Flags).toBe('Wandering')
  })

  it('Immunity has Type, MessageType and text content', async () => {
    const parsed = await parseRaw(serializeSpawngroupXml(sg))
    const imm = parsed.SpawnGroup.Spawns?.[0]?.Spawn?.[0]?.Immunities?.[0]?.Immunity?.[0]
    expect(imm.$?.Type).toBe('Element')
    expect(imm._).toBe('Water')
  })

  it('Coordinate has X and Y attributes', async () => {
    const parsed = await parseRaw(serializeSpawngroupXml(sg))
    const coord = parsed.SpawnGroup.Spawns?.[0]?.Spawn?.[0]?.Coordinates?.[0]?.Coordinate?.[0]
    expect(coord.$?.X).toBe('3')
    expect(coord.$?.Y).toBe('7')
  })

  it('Damage element has MinDmg and MaxDmg', async () => {
    const parsed = await parseRaw(serializeSpawngroupXml(sg))
    const dmg = parsed.SpawnGroup.Spawns?.[0]?.Spawn?.[0]?.Damage?.[0]
    expect(dmg.$?.MinDmg).toBe('5')
    expect(dmg.$?.MaxDmg).toBe('15')
  })

  it('Spec has MinCount and Interval attributes', async () => {
    const parsed = await parseRaw(serializeSpawngroupXml(sg))
    const spec = parsed.SpawnGroup.Spawns?.[0]?.Spawn?.[0]?.Spec?.[0]
    expect(spec.$?.MinCount).toBe('2')
    expect(spec.$?.Interval).toBe('60')
  })

  it('Hostility/Players is present when players is true', async () => {
    const parsed = await parseRaw(serializeSpawngroupXml(sg))
    const hos = parsed.SpawnGroup.Spawns?.[0]?.Spawn?.[0]?.Hostility?.[0]
    expect(hos?.Players).toBeDefined()
    expect(hos?.Monsters).toBeUndefined()
  })

  it('omits spawn Loot when array is empty', async () => {
    const parsed = await parseRaw(serializeSpawngroupXml(sg))
    expect(parsed.SpawnGroup.Spawns?.[0]?.Spawn?.[0]?.Loot).toBeUndefined()
  })
})
