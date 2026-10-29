import { describe, it, expect } from 'vitest'
import { parseElementTableXml, serializeElementTableXml } from '../elementTableXml.js'
import { setPair } from '../../shared/elementTable.js'
import xml2js from 'xml2js'

// The element table parser and serializer (HTOO-581). A save writes back every
// attribute and pair that the file declared, and no pair that it left out.
// Multipliers stay the file's text: a percentage model saved 1.075 as 1.07.

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

// The old format, as world and ceridwen hold it: no <Elements>, every pair.
const LEGACY_XML = `<?xml version="1.0"?>
<ElementTable xmlns="${XMLNS}" Name="TestTable">
  <!-- Comment: Test element table -->
  <Source Element="Fire">
    <Target Element="Fire" Multiplier="1"/>
    <Target Element="Wind" Multiplier="0.8"/>
    <Target Element="Earth" Multiplier="1.075"/>
  </Source>
  <Source Element="Wind">
    <Target Element="Fire" Multiplier="1.2"/>
    <Target Element="Wind" Multiplier="1"/>
    <Target Element="Earth" Multiplier="0.9"/>
  </Source>
  <Source Element="Earth">
    <Target Element="Fire" Multiplier="0.8"/>
    <Target Element="Wind" Multiplier="1"/>
    <Target Element="Earth" Multiplier="1"/>
  </Source>
</ElementTable>`

// A sparse table: a table default, and pairs left out.
const SPARSE_XML = `<?xml version="1.0"?>
<ElementTable xmlns="${XMLNS}" Name="Sparse" DefaultMultiplier="0.9">
  <Source Element="Fire">
    <Target Element="Wind" Multiplier="1.2"/>
  </Source>
  <Source Element="Wind">
    <Target Element="Earth" Multiplier="1.1"/>
  </Source>
</ElementTable>`

// The registry format, from the HXML-24 design's example.
const REGISTRY_XML = `<?xml version="1.0"?>
<ElementTable xmlns="${XMLNS}" Name="HybElements2" DefaultMultiplier="1.0">
  <Elements>
    <Element Key="Force" Id="0" RetailId="0" Default="true" Ivernic="treas"/>
    <Element Key="Fire" Id="1" RetailId="1" Ivernic="srad"/>
    <Element Key="Nature" Id="17" RetailId="7" Name="Nature" Ivernic="dúl"/>
    <Element Key="Undead" Id="9" RetailId="9"/>
  </Elements>
  <Groups>
    <Group Key="Classic" Members="Fire Nature"/>
    <Group Key="Weighted" Members="Fire Fire Nature"/>
  </Groups>
  <Source Element="Fire">
    <Target Element="Nature" Multiplier="1.2"/>
  </Source>
  <Source Element="Undead" DefaultMultiplier="1.2">
    <Target Element="Undead" Multiplier="0.5"/>
  </Source>
  <Source Element="Nature" DefaultMultiplier="0.75"/>
</ElementTable>`

const MINIMAL_XML = `<?xml version="1.0"?>
<ElementTable xmlns="${XMLNS}" Name="EmptyTable">
</ElementTable>`

function parseRaw(xmlString) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}

/** The XML with self-closing spacing and line endings made the same. */
const norm = (s) =>
  s
    .replace(/\r\n/g, '\n')
    .replace(/\s+\/>/g, '/>')
    .trim()

describe('round trip', () => {
  it.each([
    ['the old format', LEGACY_XML],
    ['a sparse table', SPARSE_XML],
    ['the registry format', REGISTRY_XML]
  ])('%s saves to the same XML with no edit', async (_, xml) => {
    const out = serializeElementTableXml(await parseElementTableXml(xml))
    expect(norm(out)).toBe(norm(xml))
  })

  it('keeps the multiplier text, so 1.075 does not become 1.07', async () => {
    const out = serializeElementTableXml(await parseElementTableXml(LEGACY_XML))
    expect(out).toContain('Multiplier="1.075"')
  })
})

