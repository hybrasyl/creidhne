import { describe, it, expect } from 'vitest'
import { parseLocalizationXml, serializeLocalizationXml } from '../localizationXml.js'
import xml2js from 'xml2js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Five string sections: Common, Merchant, NpcSpeak, MonsterSpeak, NpcResponses.
// Common/Merchant/NpcSpeak/MonsterSpeak hold <String Key="...">message</String> entries.
// NpcResponses holds <Response Call="...">message</Response> entries.
// All sections are omitted from output XML when empty.

const FULL_XML = `<?xml version="1.0" encoding="utf-8"?>
<!-- Comment: Test localization strings -->
<Localization xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Locale="en-US">
  <Common>
    <String Key="greeting">Hello, traveler!</String>
    <String Key="farewell">Safe travels.</String>
  </Common>
  <Merchant>
    <String Key="welcome">Welcome to my shop!</String>
  </Merchant>
  <NpcSpeak>
    <String Key="npcgreeting">Greetings, friend.</String>
  </NpcSpeak>
  <MonsterSpeak>
    <String Key="aggro">You dare enter my lair?</String>
  </MonsterSpeak>
  <NpcResponses>
    <Response Call="help">I can assist you.</Response>
    <Response Call="quest">Seek the lost relic.</Response>
  </NpcResponses>
</Localization>`

