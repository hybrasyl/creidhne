import { describe, it, expect } from 'vitest'
import { parseNpcXml, serializeNpcXml } from '../npcXml.js'
import xml2js from 'xml2js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// NOTE on displayName fallback:
// The serializer writes `npc.displayName || npc.name`, so an empty displayName
// is silently replaced by name during serialization. A round-trip starting with
// { displayName: '' } will therefore return { displayName: name } — intentional
// behaviour, but not a true identity round-trip. FULL_XML uses an explicit
// displayName to keep the round-trip test clean. The fallback is tested
// separately in the "all fields" block.

const FULL_XML = `<?xml version="1.0"?>
<!-- Comment: The innkeeper -->
<Npc xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02">
  <!-- creidhne:meta {"job":"Innkeeper","location":"Mileth Inn"} -->
  <Name>maid-marion</Name>
  <DisplayName>Maid Marion</DisplayName>
  <Appearance Sprite="42" Portrait="marion.png" />
  <AllowDead>true</AllowDead>
  <Responses>
    <Response Call="greeting">Welcome to the inn!</Response>
    <Response Call="farewell">Safe travels.</Response>
  </Responses>
  <Strings>
    <String Key="inn-name">The Wanderer's Rest</String>
  </Strings>
  <Roles>
    <Bank ExceptCookie="banned">
      <CostAdjustment Nation="Mileth">0.95</CostAdjustment>
    </Bank>
    <Post Nation="Mileth" OnlyCookie="citizen">
      <CostAdjustment Nation="Mileth">0.90</CostAdjustment>
    </Post>
    <Repair Type="Armor" ExceptCookie="untrusted">
      <CostAdjustment Nation="Mileth">0.85</CostAdjustment>
    </Repair>
    <Vend OnlyCookie="guild-member">
      <Items>
        <Item Name="Bread" Quantity="5" Restock="1" />
        <Item Name="Water" Quantity="10" />
      </Items>
      <CostAdjustment Nation="Suomi">0.80</CostAdjustment>
    </Vend>
    <Train ExceptCookie="novice-only">
      <Castable Name="Ao Beag Cradh" Type="Spell" Class="Priest" />
      <Castable Name="Lam" Type="Skill" Class="Warrior" />
      <CostAdjustment>0.75</CostAdjustment>
    </Train>
  </Roles>
</Npc>`

