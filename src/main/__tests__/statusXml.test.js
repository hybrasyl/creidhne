import { describe, it, expect } from 'vitest'
import { parseStatusXml, serializeStatusXml } from '../statusXml.js'
import xml2js from 'xml2js'

// ---------------------------------------------------------------------------
// Design notes
// ---------------------------------------------------------------------------
// Status has four effect blocks: OnApply, OnTick, OnRemove, OnExpire.
// Each block can contain: Animations (Target + SpellEffect sub-elements),
// Sound (sibling of Animations, merged into animations.soundId), Messages
// (Target/Source/Group/Say/Shout as text elements), Heal (Simple or Formula),
// Damage (element/type attributes + Flags/Simple/Formula children), StatModifiers
// (stat key attributes + ElementalModifiers), Conditions (Set/Unset string arrays),
// and Handler (Function + ScriptSource text elements).
//
// Absent effect blocks default to makeDefaultEffectBlock() — all fields null.
//
// Messages: enabled is detected by element presence (!!m.Target etc.). Serializer
// only writes a message element when BOTH enabled=true AND text is non-empty.
// A round-trip fixture should therefore always pair enabled=true with non-empty text.
//
// Damage: element defaults to 'None'; serializer omits the Element attribute
// when value is 'None'.

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_XML = `<?xml version="1.0"?>
<!-- Comment: Test poison status -->
<Status xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02"
  Name="Poison" Icon="12" Duration="30" Tick="3" RemoveChance="10"
  RemoveOnDeath="true">
  <Categories>
    <Category>Debuff</Category>
    <Category>Poison</Category>
  </Categories>
  <CastRestrictions>
    <CastRestriction Use="Heal" />
    <CastRestriction Receive="Buff" />
  </CastRestrictions>
  <ProhibitedMessage>You are too weakened to cast that!</ProhibitedMessage>
  <Effects>
    <OnApply>
      <Animations>
        <Target Id="100" Speed="50" />
        <SpellEffect Id="200" Speed="75" />
      </Animations>
      <Sound Id="42" />
      <Messages>
        <Target>You feel poisoned!</Target>
        <Source>You have poisoned your target.</Source>
      </Messages>
      <Heal>
        <Simple>10</Simple>
      </Heal>
    </OnApply>
    <OnTick>
      <Damage Element="Earth" Type="Magical">
        <Flags>Normal</Flags>
        <Formula>level * 2</Formula>
      </Damage>
      <StatModifiers BonusCon="-2">
        <ElementalModifiers>
          <ElementalModifier Type="Augment" Element="Fire" Modifier="1.5" />
        </ElementalModifiers>
      </StatModifiers>
    </OnTick>
    <OnRemove>
      <Conditions>
        <Set>Poisoned</Set>
        <Unset>Healthy</Unset>
      </Conditions>
      <Handler>
        <Function>onPoisonRemoved</Function>
        <ScriptSource>poison_handlers.lua</ScriptSource>
      </Handler>
    </OnRemove>
    <OnExpire>
      <Messages>
        <Say>The poison has worn off.</Say>
        <Group>Your group member recovered from poison.</Group>
      </Messages>
      <Heal>
        <Formula>maxHp * 0.1</Formula>
      </Heal>
    </OnExpire>
  </Effects>
</Status>`

