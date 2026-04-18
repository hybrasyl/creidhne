import { describe, it, expect } from 'vitest'
import { parseVariantXml, serializeVariantXml } from '../variantXml.js'
import xml2js from 'xml2js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// VariantGroup is one of the few types with an explicit <Comment> element
// rather than an XML comment annotation (<!-- Comment: ... -->).

// restrictions.class: 'All' is editor shorthand. The canonical XML form is the
// full class list 'Peasant Wizard Rogue Monk Warrior Priest' (any order). The
// serializer expands 'All' to the full string on write; the parser stores
// whatever string is in the XML. Fixtures use an explicit class value so the
// round-trip fixture is an identity; the 'All' expansion is tested separately.

const FULL_XML = `<?xml version="1.0"?>
<VariantGroup xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02">
  <Name>Weapon Variants</Name>
  <Comment>Test weapon variant group</Comment>
  <Variant>
    <Name>Blessed</Name>
    <Modifier>+1</Modifier>
    <Comment>A blessed variant</Comment>
    <Properties Tags="weapon magic">
      <Appearance Sprite="100" EquipSprite="200" BodyStyle="ArmorBoots" Color="Red" />
      <Flags>Bound Undiscardable</Flags>
      <Physical Value="500" Weight="10" Durability="1000" />
      <Restrictions>
        <Level Min="5" Max="50" />
        <Ab Min="1" Max="100" />
        <Class>Warrior Priest</Class>
        <Gender>Female</Gender>
        <Castables>
          <Castable>Lam</Castable>
        </Castables>
      </Restrictions>
      <Script>blessed_script</Script>
      <Stackable Max="5" />
      <StatModifiers BonusStr="3" BonusDmg="5">
        <ElementalModifiers>
          <ElementalModifier Type="Augment" Element="Fire" Modifier="1.5" />
        </ElementalModifiers>
      </StatModifiers>
    </Properties>
  </Variant>
</VariantGroup>`