const MINIMAL_XML = `<?xml version="1.0"?>
<Npc xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02">
  <Name>plain-npc</Name>
  <DisplayName>Plain NPC</DisplayName>
  <Appearance />
</Npc>`

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
  it('serializing a parsed NPC and re-parsing yields the same object', async () => {
    const first = await parseNpcXml(FULL_XML)
    const xml = serializeNpcXml(first)
    const second = await parseNpcXml(xml)
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Field coverage — all optional fields present
// ---------------------------------------------------------------------------

describe('Field coverage — all fields', () => {
  it('parses name', async () => {
    const npc = await parseNpcXml(FULL_XML)
    expect(npc.name).toBe('maid-marion')
  })

  it('parses displayName', async () => {
    const npc = await parseNpcXml(FULL_XML)
    expect(npc.displayName).toBe('Maid Marion')
  })

  it('parses comment', async () => {
    const npc = await parseNpcXml(FULL_XML)
    expect(npc.comment).toBe('The innkeeper')
  })

  it('parses meta job and location', async () => {
    const npc = await parseNpcXml(FULL_XML)
    expect(npc.meta.job).toBe('Innkeeper')
    expect(npc.meta.location).toBe('Mileth Inn')
  })

  it('parses sprite and portrait from Appearance', async () => {
    const npc = await parseNpcXml(FULL_XML)
    expect(npc.sprite).toBe('42')
    expect(npc.portrait).toBe('marion.png')
  })

  it('parses allowDead as boolean true', async () => {
    const npc = await parseNpcXml(FULL_XML)
    expect(npc.allowDead).toBe(true)
  })

  it('parses responses', async () => {
    const npc = await parseNpcXml(FULL_XML)
    expect(npc.responses).toHaveLength(2)
    expect(npc.responses[0]).toEqual({ call: 'greeting', response: 'Welcome to the inn!' })
    expect(npc.responses[1]).toEqual({ call: 'farewell', response: 'Safe travels.' })
  })

  it('parses strings', async () => {
    const npc = await parseNpcXml(FULL_XML)
    expect(npc.strings).toHaveLength(1)
    expect(npc.strings[0]).toEqual({ key: 'inn-name', message: "The Wanderer's Rest" })
  })

  it('defaults disableForget to false when Roles has no DisableForget attribute', async () => {
    const npc = await parseNpcXml(FULL_XML)
    expect(npc.roles.disableForget).toBe(false)
  })

  it('parses bank role with CostAdjustment', async () => {
    const npc = await parseNpcXml(FULL_XML)
    expect(npc.roles.bank).not.toBeNull()
    expect(npc.roles.bank.exceptCookie).toBe('banned')
    expect(npc.roles.bank.adjustments).toHaveLength(1)
    expect(npc.roles.bank.adjustments[0]).toEqual({ nation: 'Mileth', value: '0.95' })
  })

  it('parses post role with nation and CostAdjustment', async () => {
    const npc = await parseNpcXml(FULL_XML)
    expect(npc.roles.post).not.toBeNull()
    expect(npc.roles.post.nation).toBe('Mileth')
    expect(npc.roles.post.onlyCookie).toBe('citizen')
    expect(npc.roles.post.adjustments[0]).toEqual({ nation: 'Mileth', value: '0.90' })
  })

  it('parses repair role with type and CostAdjustment', async () => {
    const npc = await parseNpcXml(FULL_XML)
    expect(npc.roles.repair).not.toBeNull()
    expect(npc.roles.repair.type).toBe('Armor')
    expect(npc.roles.repair.exceptCookie).toBe('untrusted')
    expect(npc.roles.repair.adjustments[0]).toEqual({ nation: 'Mileth', value: '0.85' })
  })

  it('parses vend role with items and CostAdjustment', async () => {
    const npc = await parseNpcXml(FULL_XML)
    expect(npc.roles.vend).not.toBeNull()
    expect(npc.roles.vend.onlyCookie).toBe('guild-member')
    expect(npc.roles.vend.items).toHaveLength(2)
    expect(npc.roles.vend.items[0]).toEqual({ name: 'Bread', quantity: '5', restock: '1' })
    expect(npc.roles.vend.items[1]).toEqual({ name: 'Water', quantity: '10', restock: '' })
    expect(npc.roles.vend.adjustments).toHaveLength(1)
    expect(npc.roles.vend.adjustments[0]).toEqual({ nation: 'Suomi', value: '0.80' })
  })

  it('parses train role with castables and CostAdjustment', async () => {
    const npc = await parseNpcXml(FULL_XML)
    expect(npc.roles.train).not.toBeNull()
    expect(npc.roles.train.exceptCookie).toBe('novice-only')
    expect(npc.roles.train.castables).toHaveLength(2)
    expect(npc.roles.train.castables[0]).toEqual({
      name: 'Ao Beag Cradh',
      type: 'Spell',
      class: 'Priest'
    })
    expect(npc.roles.train.castables[1]).toEqual({ name: 'Lam', type: 'Skill', class: 'Warrior' })
    expect(npc.roles.train.adjustments).toHaveLength(1)
    expect(npc.roles.train.adjustments[0]).toEqual({ nation: '', value: '0.75' })
  })

  it('displayName fallback: empty displayName serializes as name, round-trips as name', async () => {
    const npc = await parseNpcXml(FULL_XML)
    const withEmptyDisplay = { ...npc, displayName: '' }
    const xml = serializeNpcXml(withEmptyDisplay)
    const reparsed = await parseNpcXml(xml)
    expect(reparsed.displayName).toBe(npc.name)
  })
})

// ---------------------------------------------------------------------------
// Test 3: Field coverage — minimal (required fields only)
// ---------------------------------------------------------------------------

describe('Field coverage — minimal', () => {
  it('parses name', async () => {
    const npc = await parseNpcXml(MINIMAL_XML)
    expect(npc.name).toBe('plain-npc')
  })

  it('parses displayName', async () => {
    const npc = await parseNpcXml(MINIMAL_XML)
    expect(npc.displayName).toBe('Plain NPC')
  })

  it('defaults comment to empty string', async () => {
    const npc = await parseNpcXml(MINIMAL_XML)
    expect(npc.comment).toBe('')
  })

  it('defaults meta job and location to empty string', async () => {
    const npc = await parseNpcXml(MINIMAL_XML)
    expect(npc.meta).toEqual({ job: '', location: '' })
  })

  it('defaults sprite and portrait to empty string', async () => {
    const npc = await parseNpcXml(MINIMAL_XML)
    expect(npc.sprite).toBe('')
    expect(npc.portrait).toBe('')
  })

  it('defaults allowDead to false', async () => {
    const npc = await parseNpcXml(MINIMAL_XML)
    expect(npc.allowDead).toBe(false)
  })

  it('defaults responses to empty array', async () => {
    const npc = await parseNpcXml(MINIMAL_XML)
    expect(npc.responses).toEqual([])
  })

  it('defaults strings to empty array', async () => {
    const npc = await parseNpcXml(MINIMAL_XML)
    expect(npc.strings).toEqual([])
  })

  it('defaults all roles to null and disableForget to false', async () => {
    const npc = await parseNpcXml(MINIMAL_XML)
    expect(npc.roles.disableForget).toBe(false)
    expect(npc.roles.bank).toBeNull()
    expect(npc.roles.post).toBeNull()
    expect(npc.roles.repair).toBeNull()
    expect(npc.roles.vend).toBeNull()
    expect(npc.roles.train).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Test 4: Output structure
// Serialize an NPC and re-parse it with xml2js to assert the output XML has
// the expected elements, attributes, and nesting. These are structural
// assertions written by hand from the code — they do NOT perform real XSD
// validation and will not catch divergences between creidhne and the XSD.
// NOTE: creidhne's NPC role structure (CostAdjustment, ExceptCookie, OnlyCookie)
// is ahead of the current XSD, which reflects an older server format.
// ---------------------------------------------------------------------------

describe('Output structure', () => {
  const npc = {
    name: 'schema-npc',
    displayName: 'Schema NPC',
    comment: '',
    meta: { job: 'Merchant', location: '' },
    sprite: '10',
    portrait: '',
    allowDead: false,
    responses: [{ call: 'greet', response: 'Hello!' }],
    strings: [{ key: 'tagline', message: 'Best deals in town.' }],
    roles: {
      disableForget: false,
      bank: null,
      post: null,
      repair: null,
      vend: {
        exceptCookie: '',
        onlyCookie: '',
        items: [{ name: 'Sword', quantity: '1', restock: '' }],
        adjustments: [{ nation: 'Mileth', value: '0.90' }]
      },
      train: {
        exceptCookie: '',
        onlyCookie: '',
        castables: [{ name: 'Punch', type: 'Skill', class: 'Warrior' }],
        adjustments: [{ nation: '', value: '0.85' }]
      }
    }
  }

  it('serializes valid XML that re-parses without error', async () => {
    const xml = serializeNpcXml(npc)
    await expect(parseRaw(xml)).resolves.toBeDefined()
  })

  it('root element is Npc', async () => {
    const xml = serializeNpcXml(npc)
    const parsed = await parseRaw(xml)
    expect(parsed).toHaveProperty('Npc')
  })

  it('Name element is present and non-empty', async () => {
    const xml = serializeNpcXml(npc)
    const parsed = await parseRaw(xml)
    const name = parsed.Npc.Name?.[0]
    expect(typeof name).toBe('string')
    expect(name.length).toBeGreaterThanOrEqual(1)
  })

  it('DisplayName element is present', async () => {
    const xml = serializeNpcXml(npc)
    const parsed = await parseRaw(xml)
    expect(parsed.Npc.DisplayName?.[0]).toBeDefined()
  })

  it('Appearance element is present', async () => {
    const xml = serializeNpcXml(npc)
    const parsed = await parseRaw(xml)
    expect(parsed.Npc.Appearance).toBeDefined()
  })

  it('omits AllowDead element when false', async () => {
    const xml = serializeNpcXml({ ...npc, allowDead: false })
    const parsed = await parseRaw(xml)
    expect(parsed.Npc.AllowDead).toBeUndefined()
  })

  it('includes AllowDead element with value "true" when true', async () => {
    const xml = serializeNpcXml({ ...npc, allowDead: true })
    const parsed = await parseRaw(xml)
    expect(parsed.Npc.AllowDead?.[0]).toBe('true')
  })

  it('Response elements have a Call attribute and text content', async () => {
    const xml = serializeNpcXml(npc)
    const parsed = await parseRaw(xml)
    const responses = parsed.Npc.Responses?.[0]?.Response ?? []
    for (const r of responses) {
      expect(typeof r.$?.Call).toBe('string')
      expect(r.$?.Call.length).toBeGreaterThan(0)
      expect(typeof r._).toBe('string')
    }
  })

  it('String elements have a Key attribute and text content', async () => {
    const xml = serializeNpcXml(npc)
    const parsed = await parseRaw(xml)
    const strings = parsed.Npc.Strings?.[0]?.String ?? []
    for (const s of strings) {
      expect(typeof s.$?.Key).toBe('string')
      expect(typeof s._).toBe('string')
    }
  })

  it('Vend/Items/Item elements have a Name attribute', async () => {
    const xml = serializeNpcXml(npc)
    const parsed = await parseRaw(xml)
    const items = parsed.Npc.Roles?.[0]?.Vend?.[0]?.Items?.[0]?.Item ?? []
    for (const item of items) {
      expect(typeof item.$?.Name).toBe('string')
      expect(item.$?.Name.length).toBeGreaterThan(0)
    }
  })

  it('Vend/CostAdjustment has Nation attribute and text value', async () => {
    const xml = serializeNpcXml(npc)
    const parsed = await parseRaw(xml)
    const adj = parsed.Npc.Roles?.[0]?.Vend?.[0]?.CostAdjustment?.[0]
    expect(adj).toBeDefined()
    expect(adj.$?.Nation).toBe('Mileth')
    expect(adj._).toBe('0.90')
  })

  it('Train/Castable elements have a Name attribute', async () => {
    const xml = serializeNpcXml(npc)
    const parsed = await parseRaw(xml)
    const castables = parsed.Npc.Roles?.[0]?.Train?.[0]?.Castable ?? []
    for (const c of castables) {
      expect(typeof c.$?.Name).toBe('string')
      expect(c.$?.Name.length).toBeGreaterThan(0)
    }
  })

  it('Train/CostAdjustment has text value', async () => {
    const xml = serializeNpcXml(npc)
    const parsed = await parseRaw(xml)
    // no Nation on this fixture adj — xml2js returns a plain string when there are no attributes
    const adj = parsed.Npc.Roles?.[0]?.Train?.[0]?.CostAdjustment?.[0]
    expect(adj).toBeDefined()
    expect(typeof adj === 'string' ? adj : adj._).toBe('0.85')
  })

  it('omits Roles element when all roles are null', async () => {
    const noRoles = {
      ...npc,
      roles: { disableForget: false, bank: null, post: null, repair: null, vend: null, train: null }
    }
    const xml = serializeNpcXml(noRoles)
    const parsed = await parseRaw(xml)
    expect(parsed.Npc.Roles).toBeUndefined()
  })

  it('omits DisableForget attribute on Roles when false', async () => {
    const xml = serializeNpcXml(npc)
    const parsed = await parseRaw(xml)
    expect(parsed.Npc.Roles?.[0]?.$?.DisableForget).toBeUndefined()
  })

  it('writes DisableForget="true" on Roles when true', async () => {
    const withDisableForget = { ...npc, roles: { ...npc.roles, disableForget: true } }
    const xml = serializeNpcXml(withDisableForget)
    const parsed = await parseRaw(xml)
    expect(parsed.Npc.Roles?.[0]?.$?.DisableForget).toBe('true')
  })

  it('meta is injected as creidhne:meta comment when job is set', async () => {
    const xml = serializeNpcXml(npc)
    expect(xml).toContain('creidhne:meta')
    expect(xml).toContain('"job":"Merchant"')
  })

  it('meta comment is omitted when job and location are both empty', async () => {
    const noMeta = { ...npc, meta: { job: '', location: '' } }
    const xml = serializeNpcXml(noMeta)
    expect(xml).not.toContain('creidhne:meta')
  })
})

// ---------------------------------------------------------------------------
// Test 5: Regressions — annotations and role attributes destroyed on save
//
// Fixtures below are the production files the cards name, inlined rather than
// read from the world repo so the suite stays self-contained. Every value
// asserted here was verified to be LOST by the pre-fix serializer.
// ---------------------------------------------------------------------------

// ../world/xml/npcs/bank_antonio.xml — HTOO-237 (Bank) and HTOO-337 (Location)
const ANTONIO_XML = `<?xml version="1.0"?>
<Npc xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02">
  <Name>Antonio</Name>
  <!-- Location: Rucesion Bank -->
  <DisplayName>Antonio</DisplayName>
  <Appearance Sprite="56" Portrait="bank.spf"/>
  <Roles>
    <Bank Nation="Rucesion" Discount="20"/>
  </Roles>
</Npc>`

// ../world/xml/npcs/2gm_kerden.xml, trimmed to the roles — HTOO-237 (Post
// Surcharge, Repair Nation/Discount)
const KERDEN_ROLES_XML = `<?xml version="1.0"?>
<Npc xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02">
  <Name>Kerden</Name>
  <!-- Location: GM Test Area -->
  <!-- Comment: The boss -->
  <DisplayName>Kerden</DisplayName>
  <Appearance Sprite="34" Portrait="seba.spf"/>
  <Roles>
    <Bank Nation="Mileth" Discount="50"/>
    <Post Nation="Rucesion">
      <Surcharge Nation="Mileth" Percent="5"/>
      <Surcharge Nation="Abel" Percent="12"/>
    </Post>
    <Repair Nation="Loures" Discount="20" Type="All"/>
  </Roles>
</Npc>`

describe('Regression — the legacy Location annotation (HTOO-337)', () => {
  it('reads <!-- Location: --> into meta.location', async () => {
    const npc = await parseNpcXml(ANTONIO_XML)
    expect(npc.meta.location).toBe('Rucesion Bank')
  })

  it('writes the Location annotation back out', async () => {
    const xml = serializeNpcXml(await parseNpcXml(ANTONIO_XML))
    expect(xml).toContain('<!-- Location: Rucesion Bank -->')
  })

  it('survives a full round-trip', async () => {
    const once = serializeNpcXml(await parseNpcXml(ANTONIO_XML))
    const twice = serializeNpcXml(await parseNpcXml(once))
    expect(twice).toContain('<!-- Location: Rucesion Bank -->')
  })

  it('places Location after <Name>, where the world repo keeps it', async () => {
    const xml = serializeNpcXml(await parseNpcXml(ANTONIO_XML))
    expect(xml.indexOf('<!-- Location:')).toBeGreaterThan(xml.indexOf('</Name>'))
  })

  it('keeps Location and Comment together, in that order', async () => {
    const xml = serializeNpcXml(await parseNpcXml(KERDEN_ROLES_XML))
    expect(xml.indexOf('<!-- Location:')).toBeLessThan(xml.indexOf('<!-- Comment:'))
    expect(xml.indexOf('<!-- Comment:')).toBeLessThan(xml.indexOf('<DisplayName>'))
  })

  it('does not also write location into creidhne:meta (one home, not two)', async () => {
    const xml = serializeNpcXml(await parseNpcXml(ANTONIO_XML))
    expect(xml).not.toContain('creidhne:meta')
  })

  it('prefers a creidhne:meta location over the legacy annotation', async () => {
    const both = ANTONIO_XML.replace(
      '<Name>Antonio</Name>',
      '<!-- creidhne:meta {"location":"Newer Value"} -->\n  <Name>Antonio</Name>'
    )
    const npc = await parseNpcXml(both)
    expect(npc.meta.location).toBe('Newer Value')
  })

  it('omits the annotation entirely when there is no location or comment', async () => {
    const xml = serializeNpcXml(await parseNpcXml(MINIMAL_XML))
    expect(xml).not.toContain('<!-- Location:')
    expect(xml).not.toContain('<!-- Comment:')
  })
})

describe('Regression — Roles pricing attributes (HTOO-237)', () => {
  it('parses Bank Nation and Discount', async () => {
    const npc = await parseNpcXml(ANTONIO_XML)
    expect(npc.roles.bank.nation).toBe('Rucesion')
    expect(npc.roles.bank.discount).toBe('20')
  })

  it('serializes Bank Nation and Discount', async () => {
    const xml = serializeNpcXml(await parseNpcXml(ANTONIO_XML))
    const parsed = await parseRaw(xml)
    expect(parsed.Npc.Roles[0].Bank[0].$).toMatchObject({
      Nation: 'Rucesion',
      Discount: '20'
    })
  })

  it('parses Repair Nation and Discount alongside Type', async () => {
    const npc = await parseNpcXml(KERDEN_ROLES_XML)
    expect(npc.roles.repair).toMatchObject({
      nation: 'Loures',
      discount: '20',
      type: 'All'
    })
  })

  it('serializes Repair Nation, Discount and Type', async () => {
    const xml = serializeNpcXml(await parseNpcXml(KERDEN_ROLES_XML))
    const parsed = await parseRaw(xml)
    expect(parsed.Npc.Roles[0].Repair[0].$).toMatchObject({
      Nation: 'Loures',
      Discount: '20',
      Type: 'All'
    })
  })

  it('parses every Post Surcharge', async () => {
    const npc = await parseNpcXml(KERDEN_ROLES_XML)
    expect(npc.roles.post.surcharges).toEqual([
      { nation: 'Mileth', percent: '5' },
      { nation: 'Abel', percent: '12' }
    ])
  })

  it('serializes every Post Surcharge', async () => {
    const xml = serializeNpcXml(await parseNpcXml(KERDEN_ROLES_XML))
    const parsed = await parseRaw(xml)
    const surcharges = parsed.Npc.Roles[0].Post[0].Surcharge.map((s) => s.$)
    expect(surcharges).toEqual([
      { Nation: 'Mileth', Percent: '5' },
      { Nation: 'Abel', Percent: '12' }
    ])
  })

  // Shapes taken from ../world/xml/npcs/!test_bleah.xml, the one file that
  // exercises ExceptCookie / OnlyCookie / CostAdjustment on every role and
  // carries none of the pricing attributes. It is the real-world case for "the
  // new fields are absent", so the defaults are pinned against it rather than
  // against an attribute-less element, which does not occur in the world at all
  // (and which xml2js reports as '' rather than as an object).
  const COOKIES_XML = `<?xml version="1.0"?>
<Npc xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02">
  <Name>bleah</Name>
  <DisplayName>Bleah</DisplayName>
  <Appearance Sprite="1"/>
  <Roles DisableForget="true">
    <Bank ExceptCookie="A23T" OnlyCookie="A24">
      <CostAdjustment Nation="Itinerant">.5</CostAdjustment>
    </Bank>
    <Post Nation="Undine" ExceptCookie="A74" OnlyCookie="A63T">
      <CostAdjustment Nation="Undine">.1</CostAdjustment>
    </Post>
    <Repair Type="All" ExceptCookie="A74T" OnlyCookie="A74T">
      <CostAdjustment Nation="Tagor">.1</CostAdjustment>
    </Repair>
  </Roles>
</Npc>`

  it('defaults the new fields to empty without disturbing the old ones', async () => {
    const npc = await parseNpcXml(COOKIES_XML)
    expect(npc.roles.bank).toMatchObject({
      nation: '',
      discount: '',
      exceptCookie: 'A23T',
      onlyCookie: 'A24'
    })
    expect(npc.roles.repair).toMatchObject({ nation: '', discount: '', type: 'All' })
    expect(npc.roles.post.surcharges).toEqual([])
  })

  it('omits the new attributes and Surcharge entirely when absent', async () => {
    const parsed = await parseRaw(serializeNpcXml(await parseNpcXml(COOKIES_XML)))
    const roles = parsed.Npc.Roles[0]
    expect(roles.Bank[0].$).toEqual({ ExceptCookie: 'A23T', OnlyCookie: 'A24' })
    expect(roles.Repair[0].$.Nation).toBeUndefined()
    expect(roles.Repair[0].$.Discount).toBeUndefined()
    expect(roles.Post[0].Surcharge).toBeUndefined()
  })

  it('round-trips the cookie/adjustment file without losing a value', async () => {
    const first = await parseNpcXml(COOKIES_XML)
    const second = await parseNpcXml(serializeNpcXml(first))
    expect(second).toEqual(first)
  })

  it('round-trips the whole of kerden without losing a value', async () => {
    const first = await parseNpcXml(KERDEN_ROLES_XML)
    const second = await parseNpcXml(serializeNpcXml(first))
    expect(second).toEqual(first)
  })
})
