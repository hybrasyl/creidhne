import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import xml2js from 'xml2js'
import { parseTraitXml, serializeTraitXml } from '../traitXml.js'

// The Trait root type (HXML-28, HTOO-617).

const FULL_XML = readFileSync(
  join(
    process.cwd(),
    'src',
    'main',
    '__tests__',
    'fixtures',
    'xml',
    'traits',
    'trait_dockworker.xml'
  ),
  'utf8'
)

const MINIMAL_XML = `<?xml version="1.0"?>
<Trait xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="Scribe" Icon="7" IconSet="Spell"/>
`

const parseRaw = (xml) =>
  new Promise((resolve, reject) =>
    xml2js.parseString(xml, { trim: true }, (err, r) => (err ? reject(err) : resolve(r)))
  )

/** The XML with line endings and self-closing spacing made the same. */
const norm = (s) =>
  s
    .replace(/\r\n/g, '\n')
    .replace(/\s+\/>/g, '/>')
    .trim()

describe('round trip', () => {
  it.each([
    ['a full trait', FULL_XML],
    ['a trait with only the required attributes', MINIMAL_XML]
  ])('%s saves to the same XML with no edit', async (_, xml) => {
    expect(norm(serializeTraitXml(await parseTraitXml(xml)))).toBe(norm(xml))
  })
})

describe('parse', () => {
  it('reads every field of a full trait', async () => {
    const t = await parseTraitXml(FULL_XML)
    expect(t).toEqual({
      name: 'Dockworker',
      comment: "From the HTOO-617 card's example",
      icon: '112',
      iconSet: 'Skill',
      category: 'Background',
      description: 'Years on the docks have made you unusually strong.',
      exclusiveGroup: 'Background',
      exclusivePolicy: 'Replace',
      conflictsWith: ['Scribe', 'Courtier'],
      statModifiers: {
        rows: [
          { key: 'BonusStr', value: '3' },
          { key: 'BonusCon', value: '1' }
        ],
        elementalModifiers: [{ type: 'Resistance', element: 'Earth', modifier: '0.9' }]
      }
    })
  })

  it('reads an absent optional block as empty', async () => {
    const t = await parseTraitXml(MINIMAL_XML)
    expect(t).toMatchObject({
      category: '',
      description: '',
      exclusiveGroup: '',
      exclusivePolicy: '',
      conflictsWith: [],
      statModifiers: { rows: [], elementalModifiers: [] }
    })
  })

  it('reads a group without a Policy as no policy, which the schema reads as Reject', async () => {
    const xml = MINIMAL_XML.replace(
      '/>',
      '>\n  <ExclusiveGroup>Background</ExclusiveGroup>\n</Trait>'
    )
    const t = await parseTraitXml(xml)
    expect(t.exclusiveGroup).toBe('Background')
    expect(t.exclusivePolicy).toBe('')
  })
})

describe('serialize', () => {
  it('writes no empty optional block', async () => {
    const t = await parseTraitXml(FULL_XML)
    const raw = await parseRaw(
      serializeTraitXml({
        ...t,
        description: '',
        exclusiveGroup: '',
        conflictsWith: [],
        statModifiers: { rows: [], elementalModifiers: [] }
      })
    )
    expect(Object.keys(raw.Trait).sort()).toEqual(['$'])
  })

  it('writes the children in the schema order', async () => {
    const out = serializeTraitXml(await parseTraitXml(FULL_XML))
    const at = (tag) => out.indexOf(`<${tag}`)
    expect(at('Description')).toBeLessThan(at('ExclusiveGroup'))
    expect(at('ExclusiveGroup')).toBeLessThan(at('ConflictsWith'))
    expect(at('ConflictsWith')).toBeLessThan(at('StatModifiers'))
  })

  it('does not cap the icon at 255', async () => {
    const t = { ...(await parseTraitXml(MINIMAL_XML)), icon: '4000' }
    expect(serializeTraitXml(t)).toContain('Icon="4000"')
  })
})