const MINIMAL_XML = `<?xml version="1.0"?>
<Status xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="Bare">
</Status>`

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
  it('serializing a parsed status and re-parsing yields the same object', async () => {
    const first = await parseStatusXml(FULL_XML)
    const xml = serializeStatusXml(first)
    const second = await parseStatusXml(xml)
    expect(second).toEqual(first)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Field coverage — all fields
// ---------------------------------------------------------------------------

describe('Field coverage — all fields', () => {
  it('parses root attributes', async () => {
    const s = await parseStatusXml(FULL_XML)
    expect(s.name).toBe('Poison')
    expect(s.icon).toBe('12')
    expect(s.duration).toBe('30')
    expect(s.tick).toBe('3')
    expect(s.removeChance).toBe('10')
  })

  it('parses removeOnDeath as boolean', async () => {
    const s = await parseStatusXml(FULL_XML)
    expect(s.removeOnDeath).toBe(true)
  })

  it('parses comment', async () => {
    const s = await parseStatusXml(FULL_XML)
    expect(s.comment).toBe('Test poison status')
  })

  it('parses categories', async () => {
    const s = await parseStatusXml(FULL_XML)
    expect(s.categories).toEqual(['Debuff', 'Poison'])
  })

  it('parses castRestrictions', async () => {
    const s = await parseStatusXml(FULL_XML)
    expect(s.castRestrictions).toHaveLength(2)
    expect(s.castRestrictions[0]).toEqual({ type: 'use-castable', value: 'Heal' })
    expect(s.castRestrictions[1]).toEqual({ type: 'receive-castable', value: 'Buff' })
  })

  it('parses prohibitedMessage', async () => {
    const s = await parseStatusXml(FULL_XML)
    expect(s.prohibitedMessage).toBe('You are too weakened to cast that!')
  })

  // --- onApply ---

  it('parses onApply animations target and spellEffect', async () => {
    const s = await parseStatusXml(FULL_XML)
    const anim = s.onApply.animations
    expect(anim.targetId).toBe('100')
    expect(anim.targetSpeed).toBe('50')
    expect(anim.spellEffectId).toBe('200')
    expect(anim.spellEffectSpeed).toBe('75')
  })

  it('parses onApply Sound into animations.soundId', async () => {
    const s = await parseStatusXml(FULL_XML)
    expect(s.onApply.animations.soundId).toBe('42')
  })

  it('parses onApply messages target and source', async () => {
    const s = await parseStatusXml(FULL_XML)
    expect(s.onApply.messages.find(m => m.type === 'target')).toEqual({ type: 'target', text: 'You feel poisoned!', key: '' })
    expect(s.onApply.messages.find(m => m.type === 'source')).toEqual({ type: 'source', text: 'You have poisoned your target.', key: '' })
  })

  it('parses onApply messages absent channels are not present in the array', async () => {
    const s = await parseStatusXml(FULL_XML)
    expect(s.onApply.messages.find(m => m.type === 'say')).toBeUndefined()
    expect(s.onApply.messages.find(m => m.type === 'shout')).toBeUndefined()
  })

  it('parses onApply heal in simple mode', async () => {
    const s = await parseStatusXml(FULL_XML)
    expect(s.onApply.heal).toEqual({ kind: 'Static', value: '10', min: '', max: '', formula: '' })
  })

  // --- onTick ---

  it('parses onTick damage element, type, and formula mode', async () => {
    const s = await parseStatusXml(FULL_XML)
    const d = s.onTick.damage
    expect(d.element).toBe('Earth')
    expect(d.type).toBe('Magical')
    expect(d.kind).toBe('Formula')
    expect(d.formula).toBe('level * 2')
    expect(d.value).toBe('')
  })

  it('parses onTick damage flags', async () => {
    const s = await parseStatusXml(FULL_XML)
    expect(s.onTick.damage.flags).toEqual(['Normal'])
  })

  it('parses onTick statModifiers rows', async () => {
    const s = await parseStatusXml(FULL_XML)
    expect(s.onTick.statModifiers.rows).toContainEqual({ key: 'BonusCon', value: '-2' })
  })

  it('parses onTick elemental modifiers', async () => {
    const s = await parseStatusXml(FULL_XML)
    const em = s.onTick.statModifiers.elementalModifiers
    expect(em).toHaveLength(1)
    expect(em[0]).toEqual({ type: 'Augment', element: 'Fire', modifier: '1.5' })
  })

  // --- onRemove ---

  it('parses onRemove conditions set and unset', async () => {
    const s = await parseStatusXml(FULL_XML)
    expect(s.onRemove.conditions.set).toEqual(['Poisoned'])
    expect(s.onRemove.conditions.unset).toEqual(['Healthy'])
  })

  it('parses onRemove handler function and scriptSource', async () => {
    const s = await parseStatusXml(FULL_XML)
    expect(s.onRemove.handler).toEqual({ function: 'onPoisonRemoved', scriptSource: 'poison_handlers.lua' })
  })

  // --- onExpire ---

  it('parses onExpire messages say and group', async () => {
    const s = await parseStatusXml(FULL_XML)
    expect(s.onExpire.messages.find(m => m.type === 'say')).toEqual({ type: 'say', text: 'The poison has worn off.', key: '' })
    expect(s.onExpire.messages.find(m => m.type === 'group')).toEqual({ type: 'group', text: 'Your group member recovered from poison.', key: '' })
  })

  it('parses onExpire heal in formula mode', async () => {
    const s = await parseStatusXml(FULL_XML)
    expect(s.onExpire.heal).toEqual({ kind: 'Formula', value: '', min: '', max: '', formula: 'maxHp * 0.1' })
  })

  it('parses heal and damage when both Simple and Formula children are present', async () => {
    const xml = `<?xml version="1.0"?>
<Status xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="Test" Icon="0">
  <Effects>
    <OnApply>
      <Heal>
        <Simple Min="200" Max="400">0</Simple>
        <Formula>((SOURCEINT*20)+(SOURCEWIS*20)+(SOURCEDMG*50))+750</Formula>
      </Heal>
      <Damage Type="Direct">
        <Flags>None NoResistance NoThreat Nonlethal NoDodge NoCrit NoElement</Flags>
        <Simple Min="99" Max="199">0</Simple>
        <Formula>OldDamageFormula</Formula>
      </Damage>
    </OnApply>
  </Effects>
</Status>`
    const s = await parseStatusXml(xml)
    expect(s.onApply.heal).not.toBeNull()
    expect(s.onApply.heal.kind).toBe('Formula')
    expect(s.onApply.heal.formula).toBe('((SOURCEINT*20)+(SOURCEWIS*20)+(SOURCEDMG*50))+750')
    expect(s.onApply.damage).not.toBeNull()
    expect(s.onApply.damage.kind).toBe('Formula')
    expect(s.onApply.damage.formula).toBe('OldDamageFormula')
    expect(s.onApply.damage.type).toBe('Direct')
  })

  it('absent effect blocks default to all-null fields', async () => {
    const s = await parseStatusXml(FULL_XML)
    // onTick has damage and statModifiers but no animations, messages, conditions, handler, heal
    expect(s.onTick.animations).toBeNull()
    expect(s.onTick.messages).toBeNull()
    expect(s.onTick.heal).toBeNull()
    expect(s.onTick.conditions).toBeNull()
    expect(s.onTick.handler).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Test 3: Field coverage — minimal
// ---------------------------------------------------------------------------

describe('Field coverage — minimal', () => {
  it('parses name', async () => {
    const s = await parseStatusXml(MINIMAL_XML)
    expect(s.name).toBe('Bare')
  })

  it('defaults comment to empty string', async () => {
    const s = await parseStatusXml(MINIMAL_XML)
    expect(s.comment).toBe('')
  })

  it('defaults icon, duration, tick, removeChance to empty string', async () => {
    const s = await parseStatusXml(MINIMAL_XML)
    expect(s.icon).toBe('')
    expect(s.duration).toBe('')
    expect(s.tick).toBe('')
    expect(s.removeChance).toBe('')
  })

  it('defaults removeOnDeath to false', async () => {
    const s = await parseStatusXml(MINIMAL_XML)
    expect(s.removeOnDeath).toBe(false)
  })

  it('defaults categories to empty array', async () => {
    const s = await parseStatusXml(MINIMAL_XML)
    expect(s.categories).toEqual([])
  })

  it('defaults castRestrictions to empty array', async () => {
    const s = await parseStatusXml(MINIMAL_XML)
    expect(s.castRestrictions).toEqual([])
  })

  it('defaults prohibitedMessage to empty string', async () => {
    const s = await parseStatusXml(MINIMAL_XML)
    expect(s.prohibitedMessage).toBe('')
  })

  it('defaults all four effect blocks with all fields null', async () => {
    const s = await parseStatusXml(MINIMAL_XML)
    const nullBlock = { animations: null, messages: null, heal: null, damage: null, statModifiers: null, conditions: null, handler: null }
    expect(s.onApply).toEqual(nullBlock)
    expect(s.onTick).toEqual(nullBlock)
    expect(s.onRemove).toEqual(nullBlock)
    expect(s.onExpire).toEqual(nullBlock)
  })
})

// ---------------------------------------------------------------------------
// Test 4: Output structure
// Serialize a status and re-parse it with xml2js to assert the output XML has
// the expected elements, attributes, and nesting. These are structural
// assertions written by hand from the code — they do NOT perform real XSD
// validation and will not catch divergences between creidhne and the XSD.
// ---------------------------------------------------------------------------

describe('Output structure', () => {
  const status = {
    name: 'Burn',
    comment: '',
    icon: '5',
    duration: '10',
    tick: '2',
    removeChance: '',
    removeOnDeath: false,
    prohibitedMessage: '',
    categories: ['Debuff'],
    castRestrictions: [{ type: 'use-castable', value: 'HealSpell' }],
    onApply: {
      animations: { targetId: '50', targetSpeed: '30', spellEffectId: '', spellEffectSpeed: '', soundId: '7' },
      messages: [{ type: 'target', text: 'You are burning!', key: '' }],
      heal: null,
      damage: null,
      statModifiers: null,
      conditions: null,
      handler: null,
    },
    onTick: {
      animations: null,
      messages: null,
      heal: null,
      damage: { element: 'Fire', type: 'Magical', flags: [], kind: 'Static', value: '5', min: '', max: '', formula: '' },
      statModifiers: { rows: [{ key: 'BonusStr', value: '1' }], elementalModifiers: [] },
      conditions: null,
      handler: null,
    },
    onRemove: { animations: null, messages: null, heal: null, damage: null, statModifiers: null, conditions: { set: ['Burning'], unset: [] }, handler: null },
    onExpire: { animations: null, messages: null, heal: null, damage: null, statModifiers: null, conditions: null, handler: { function: 'onBurnExpire', scriptSource: '' } },
  }

  it('root element is Status', async () => {
    const parsed = await parseRaw(serializeStatusXml(status))
    expect(parsed).toHaveProperty('Status')
  })

  it('Name, Icon, Duration, Tick attributes are present', async () => {
    const parsed = await parseRaw(serializeStatusXml(status))
    const root = parsed.Status
    expect(root.$?.Name).toBe('Burn')
    expect(root.$?.Icon).toBe('5')
    expect(root.$?.Duration).toBe('10')
    expect(root.$?.Tick).toBe('2')
  })

  it('RemoveOnDeath is omitted when false', async () => {
    const parsed = await parseRaw(serializeStatusXml(status))
    expect(parsed.Status.$?.RemoveOnDeath).toBeUndefined()
  })

  it('Categories element contains Category children', async () => {
    const parsed = await parseRaw(serializeStatusXml(status))
    expect(parsed.Status.Categories?.[0]?.Category).toContain('Debuff')
  })

  it('CastRestrictions/CastRestriction has Use attribute', async () => {
    const parsed = await parseRaw(serializeStatusXml(status))
    const cr = parsed.Status.CastRestrictions?.[0]?.CastRestriction?.[0]
    expect(cr.$?.Use).toBe('HealSpell')
  })

  it('OnApply/Animations/Target has Id and Speed attributes', async () => {
    const parsed = await parseRaw(serializeStatusXml(status))
    const target = parsed.Status.Effects?.[0]?.OnApply?.[0]?.Animations?.[0]?.Target?.[0]
    expect(target.$?.Id).toBe('50')
    expect(target.$?.Speed).toBe('30')
  })

  it('Sound is a sibling of Animations with Id attribute', async () => {
    const parsed = await parseRaw(serializeStatusXml(status))
    const onApply = parsed.Status.Effects?.[0]?.OnApply?.[0]
    expect(onApply?.Sound?.[0]?.$?.Id).toBe('7')
  })

  it('OnApply/Messages/Target is present with text', async () => {
    const parsed = await parseRaw(serializeStatusXml(status))
    const msgs = parsed.Status.Effects?.[0]?.OnApply?.[0]?.Messages?.[0]
    expect(msgs?.Target?.[0]).toBe('You are burning!')
  })

  it('OnTick/Damage has Element and Type attributes', async () => {
    const parsed = await parseRaw(serializeStatusXml(status))
    const dmg = parsed.Status.Effects?.[0]?.OnTick?.[0]?.Damage?.[0]
    expect(dmg.$?.Element).toBe('Fire')
    expect(dmg.$?.Type).toBe('Magical')
  })

  it('OnTick/Damage Element attribute is omitted when None', async () => {
    const noElem = { ...status, onTick: { ...status.onTick, damage: { ...status.onTick.damage, element: 'None' } } }
    const parsed = await parseRaw(serializeStatusXml(noElem))
    const dmg = parsed.Status.Effects?.[0]?.OnTick?.[0]?.Damage?.[0]
    expect(dmg.$?.Element).toBeUndefined()
  })

  it('OnTick/StatModifiers has stat key attribute', async () => {
    const parsed = await parseRaw(serializeStatusXml(status))
    const sm = parsed.Status.Effects?.[0]?.OnTick?.[0]?.StatModifiers?.[0]
    expect(sm.$?.BonusStr).toBe('1')
  })

  it('OnRemove/Conditions/Set contains condition string', async () => {
    const parsed = await parseRaw(serializeStatusXml(status))
    const cond = parsed.Status.Effects?.[0]?.OnRemove?.[0]?.Conditions?.[0]
    expect(cond?.Set).toContain('Burning')
  })

  it('OnExpire/Handler/Function contains function name', async () => {
    const parsed = await parseRaw(serializeStatusXml(status))
    const hdlr = parsed.Status.Effects?.[0]?.OnExpire?.[0]?.Handler?.[0]
    expect(hdlr?.Function?.[0]).toBe('onBurnExpire')
  })
})

// ---------------------------------------------------------------------------
// Test 5: formulaNames meta round-trip
// ---------------------------------------------------------------------------

describe('formulaNames meta round-trip', () => {
  const META_XML = `<?xml version="1.0"?>
<!-- creidhne:meta {"formulaNames":{"onTick":{"damage":"mon_base_st1"},"onExpire":{"heal":"cure_base"}}} -->
<Status xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="Test">
  <Effects>
    <OnTick>
      <Damage Type="Magical"><Flags>Normal</Flags><Formula>level * 2</Formula></Damage>
    </OnTick>
    <OnExpire>
      <Heal><Formula>maxHp * 0.1</Formula></Heal>
    </OnExpire>
  </Effects>
</Status>`

  it('parses formulaNames from meta into onTick.damage.formulaName', async () => {
    const s = await parseStatusXml(META_XML)
    expect(s.onTick.damage.formulaName).toBe('mon_base_st1')
  })

  it('parses formulaNames from meta into onExpire.heal.formulaName', async () => {
    const s = await parseStatusXml(META_XML)
    expect(s.onExpire.heal.formulaName).toBe('cure_base')
  })

  it('formulaName is absent when not in meta', async () => {
    const s = await parseStatusXml(META_XML)
    expect(s.onTick.heal).toBeNull()
    expect(s.onExpire.damage).toBeNull()
  })

  it('serializing with formulaName writes formulaNames to meta comment', async () => {
    const s = await parseStatusXml(META_XML)
    const xml = serializeStatusXml(s)
    expect(xml).toContain('"formulaNames"')
    expect(xml).toContain('"mon_base_st1"')
    expect(xml).toContain('"cure_base"')
  })

  it('round-trips formulaName through serialize → parse', async () => {
    const s = await parseStatusXml(META_XML)
    const s2 = await parseStatusXml(serializeStatusXml(s))
    expect(s2.onTick.damage.formulaName).toBe('mon_base_st1')
    expect(s2.onExpire.heal.formulaName).toBe('cure_base')
  })
})
