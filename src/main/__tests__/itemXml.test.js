import { describe, it, expect } from 'vitest'
import { parseItemXml, serializeItemXml } from '../itemXml.js'
import xml2js from 'xml2js'

// ---------------------------------------------------------------------------
// Design notes
// ---------------------------------------------------------------------------
// - Name, UnidentifiedName, and Comment are child *elements*, not attributes.
//   Comment is a <Comment> element (same pattern as VariantGroup — not an XML
//   comment annotation). No extractComment is used.
// - IncludeInMetafile is an attribute on the root <Item>; defaults to true,
//   only written to XML when false.
// - _diagnostics.unknownStatKeys is computed on parse and not serialized back.
//   A fixture with only known stat keys yields unknownStatKeys: [].
// - bodyStyle/color are empty string by default; serializer omits them when blank.
// - Categories: the Unique attribute is parsed per-category but the serializer
//   omits it (writes only the category name). A category with unique:true will
//   lose that flag on round-trip. Round-trip fixture uses unique:false only.
// - class:'All' serializes as the full class string
//   'Peasant Wizard Rogue Monk Warrior Priest', same as VariantGroup.
// - Physical defaults: value:'1', weight:'1', durability:'1'.
// - Restrictions defaults: level {min:'1', max:'99'}, class:'All', gender:'Neutral'.
// - Motions: serialized as <Motion><Motion .../></Motion> — the outer and inner
//   elements share the name "Motion". Parser accepts either Motion or Motions
//   as the outer element name.

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_XML = `<?xml version="1.0"?>
<Item xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" IncludeInMetafile="false">
  <Name>Iron Sword</Name>
  <UnidentifiedName>Old Blade</UnidentifiedName>
  <Comment>A sturdy iron sword</Comment>
  <Properties Tags="weapon sword">
    <Appearance Sprite="100" EquipSprite="200" BodyStyle="ArmorBoots" Color="Red" HideBoots="false" />
    <Categories>
      <Category>Weapon</Category>
    </Categories>
    <Stackable Max="1" />
    <Physical Value="500" Weight="10" Durability="2000" />
    <Equipment Slot="Weapon" WeaponType="OneHand" />
    <StatModifiers BonusStr="3" BonusDmg="5">
      <ElementalModifiers>
        <ElementalModifier Type="Augment" Element="Fire" Modifier="1.5" />
      </ElementalModifiers>
    </StatModifiers>
    <Flags>Bound Undiscardable</Flags>
    <Variants>
      <Group>Sword Variants</Group>
      <Name Group="Sword Variants">Blessed</Name>
    </Variants>
    <Vendor ShopTab="Weapons">
      <Description>A reliable iron sword for beginner warriors.</Description>
    </Vendor>
    <Damage SmallMin="5" SmallMax="10" LargeMin="8" LargeMax="15" />
    <Use>
      <Script>iron_sword_use</Script>
      <Teleport X="5" Y="10">Mileth Village</Teleport>
      <Effect Id="42" Speed="75" />
      <Sound Id="7" />
      <Statuses>
        <Add Duration="30" Intensity="1.0" Tick="3" PersistDeath="true">Blessed</Add>
        <Remove IsCategory="true" Quantity="1">Curse</Remove>
      </Statuses>
    </Use>
    <Restrictions>
      <Level Min="5" Max="50" />
      <Ab Min="1" Max="100" />
      <Class>Warrior Priest</Class>
      <Gender>Male</Gender>
      <Castables>
        <Castable>Lam</Castable>
      </Castables>
      <SlotRestrictions>
        <SlotRestriction Type="ItemRequired" Slot="Weapon" Message="Requires a weapon equipped" />
      </SlotRestrictions>
    </Restrictions>
    <Motions>
      <Motion Id="10" Speed="20" />
    </Motions>
    <CastModifiers>
      <Match Group="Sword Spells" All="true">
        <Add Amount="2" Min="1" Max="10" />
      </Match>
    </CastModifiers>
    <Procs>
      <Proc Type="OnStrike" Castable="Fireball" Chance="10" />
    </Procs>
  </Properties>
</Item>`

