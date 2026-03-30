import { describe, it, expect } from 'vitest'
import { parseElementTableXml, serializeElementTableXml } from '../elementTableXml.js'
import xml2js from 'xml2js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// XML always uses floats (1.0, 0.8, 1.5). The editor represents these as
// integers for simplicity: 100 = 1.0, 80 = 0.8, 150 = 1.5, etc.
// The parser converts floats → integers; the serializer converts back.
// The XML default for a missing target is 1 (float), which the parser
// represents as 100 (integer).

const FULL_XML = `<?xml version="1.0"?>
<!-- Comment: Test element table -->
<ElementTable xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="TestTable">
  <Source Element="Fire">
    <Target Element="Fire" Multiplier="1" />
    <Target Element="Wind" Multiplier="0.8" />
    <Target Element="Earth" Multiplier="1.5" />
  </Source>
  <Source Element="Wind">
    <Target Element="Fire" Multiplier="1.2" />
    <Target Element="Wind" Multiplier="1" />
    <Target Element="Earth" Multiplier="0.9" />
  </Source>
  <Source Element="Earth">
    <Target Element="Fire" Multiplier="0.8" />
    <Target Element="Wind" Multiplier="1" />
    <Target Element="Earth" Multiplier="1" />
  </Source>
</ElementTable>`

const MINIMAL_XML = `<?xml version="1.0"?>
<ElementTable xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="EmptyTable">
</ElementTable>`

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
  it('serializing a parsed element table and re-parsing yields the same object', async () => {
    const first = await parseElementTableXml(FULL_XML)
    const xml = serializeElementTableXml(first)
    const second = await parseElementTableXml(xml)
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Field coverage — all fields
// ---------------------------------------------------------------------------

describe('Field coverage — all fields', () => {
  it('parses name attribute', async () => {
    const t = await parseElementTableXml(FULL_XML)
    expect(t.name).toBe('TestTable')
  })

  it('parses comment', async () => {
    const t = await parseElementTableXml(FULL_XML)
    expect(t.comment).toBe('Test element table')
  })

  it('parses elements in source order', async () => {
    const t = await parseElementTableXml(FULL_XML)
    expect(t.elements).toEqual(['Fire', 'Wind', 'Earth'])
  })

  it('matrix is NxN matching element count', async () => {
    const t = await parseElementTableXml(FULL_XML)
    expect(t.matrix).toHaveLength(3)
    expect(t.matrix[0]).toHaveLength(3)
  })

  it('neutral multiplier (1.0) becomes 100 in the matrix', async () => {
    const t = await parseElementTableXml(FULL_XML)
    expect(t.matrix[0][0]).toBe(100) // Fire → Fire
  })

  it('reduced multiplier (0.8) becomes 80 in the matrix', async () => {
    const t = await parseElementTableXml(FULL_XML)
    expect(t.matrix[0][1]).toBe(80)  // Fire → Wind
  })

  it('boosted multiplier (1.5) becomes 150 in the matrix', async () => {
    const t = await parseElementTableXml(FULL_XML)
    expect(t.matrix[0][2]).toBe(150) // Fire → Earth
  })

  it('fractional multiplier (1.2) becomes 120 in the matrix', async () => {
    const t = await parseElementTableXml(FULL_XML)
    expect(t.matrix[1][0]).toBe(120) // Wind → Fire
  })

  it('fractional multiplier (0.9) becomes 90 in the matrix', async () => {
    const t = await parseElementTableXml(FULL_XML)
    expect(t.matrix[1][2]).toBe(90)  // Wind → Earth
  })

  it('missing Target entry is treated as XML default 1.0, stored as integer 100', async () => {
    // Real XML files should always list all targets explicitly — the serializer
    // always does so. This tests the parser's defensive fallback for malformed
    // or hand-authored files where a Target entry is absent.
    const sparseXml = `<?xml version="1.0"?>
<ElementTable xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="Sparse">
  <Source Element="Fire">
    <Target Element="Wind" Multiplier="0.5" />
  </Source>
  <Source Element="Wind">
  </Source>
</ElementTable>`
    const t = await parseElementTableXml(sparseXml)
    expect(t.matrix[0][0]).toBe(100) // Fire → Fire: absent → defaults to 1.0 → 100
    expect(t.matrix[0][1]).toBe(50)  // Fire → Wind: explicit 0.5 → 50
    expect(t.matrix[1][0]).toBe(100) // Wind → Fire: absent → defaults to 1.0 → 100
  })
})

// ---------------------------------------------------------------------------
// Test 3: Field coverage — minimal
// ---------------------------------------------------------------------------

describe('Field coverage — minimal', () => {
  it('parses name', async () => {
    const t = await parseElementTableXml(MINIMAL_XML)
    expect(t.name).toBe('EmptyTable')
  })

  it('defaults comment to empty string', async () => {
    const t = await parseElementTableXml(MINIMAL_XML)
    expect(t.comment).toBe('')
  })

  it('defaults elements to empty array', async () => {
    const t = await parseElementTableXml(MINIMAL_XML)
    expect(t.elements).toEqual([])
  })

  it('defaults matrix to empty array', async () => {
    const t = await parseElementTableXml(MINIMAL_XML)
    expect(t.matrix).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Test 4: Output structure
// Serialize an element table and re-parse it with xml2js to assert the output
// XML has the expected elements, attributes, and nesting. These are structural
// assertions written by hand from the code — they do NOT perform real XSD
// validation and will not catch divergences between creidhne and the XSD.
// ---------------------------------------------------------------------------

describe('Output structure', () => {
  const table = {
    name: 'SchemaTable',
    comment: '',
    elements: ['Fire', 'Wind'],
    matrix: [
      [100, 80],
      [120, 100],
    ],
  }

  it('root element is ElementTable', async () => {
    const parsed = await parseRaw(serializeElementTableXml(table))
    expect(parsed).toHaveProperty('ElementTable')
  })

  it('Name attribute is present', async () => {
    const parsed = await parseRaw(serializeElementTableXml(table))
    expect(parsed.ElementTable.$?.Name).toBe('SchemaTable')
  })

  it('produces one Source element per element in the list', async () => {
    const parsed = await parseRaw(serializeElementTableXml(table))
    expect(parsed.ElementTable.Source).toHaveLength(2)
  })

  it('each Source has an Element attribute', async () => {
    const parsed = await parseRaw(serializeElementTableXml(table))
    const sources = parsed.ElementTable.Source
    expect(sources[0].$?.Element).toBe('Fire')
    expect(sources[1].$?.Element).toBe('Wind')
  })

  it('each Source has one Target per element', async () => {
    const parsed = await parseRaw(serializeElementTableXml(table))
    for (const source of parsed.ElementTable.Source) {
      expect(source.Target).toHaveLength(2)
    }
  })

  it('Target Multiplier is serialized as a float string', async () => {
    const parsed = await parseRaw(serializeElementTableXml(table))
    const fireTargets = parsed.ElementTable.Source[0].Target
    const windTarget = fireTargets.find((t) => t.$?.Element === 'Wind')
    expect(windTarget.$?.Multiplier).toBe('0.8') // 80 / 100
  })

  it('neutral matrix value (100) serializes as Multiplier "1"', async () => {
    const parsed = await parseRaw(serializeElementTableXml(table))
    const fireTargets = parsed.ElementTable.Source[0].Target
    const fireTarget = fireTargets.find((t) => t.$?.Element === 'Fire')
    expect(fireTarget.$?.Multiplier).toBe('1') // 100 / 100
  })
})