describe('the old format', () => {
  it('takes the elements from the Source rows', async () => {
    const t = await parseElementTableXml(LEGACY_XML)
    expect(t.registry).toBe(false)
    expect(t.elements.map((e) => e.key)).toEqual(['Fire', 'Wind', 'Earth'])
    expect(t.elements[0]).toEqual({
      key: 'Fire',
      id: '',
      retailId: '',
      name: '',
      isDefault: false,
      ivernic: ''
    })
  })

  it('writes no <Elements> block', async () => {
    const raw = await parseRaw(serializeElementTableXml(await parseElementTableXml(LEGACY_XML)))
    expect(raw.ElementTable.Elements).toBeUndefined()
  })

  it('reads the comment and the name', async () => {
    const t = await parseElementTableXml(LEGACY_XML)
    expect(t.comment).toBe('Test element table')
    expect(t.name).toBe('TestTable')
  })
})

describe('a sparse table', () => {
  it('reads the table default and only the declared pairs', async () => {
    const t = await parseElementTableXml(SPARSE_XML)
    expect(t.defaultMultiplier).toBe('0.9')
    expect(t.sources[0].targets).toEqual([{ element: 'Wind', multiplier: '1.2' }])
  })

  it('writes an edited pair and still leaves out the pairs the file left out', async () => {
    const t = setPair(await parseElementTableXml(SPARSE_XML), 'Fire', 'Earth', '1.5')
    const raw = await parseRaw(serializeElementTableXml(t))
    const fire = raw.ElementTable.Source[0].Target.map((x) => x.$)
    expect(fire).toEqual([
      { Element: 'Wind', Multiplier: '1.2' },
      { Element: 'Earth', Multiplier: '1.5' }
    ])
    expect(raw.ElementTable.Source[1].Target).toHaveLength(1)
  })

  it('does not write a pair that the editor cleared', async () => {
    const t = setPair(await parseElementTableXml(SPARSE_XML), 'Fire', 'Wind', '')
    const raw = await parseRaw(serializeElementTableXml(t))
    expect(raw.ElementTable.Source[0].Target).toBeUndefined()
    expect(raw.ElementTable.Source[0].$).toEqual({ Element: 'Fire' })
  })
})

describe('the registry format', () => {
  it('reads each element attribute', async () => {
    const t = await parseElementTableXml(REGISTRY_XML)
    expect(t.registry).toBe(true)
    expect(t.elements[0]).toEqual({
      key: 'Force',
      id: '0',
      retailId: '0',
      name: '',
      isDefault: true,
      ivernic: 'treas'
    })
    expect(t.elements[2]).toMatchObject({ key: 'Nature', id: '17', retailId: '7', name: 'Nature' })
  })

  it('reads the groups, keeping a member listed twice', async () => {
    const t = await parseElementTableXml(REGISTRY_XML)
    expect(t.groups).toEqual([
      { key: 'Classic', members: ['Fire', 'Nature'] },
      { key: 'Weighted', members: ['Fire', 'Fire', 'Nature'] }
    ])
  })

  it('reads a row default, and keeps a row with no Target entries', async () => {
    const t = await parseElementTableXml(REGISTRY_XML)
    expect(t.sources[1]).toEqual({
      element: 'Undead',
      defaultMultiplier: '1.2',
      targets: [{ element: 'Undead', multiplier: '0.5' }]
    })
    expect(t.sources[2]).toEqual({ element: 'Nature', defaultMultiplier: '0.75', targets: [] })
    const raw = await parseRaw(serializeElementTableXml(t))
    expect(raw.ElementTable.Source[2].$).toEqual({ Element: 'Nature', DefaultMultiplier: '0.75' })
  })

  it('writes Elements, then Groups, then the Source rows, as the schema orders them', async () => {
    const out = serializeElementTableXml(await parseElementTableXml(REGISTRY_XML))
    const at = (tag) => out.indexOf(`<${tag}`)
    expect(at('Elements')).toBeLessThan(at('Groups'))
    expect(at('Groups')).toBeLessThan(at('Source'))
  })
})

describe('a minimal table', () => {
  it('reads empty lists', async () => {
    const t = await parseElementTableXml(MINIMAL_XML)
    expect(t).toMatchObject({
      name: 'EmptyTable',
      comment: '',
      defaultMultiplier: '',
      registry: false,
      elements: [],
      groups: [],
      sources: []
    })
  })
})