const MINIMAL_XML = `<?xml version="1.0" encoding="utf-8"?>
<Localization xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Locale="en-US">
</Localization>`

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
  it('serializing a parsed localization and re-parsing yields the same object', async () => {
    const first = await parseLocalizationXml(FULL_XML)
    const xml = serializeLocalizationXml(first)
    const second = await parseLocalizationXml(xml)
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Field coverage — all fields
// ---------------------------------------------------------------------------

describe('Field coverage — all fields', () => {
  it('parses locale attribute', async () => {
    const l = await parseLocalizationXml(FULL_XML)
    expect(l.locale).toBe('en-US')
  })

  it('parses comment', async () => {
    const l = await parseLocalizationXml(FULL_XML)
    expect(l.comment).toBe('Test localization strings')
  })

  it('parses common strings count', async () => {
    const l = await parseLocalizationXml(FULL_XML)
    expect(l.common).toHaveLength(2)
  })

  it('parses common string key and message', async () => {
    const l = await parseLocalizationXml(FULL_XML)
    expect(l.common[0]).toEqual({ key: 'greeting', message: 'Hello, traveler!' })
    expect(l.common[1]).toEqual({ key: 'farewell', message: 'Safe travels.' })
  })

  it('parses merchant strings', async () => {
    const l = await parseLocalizationXml(FULL_XML)
    expect(l.merchant).toHaveLength(1)
    expect(l.merchant[0]).toEqual({ key: 'welcome', message: 'Welcome to my shop!' })
  })

  it('parses npcSpeak strings', async () => {
    const l = await parseLocalizationXml(FULL_XML)
    expect(l.npcSpeak).toHaveLength(1)
    expect(l.npcSpeak[0]).toEqual({ key: 'npcgreeting', message: 'Greetings, friend.' })
  })

  it('parses monsterSpeak strings', async () => {
    const l = await parseLocalizationXml(FULL_XML)
    expect(l.monsterSpeak).toHaveLength(1)
    expect(l.monsterSpeak[0]).toEqual({ key: 'aggro', message: 'You dare enter my lair?' })
  })

  it('parses npcResponses count', async () => {
    const l = await parseLocalizationXml(FULL_XML)
    expect(l.npcResponses).toHaveLength(2)
  })

  it('parses npcResponse call and response text', async () => {
    const l = await parseLocalizationXml(FULL_XML)
    expect(l.npcResponses[0]).toEqual({ call: 'help', response: 'I can assist you.' })
    expect(l.npcResponses[1]).toEqual({ call: 'quest', response: 'Seek the lost relic.' })
  })
})

// ---------------------------------------------------------------------------
// Test 3: Field coverage — minimal
// ---------------------------------------------------------------------------

describe('Field coverage — minimal', () => {
  it('parses locale', async () => {
    const l = await parseLocalizationXml(MINIMAL_XML)
    expect(l.locale).toBe('en-US')
  })

  it('defaults comment to empty string', async () => {
    const l = await parseLocalizationXml(MINIMAL_XML)
    expect(l.comment).toBe('')
  })

  it('defaults common to empty array', async () => {
    const l = await parseLocalizationXml(MINIMAL_XML)
    expect(l.common).toEqual([])
  })

  it('defaults merchant to empty array', async () => {
    const l = await parseLocalizationXml(MINIMAL_XML)
    expect(l.merchant).toEqual([])
  })

  it('defaults npcSpeak to empty array', async () => {
    const l = await parseLocalizationXml(MINIMAL_XML)
    expect(l.npcSpeak).toEqual([])
  })

  it('defaults monsterSpeak to empty array', async () => {
    const l = await parseLocalizationXml(MINIMAL_XML)
    expect(l.monsterSpeak).toEqual([])
  })

  it('defaults npcResponses to empty array', async () => {
    const l = await parseLocalizationXml(MINIMAL_XML)
    expect(l.npcResponses).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Test 4: Output structure
// Serialize a localization object and re-parse it with xml2js to assert the
// output XML has the expected elements, attributes, and nesting. These are
// structural assertions written by hand from the code — they do NOT perform
// real XSD validation and will not catch divergences between creidhne and the XSD.
// ---------------------------------------------------------------------------

describe('Output structure', () => {
  const loc = {
    locale: 'en-US',
    comment: '',
    common: [{ key: 'hello', message: 'Hello!' }],
    merchant: [{ key: 'buy', message: 'Buy something.' }],
    npcSpeak: [{ key: 'npcline', message: 'Well met.' }],
    monsterSpeak: [{ key: 'roar', message: 'Roar!' }],
    npcResponses: [{ call: 'greet', response: 'Greetings!' }]
  }

  it('root element is Localization', async () => {
    const parsed = await parseRaw(serializeLocalizationXml(loc))
    expect(parsed).toHaveProperty('Localization')
  })

  it('Locale attribute is present', async () => {
    const parsed = await parseRaw(serializeLocalizationXml(loc))
    expect(parsed.Localization.$?.Locale).toBe('en-US')
  })

  it('Common/String has Key attribute and text content', async () => {
    const parsed = await parseRaw(serializeLocalizationXml(loc))
    const s = parsed.Localization.Common?.[0]?.String?.[0]
    expect(s.$?.Key).toBe('hello')
    expect(s._).toBe('Hello!')
  })

  it('Merchant/String has Key attribute and text content', async () => {
    const parsed = await parseRaw(serializeLocalizationXml(loc))
    const s = parsed.Localization.Merchant?.[0]?.String?.[0]
    expect(s.$?.Key).toBe('buy')
    expect(s._).toBe('Buy something.')
  })

  it('NpcSpeak/String has Key attribute and text content', async () => {
    const parsed = await parseRaw(serializeLocalizationXml(loc))
    const s = parsed.Localization.NpcSpeak?.[0]?.String?.[0]
    expect(s.$?.Key).toBe('npcline')
    expect(s._).toBe('Well met.')
  })

  it('MonsterSpeak/String has Key attribute and text content', async () => {
    const parsed = await parseRaw(serializeLocalizationXml(loc))
    const s = parsed.Localization.MonsterSpeak?.[0]?.String?.[0]
    expect(s.$?.Key).toBe('roar')
    expect(s._).toBe('Roar!')
  })

  it('NpcResponses/Response has Call attribute and text content', async () => {
    const parsed = await parseRaw(serializeLocalizationXml(loc))
    const r = parsed.Localization.NpcResponses?.[0]?.Response?.[0]
    expect(r.$?.Call).toBe('greet')
    expect(r._).toBe('Greetings!')
  })

  it('omits Common element when empty', async () => {
    const parsed = await parseRaw(serializeLocalizationXml({ ...loc, common: [] }))
    expect(parsed.Localization.Common).toBeUndefined()
  })

  it('omits Merchant element when empty', async () => {
    const parsed = await parseRaw(serializeLocalizationXml({ ...loc, merchant: [] }))
    expect(parsed.Localization.Merchant).toBeUndefined()
  })

  it('omits NpcSpeak element when empty', async () => {
    const parsed = await parseRaw(serializeLocalizationXml({ ...loc, npcSpeak: [] }))
    expect(parsed.Localization.NpcSpeak).toBeUndefined()
  })

  it('omits MonsterSpeak element when empty', async () => {
    const parsed = await parseRaw(serializeLocalizationXml({ ...loc, monsterSpeak: [] }))
    expect(parsed.Localization.MonsterSpeak).toBeUndefined()
  })

  it('omits NpcResponses element when empty', async () => {
    const parsed = await parseRaw(serializeLocalizationXml({ ...loc, npcResponses: [] }))
    expect(parsed.Localization.NpcResponses).toBeUndefined()
  })
})