const MINIMAL_XML = `<?xml version="1.0"?>
<Item xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02">
  <Name>Bare Item</Name>
  <Properties>
    <Appearance Sprite="1" />
    <Stackable Max="1" />
    <Physical Value="1" Weight="1" Durability="1" />
  </Properties>
</Item>`

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
  it('serializing a parsed item and re-parsing yields the same object', async () => {
    const first = await parseItemXml(FULL_XML)
    const xml = serializeItemXml(first)
    const second = await parseItemXml(xml)
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Field coverage — all fields
// ---------------------------------------------------------------------------

describe('Field coverage — all fields', () => {
  it('parses name from child element', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.name).toBe('Iron Sword')
  })

  it('parses unidentifiedName from child element', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.unidentifiedName).toBe('Old Blade')
  })

  it('parses comment from <Comment> child element', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.comment).toBe('A sturdy iron sword')
  })

  it('parses includeInMetafile as boolean', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.includeInMetafile).toBe(false)
  })

  it('parses properties tags', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.tags).toEqual(['weapon', 'sword'])
  })

  it('parses appearance sprite, equipSprite, bodyStyle, color', async () => {
    const item = await parseItemXml(FULL_XML)
    const app = item.properties.appearance
    expect(app.sprite).toBe('100')
    expect(app.equipSprite).toBe('200')
    expect(app.bodyStyle).toBe('ArmorBoots')
    expect(app.color).toBe('Red')
    expect(app.hideBoots).toBe(false)
  })

  it('parses bodyStyle and color as non-empty strings when set', async () => {
    const item = await parseItemXml(FULL_XML)
    const app = item.properties.appearance
    expect(app.bodyStyle).toBe('ArmorBoots')
    expect(app.color).toBe('Red')
  })

  it('parses categories', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.categories).toEqual([{ name: 'Weapon', unique: false }])
  })

  it('parses stackable max', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.stackable.max).toBe('1')
  })

  it('parses physical value, weight, durability', async () => {
    const item = await parseItemXml(FULL_XML)
    const p = item.properties.physical
    expect(p.value).toBe('500')
    expect(p.weight).toBe('10')
    expect(p.durability).toBe('2000')
  })

  it('parses equipment slot and weaponType', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.equipment).toEqual({ slot: 'Weapon', weaponType: 'OneHand' })
  })

  it('parses statModifiers rows', async () => {
    const item = await parseItemXml(FULL_XML)
    const rows = item.properties.statModifiers.rows
    expect(rows).toContainEqual({ key: 'BonusStr', value: '3' })
    expect(rows).toContainEqual({ key: 'BonusDmg', value: '5' })
  })

  it('parses statModifiers elemental modifiers', async () => {
    const item = await parseItemXml(FULL_XML)
    const em = item.properties.statModifiers.elementalModifiers
    expect(em).toHaveLength(1)
    expect(em[0]).toEqual({ type: 'Augment', element: 'Fire', modifier: '1.5' })
  })

  it('diagnostics unknownStatKeys is empty for valid stat keys', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item._diagnostics.unknownStatKeys).toEqual([])
  })

  it('parses flags', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.flags).toEqual(['Bound', 'Undiscardable'])
  })

  it('parses variants groups and names', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.variants.groups).toEqual(['Sword Variants'])
    expect(item.properties.variants.names).toEqual([{ group: 'Sword Variants', value: 'Blessed' }])
  })

  it('parses vendor shopTab and description', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.vendor.shopTab).toBe('Weapons')
    expect(item.properties.vendor.description).toBe('A reliable iron sword for beginner warriors.')
  })

  it('parses damage min/max values', async () => {
    const item = await parseItemXml(FULL_XML)
    const d = item.properties.damage
    expect(d.smallMin).toBe('5')
    expect(d.smallMax).toBe('10')
    expect(d.largeMin).toBe('8')
    expect(d.largeMax).toBe('15')
  })

  it('parses use script', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.use.script).toBe('iron_sword_use')
  })

  it('parses use teleport', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.use.teleport).toEqual({ map: 'Mileth Village', x: '5', y: '10' })
  })

  it('parses use effect', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.use.effect).toEqual({ id: '42', speed: '75' })
  })

  it('parses use sound', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.use.sound).toEqual({ id: '7' })
  })

  it('parses use statuses add', async () => {
    const item = await parseItemXml(FULL_XML)
    const add = item.properties.use.statuses.add
    expect(add).toHaveLength(1)
    expect(add[0].name).toBe('Blessed')
    expect(add[0].duration).toBe('30')
    expect(add[0].intensity).toBe('1.0')
    expect(add[0].tick).toBe('3')
    expect(add[0].persistDeath).toBe(true)
  })

  it('parses use statuses remove', async () => {
    const item = await parseItemXml(FULL_XML)
    const rem = item.properties.use.statuses.remove
    expect(rem).toHaveLength(1)
    expect(rem[0]).toEqual({ name: 'Curse', isCategory: true, quantity: '1' })
  })

  it('parses restrictions level min/max', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.restrictions.level).toEqual({ min: '5', max: '50' })
  })

  it('parses restrictions ab min/max', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.restrictions.ab).toEqual({ min: '1', max: '100' })
  })

  it('parses restrictions class', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.restrictions.class).toBe('Warrior Priest')
  })

  it('parses restrictions gender', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.restrictions.gender).toBe('Male')
  })

  it('parses restrictions castables', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.restrictions.castables).toEqual(['Lam'])
  })

  it('parses restrictions slotRestrictions', async () => {
    const item = await parseItemXml(FULL_XML)
    const sr = item.properties.restrictions.slotRestrictions
    expect(sr).toHaveLength(1)
    expect(sr[0]).toEqual({
      type: 'ItemRequired',
      slot: 'Weapon',
      message: 'Requires a weapon equipped'
    })
  })

  it('parses motions', async () => {
    const item = await parseItemXml(FULL_XML)
    expect(item.properties.motions).toHaveLength(1)
    expect(item.properties.motions[0]).toEqual({ id: '10', speed: '20' })
  })

  it('parses castModifiers match group and All flag', async () => {
    const item = await parseItemXml(FULL_XML)
    const cm = item.properties.castModifiers[0]
    expect(cm.group).toBe('Sword Spells')
    expect(cm.all).toBe(true)
    expect(cm.add).toHaveLength(1)
    expect(cm.add[0].amount).toBe('2')
    expect(cm.add[0].min).toBe('1')
    expect(cm.add[0].max).toBe('10')
  })

  it('parses procs', async () => {
    const item = await parseItemXml(FULL_XML)
    const proc = item.properties.procs[0]
    expect(proc).toEqual({ type: 'OnStrike', castable: 'Fireball', script: '', chance: '10' })
  })

  it('category Unique attribute round-trips correctly', async () => {
    const withUnique = `<?xml version="1.0"?>
<Item xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02">
  <Name>Ring</Name>
  <Properties>
    <Appearance Sprite="1" />
    <Stackable Max="1" />
    <Physical Value="1" Weight="1" Durability="1" />
    <Categories>
      <Category Unique="true">Ring</Category>
    </Categories>
  </Properties>
</Item>`
    const item = await parseItemXml(withUnique)
    expect(item.properties.categories[0].unique).toBe(true)
    const reparsed = await parseItemXml(serializeItemXml(item))
    expect(reparsed.properties.categories[0].unique).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 3: Field coverage — minimal
// ---------------------------------------------------------------------------

describe('Field coverage — minimal', () => {
  it('parses name', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.name).toBe('Bare Item')
  })

  it('defaults unidentifiedName to empty string', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.unidentifiedName).toBe('')
  })

  it('defaults comment to empty string', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.comment).toBe('')
  })

  it('defaults includeInMetafile to true', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.includeInMetafile).toBe(true)
  })

  it('defaults tags to empty array', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.properties.tags).toEqual([])
  })

  it('defaults appearance bodyStyle and color to empty string when absent', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.properties.appearance.bodyStyle).toBe('')
    expect(item.properties.appearance.color).toBe('')
  })

  it('defaults physical value, weight, durability to 1', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.properties.physical).toEqual({ value: '1', weight: '1', durability: '1' })
  })

  it('defaults categories to empty array', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.properties.categories).toEqual([])
  })

  it('defaults equipment to null', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.properties.equipment).toBeNull()
  })

  it('defaults statModifiers to empty rows and modifiers', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.properties.statModifiers.rows).toEqual([])
    expect(item.properties.statModifiers.elementalModifiers).toEqual([])
    expect(item.properties.statModifiers.unknownStatKeys).toEqual([])
  })

  it('defaults flags to empty array', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.properties.flags).toEqual([])
  })

  it('defaults variants names and groups to empty arrays', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.properties.variants.names).toEqual([])
    expect(item.properties.variants.groups).toEqual([])
  })

  it('defaults vendor shopTab and description to empty string', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.properties.vendor).toEqual({ shopTab: '', description: '' })
  })

  it('defaults damage to null', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.properties.damage).toBeNull()
  })

  it('defaults use to null', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.properties.use).toBeNull()
  })

  it('defaults restrictions level, class, gender', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    const r = item.properties.restrictions
    expect(r.level).toEqual({ min: '', max: '' })
    expect(r.class).toBe('')
    expect(r.gender).toBe('Neutral')
    expect(r.ab).toBeNull()
  })

  it('defaults motions to empty array', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.properties.motions).toEqual([])
  })

  it('defaults castModifiers to empty array', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.properties.castModifiers).toEqual([])
  })

  it('defaults procs to empty array', async () => {
    const item = await parseItemXml(MINIMAL_XML)
    expect(item.properties.procs).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Test 4: Output structure
// Serialize an item and re-parse it with xml2js to assert the output XML has
// the expected elements, attributes, and nesting. These are structural
// assertions written by hand from the code — they do NOT perform real XSD
// validation and will not catch divergences between creidhne and the XSD.
// ---------------------------------------------------------------------------

describe('Output structure', () => {
  const item = {
    name: 'Short Sword',
    unidentifiedName: '',
    comment: '',
    includeInMetafile: false,
    _diagnostics: { unknownStatKeys: [] },
    properties: {
      tags: ['weapon'],
      appearance: {
        sprite: '50',
        equipSprite: '51',
        displaySprite: '',
        bodyStyle: '',
        color: 'Blue',
        hideBoots: false
      },
      stackable: { max: '1' },
      physical: { value: '200', weight: '5', durability: '500' },
      categories: [{ name: 'Blade', unique: false }],
      equipment: { slot: 'Weapon', weaponType: 'OneHand' },
      statModifiers: {
        rows: [{ key: 'BonusStr', value: '1' }],
        elementalModifiers: [],
        unknownStatKeys: []
      },
      flags: ['Bound'],
      variants: { groups: ['Short Variants'], names: [] },
      vendor: { shopTab: 'Blades', description: 'A short sword.' },
      damage: { smallMin: '3', smallMax: '6', largeMin: '5', largeMax: '9' },
      use: null,
      restrictions: {
        level: { min: '1', max: '99' },
        ab: null,
        class: 'All',
        gender: 'Neutral',
        castables: [],
        slotRestrictions: []
      },
      motions: [{ id: '5', speed: '15' }],
      castModifiers: [],
      procs: [{ type: 'OnUse', castable: '', script: 'short_sword', chance: '50' }]
    }
  }

  it('root element is Item', async () => {
    const parsed = await parseRaw(serializeItemXml(item))
    expect(parsed).toHaveProperty('Item')
  })

  it('IncludeInMetafile="false" attribute is written when false', async () => {
    const parsed = await parseRaw(serializeItemXml(item))
    expect(parsed.Item.$?.IncludeInMetafile).toBe('false')
  })

  it('IncludeInMetafile attribute is omitted when true', async () => {
    const withMeta = { ...item, includeInMetafile: true }
    const parsed = await parseRaw(serializeItemXml(withMeta))
    expect(parsed.Item.$?.IncludeInMetafile).toBeUndefined()
  })

  it('Name is a child element', async () => {
    const parsed = await parseRaw(serializeItemXml(item))
    expect(parsed.Item.Name?.[0]).toBe('Short Sword')
  })

  it('Properties has Tags attribute', async () => {
    const parsed = await parseRaw(serializeItemXml(item))
    expect(parsed.Item.Properties?.[0]?.$?.Tags).toBe('weapon')
  })

  it('Appearance has Sprite and Color attributes', async () => {
    const parsed = await parseRaw(serializeItemXml(item))
    const app = parsed.Item.Properties?.[0]?.Appearance?.[0]
    expect(app.$?.Sprite).toBe('50')
    expect(app.$?.Color).toBe('Blue')
  })

  it('Appearance bodyStyle is omitted when blank', async () => {
    const parsed = await parseRaw(serializeItemXml(item))
    const app = parsed.Item.Properties?.[0]?.Appearance?.[0]
    expect(app.$?.BodyStyle).toBeUndefined()
  })

  it('Equipment has Slot attribute', async () => {
    const parsed = await parseRaw(serializeItemXml(item))
    const eq = parsed.Item.Properties?.[0]?.Equipment?.[0]
    expect(eq.$?.Slot).toBe('Weapon')
  })

  it('StatModifiers has stat key attribute', async () => {
    const parsed = await parseRaw(serializeItemXml(item))
    const sm = parsed.Item.Properties?.[0]?.StatModifiers?.[0]
    expect(sm.$?.BonusStr).toBe('1')
  })

  it('Flags element contains flag string', async () => {
    const parsed = await parseRaw(serializeItemXml(item))
    expect(parsed.Item.Properties?.[0]?.Flags?.[0]).toBe('Bound')
  })

  it('Variants/Group contains group name', async () => {
    const parsed = await parseRaw(serializeItemXml(item))
    expect(parsed.Item.Properties?.[0]?.Variants?.[0]?.Group).toContain('Short Variants')
  })

  it('Damage has SmallMin and LargeMax attributes', async () => {
    const parsed = await parseRaw(serializeItemXml(item))
    const dmg = parsed.Item.Properties?.[0]?.Damage?.[0]
    expect(dmg.$?.SmallMin).toBe('3')
    expect(dmg.$?.LargeMax).toBe('9')
  })

  it('Motions wrapper contains Motion children', async () => {
    const parsed = await parseRaw(serializeItemXml(item))
    const motions = parsed.Item.Properties?.[0]?.Motions?.[0]?.Motion
    expect(motions).toHaveLength(1)
    expect(motions[0].$?.Id).toBe('5')
    expect(motions[0].$?.Speed).toBe('15')
  })

  it('Restrictions/Class contains full class string when All', async () => {
    const parsed = await parseRaw(serializeItemXml(item))
    const cls = parsed.Item.Properties?.[0]?.Restrictions?.[0]?.Class?.[0]
    expect(cls).toBe('Peasant Wizard Rogue Monk Warrior Priest')
  })

  it('Restrictions/Gender is omitted when Neutral', async () => {
    const parsed = await parseRaw(serializeItemXml(item))
    expect(parsed.Item.Properties?.[0]?.Restrictions?.[0]?.Gender).toBeUndefined()
  })

  it('Procs/Proc has Type and Chance attributes', async () => {
    const parsed = await parseRaw(serializeItemXml(item))
    const proc = parsed.Item.Properties?.[0]?.Procs?.[0]?.Proc?.[0]
    expect(proc.$?.Type).toBe('OnUse')
    expect(proc.$?.Chance).toBe('50')
  })
})