const MINIMAL_XML = `<?xml version="1.0"?>
<VariantGroup xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02">
  <Name>Empty Group</Name>
</VariantGroup>`

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
  it('serializing a parsed variant group and re-parsing yields the same object', async () => {
    const first = await parseVariantXml(FULL_XML)
    const xml = serializeVariantXml(first)
    const second = await parseVariantXml(xml)
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Field coverage — all fields
// ---------------------------------------------------------------------------

describe('Field coverage — all fields', () => {
  it('parses group name', async () => {
    const vg = await parseVariantXml(FULL_XML)
    expect(vg.name).toBe('Weapon Variants')
  })

  it('parses group comment from <Comment> element', async () => {
    const vg = await parseVariantXml(FULL_XML)
    expect(vg.comment).toBe('Test weapon variant group')
  })

  it('parses variant name and modifier', async () => {
    const vg = await parseVariantXml(FULL_XML)
    const v = vg.variants[0]
    expect(v.name).toBe('Blessed')
    expect(v.modifier).toBe('+1')
  })

  it('parses variant comment', async () => {
    const vg = await parseVariantXml(FULL_XML)
    expect(vg.variants[0].comment).toBe('A blessed variant')
  })

  it('parses properties tags', async () => {
    const vg = await parseVariantXml(FULL_XML)
    expect(vg.variants[0].properties.tags).toEqual(['weapon', 'magic'])
  })

  it('parses appearance with sprite, equipSprite, bodyStyle, color', async () => {
    const vg = await parseVariantXml(FULL_XML)
    const app = vg.variants[0].properties.appearance
    expect(app.sprite).toBe('100')
    expect(app.equipSprite).toBe('200')
    expect(app.bodyStyle).toBe('ArmorBoots')
    expect(app.color).toBe('Red')
    expect(app.hideBoots).toBe(false)
  })

  it('parses flags', async () => {
    const vg = await parseVariantXml(FULL_XML)
    expect(vg.variants[0].properties.flags).toEqual(['Bound', 'Undiscardable'])
  })

  it('parses physical value, weight, durability', async () => {
    const vg = await parseVariantXml(FULL_XML)
    const p = vg.variants[0].properties.physical
    expect(p.value).toBe('500')
    expect(p.weight).toBe('10')
    expect(p.durability).toBe('1000')
  })

  it('parses restrictions level min/max', async () => {
    const vg = await parseVariantXml(FULL_XML)
    expect(vg.variants[0].properties.restrictions.level).toEqual({ min: '5', max: '50' })
  })

  it('parses restrictions ab min/max', async () => {
    const vg = await parseVariantXml(FULL_XML)
    expect(vg.variants[0].properties.restrictions.ab).toEqual({ min: '1', max: '100' })
  })

  it('parses restrictions class', async () => {
    const vg = await parseVariantXml(FULL_XML)
    expect(vg.variants[0].properties.restrictions.class).toBe('Warrior Priest')
  })

  it('parses restrictions gender', async () => {
    const vg = await parseVariantXml(FULL_XML)
    expect(vg.variants[0].properties.restrictions.gender).toBe('Female')
  })

  it('parses restrictions castables', async () => {
    const vg = await parseVariantXml(FULL_XML)
    expect(vg.variants[0].properties.restrictions.castables).toEqual(['Lam'])
  })

  it('parses script', async () => {
    const vg = await parseVariantXml(FULL_XML)
    expect(vg.variants[0].properties.script).toBe('blessed_script')
  })

  it('parses stackable max', async () => {
    const vg = await parseVariantXml(FULL_XML)
    expect(vg.variants[0].properties.stackable.max).toBe('5')
  })

  it('parses stat modifier rows', async () => {
    const vg = await parseVariantXml(FULL_XML)
    const rows = vg.variants[0].properties.statModifiers.rows
    expect(rows).toContainEqual({ key: 'BonusStr', value: '3' })
    expect(rows).toContainEqual({ key: 'BonusDmg', value: '5' })
  })

  it('parses elemental modifiers', async () => {
    const vg = await parseVariantXml(FULL_XML)
    const em = vg.variants[0].properties.statModifiers.elementalModifiers
    expect(em).toHaveLength(1)
    expect(em[0]).toEqual({ type: 'Augment', element: 'Fire', modifier: '1.5' })
  })

  it('class="All" (editor shorthand) serializes as the canonical full class list in XML', async () => {
    const vg = await parseVariantXml(FULL_XML)
    const withAll = {
      ...vg,
      variants: [
        {
          ...vg.variants[0],
          properties: {
            ...vg.variants[0].properties,
            restrictions: { ...vg.variants[0].properties.restrictions, class: 'All' }
          }
        }
      ]
    }
    const xml = serializeVariantXml(withAll)
    const reparsed = await parseVariantXml(xml)
    expect(reparsed.variants[0].properties.restrictions.class).toBe(
      'Peasant Wizard Rogue Monk Warrior Priest'
    )
  })
})

// ---------------------------------------------------------------------------
// Test 3: Field coverage — minimal
// ---------------------------------------------------------------------------

describe('Field coverage — minimal', () => {
  it('parses name', async () => {
    const vg = await parseVariantXml(MINIMAL_XML)
    expect(vg.name).toBe('Empty Group')
  })

  it('defaults comment to empty string', async () => {
    const vg = await parseVariantXml(MINIMAL_XML)
    expect(vg.comment).toBe('')
  })

  it('defaults variants to empty array', async () => {
    const vg = await parseVariantXml(MINIMAL_XML)
    expect(vg.variants).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Test 4: Output structure
// Serialize a variant group and re-parse it with xml2js to assert the output
// XML has the expected elements, attributes, and nesting. These are structural
// assertions written by hand from the code — they do NOT perform real XSD
// validation and will not catch divergences between creidhne and the XSD.
// ---------------------------------------------------------------------------

describe('Output structure', () => {
  const vg = {
    name: 'Shield Variants',
    comment: '',
    variants: [
      {
        name: 'Sturdy',
        modifier: '+2',
        comment: '',
        properties: {
          tags: ['armor'],
          script: '',
          stackable: { max: '' },
          appearance: {
            sprite: '50',
            equipSprite: '',
            displaySprite: '',
            bodyStyle: '',
            color: '',
            hideBoots: false
          },
          flags: [],
          physical: { value: '200', weight: '5', durability: '' },
          restrictions: {
            level: { min: '', max: '' },
            ab: null,
            class: 'Warrior',
            gender: 'Neutral',
            castables: [],
            slotRestrictions: []
          },
          statModifiers: { rows: [{ key: 'BonusAc', value: '2' }], elementalModifiers: [] }
        }
      }
    ]
  }

  it('root element is VariantGroup', async () => {
    const parsed = await parseRaw(serializeVariantXml(vg))
    expect(parsed).toHaveProperty('VariantGroup')
  })

  it('Name element is present', async () => {
    const parsed = await parseRaw(serializeVariantXml(vg))
    expect(parsed.VariantGroup.Name?.[0]).toBe('Shield Variants')
  })

  it('omits Comment element when empty', async () => {
    const parsed = await parseRaw(serializeVariantXml(vg))
    expect(parsed.VariantGroup.Comment).toBeUndefined()
  })

  it('each Variant has Name and Modifier elements', async () => {
    const parsed = await parseRaw(serializeVariantXml(vg))
    const v = parsed.VariantGroup.Variant?.[0]
    expect(v?.Name?.[0]).toBe('Sturdy')
    expect(v?.Modifier?.[0]).toBe('+2')
  })

  it('Properties Tags attribute is set when tags present', async () => {
    const parsed = await parseRaw(serializeVariantXml(vg))
    const props = parsed.VariantGroup.Variant?.[0]?.Properties?.[0]
    expect(props?.$?.Tags).toBe('armor')
  })

  it('Physical element has Value and Weight attributes', async () => {
    const parsed = await parseRaw(serializeVariantXml(vg))
    const physical = parsed.VariantGroup.Variant?.[0]?.Properties?.[0]?.Physical?.[0]
    expect(physical?.$?.Value).toBe('200')
    expect(physical?.$?.Weight).toBe('5')
  })

  it('StatModifiers element has the expected stat attribute', async () => {
    const parsed = await parseRaw(serializeVariantXml(vg))
    const sm = parsed.VariantGroup.Variant?.[0]?.Properties?.[0]?.StatModifiers?.[0]
    expect(sm?.$?.BonusAc).toBe('2')
  })

  it('Restrictions contains Class element when class is set', async () => {
    const parsed = await parseRaw(serializeVariantXml(vg))
    const restr = parsed.VariantGroup.Variant?.[0]?.Properties?.[0]?.Restrictions?.[0]
    expect(restr?.Class?.[0]).toBe('Warrior')
  })

  it('Restrictions omits Level when min and max are blank', async () => {
    const parsed = await parseRaw(serializeVariantXml(vg))
    const restr = parsed.VariantGroup.Variant?.[0]?.Properties?.[0]?.Restrictions?.[0]
    expect(restr?.Level).toBeUndefined()
  })

  it('omits Gender element when Neutral', async () => {
    const parsed = await parseRaw(serializeVariantXml(vg))
    const restr = parsed.VariantGroup.Variant?.[0]?.Properties?.[0]?.Restrictions?.[0]
    expect(restr?.Gender).toBeUndefined()
  })
})
