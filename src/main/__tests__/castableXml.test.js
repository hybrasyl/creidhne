import { describe, it, expect, beforeAll } from 'vitest';
import xml2js from 'xml2js';
import { parseCastableXml, serializeCastableXml } from '../castableXml.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02';

const FULL_XML = `<?xml version="1.0"?>
<!-- Comment: Test castable comment -->
<!-- creidhne:meta {"isTest":true,"specialty":"magic"} -->
<Castable xmlns="${XMLNS}"
  Lines="2" Icon="42" Book="PrimarySpell" Elements="Fire" Class="Wizard"
  Cooldown="5" IsAssail="false" Reflectable="true" BreakStealth="true"
  IncludeInMetafile="true" PvpOnly="false">
  <Name>Fireball</Name>
  <Descriptions>
    <Description Class="Wizard">Hurls a fireball</Description>
    <Description Class="Monk">Hurls a fireball slowly</Description>
  </Descriptions>
  <Categories>
    <Category>Offensive</Category>
    <Category>Fire</Category>
  </Categories>
  <CastCosts>
    <CastCost>
      <Stat Mp="30"/>
      <Item Quantity="2">Firestone</Item>
    </CastCost>
  </CastCosts>
  <Intents>
    <Intent UseType="UseOnTarget" MaxTargets="1" Flags="Invincible">
      <Cross Radius="2" VisualEffect="AllTiles"/>
      <Line Length="3" Direction="East" VisualEffect="Targets"/>
    </Intent>
  </Intents>
  <MaxLevel Monk="20" Warrior="30" Peasant="99" Wizard="100" Priest="50" Rogue="40"/>
  <Mastery Uses="500" Modifiers="Rank1 Rank2" Tiered="true"/>
  <Script>fireball.cs</Script>
  <Requirements>
    <Requirement Class="Wizard" ForbidCookie="notallowed" RequireCookie="required">
      <Level Min="10" Max="50"/>
      <Ab Min="1" Max="5"/>
      <Physical Str="10" Int="15" Wis="12" Con="8" Dex="7"/>
      <Items>
        <Item Quantity="2">Spell Tome</Item>
      </Items>
      <Gold>500</Gold>
      <Prerequisites ForbidCookie="forbid" RequireCookie="req" ForbidMessage="No" RequireMessage="Yes">
        <Prerequisite Level="5">Mend</Prerequisite>
      </Prerequisites>
    </Requirement>
  </Requirements>
  <Effects ScriptOverride="true">
    <Animations>
      <OnCast>
        <Player>
          <Motion Class="Wizard" Id="5" Speed="25"/>
          <Motion Class="Priest" Id="6" Speed="20"/>
          <Motion Class="Rogue" Id="7" Speed="15"/>
          <Motion Class="Monk" Id="8" Speed="10"/>
          <Motion Class="Warrior" Id="3" Speed="20"/>
          <Motion Class="Peasant" Id="1" Speed="20"/>
        </Player>
        <SpellEffect Id="20" Speed="100"/>
        <Target Id="10" Speed="50"/>
      </OnCast>
      <OnEnd>
        <Target Id="11" Speed="30"/>
        <SpellEffect Id="21" Speed="60"/>
      </OnEnd>
    </Animations>
    <Sound Id="7"/>
    <Heal>
      <Simple>50</Simple>
    </Heal>
    <Damage Type="Fire">
      <Flags>Resistance</Flags>
      <Simple Min="10" Max="30">0</Simple>
    </Damage>
    <Statuses>
      <Add Duration="10" Intensity="2" Tick="3">Burn</Add>
      <Remove IsCategory="true" Quantity="2">FireGroup</Remove>
    </Statuses>
    <Reactors>
      <Reactor Script="explode.cs" RelativeX="1" RelativeY="-1" Sprite="5" Expiration="30" Uses="3"
        DisplayOwner="true" DisplayGroup="true" DisplayStatus="OnFire" DisplayCookie="burned"/>
    </Reactors>
  </Effects>
  <Restrictions>
    <Item RestrictionType="Equipped" Slot="Armor" WeaponType="None" Message="Wrong gear">Breastplate</Item>
  </Restrictions>
</Castable>`;

const MINIMAL_XML = `<?xml version="1.0"?>
<Castable xmlns="${XMLNS}">
  <Name>MinSpell</Name>
</Castable>`;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function rawParse(xml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, { trim: true }, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

// ---------------------------------------------------------------------------
// 1. Parse round-trip
// ---------------------------------------------------------------------------

describe('castableXml — parse round-trip', () => {
  it('full fixture round-trips to equal JS object', async () => {
    const first = await parseCastableXml(FULL_XML);
    const second = await parseCastableXml(serializeCastableXml(first));
    expect(second).toEqual(first);
  });

  it('deprecated MaxLevel round-trips', async () => {
    const xml = `<?xml version="1.0"?>
<Castable xmlns="${XMLNS}">
  <Name>DeprecatedSpell</Name>
  <!--<MaxLevel Monk="10" Wizard="20"/>-->
</Castable>`;
    const first = await parseCastableXml(xml);
    expect(first.maxLevel.deprecated).toBe(true);
    const second = await parseCastableXml(serializeCastableXml(first));
    expect(second).toEqual(first);
  });

  it('deprecated Mastery round-trips', async () => {
    const xml = `<?xml version="1.0"?>
<Castable xmlns="${XMLNS}">
  <Name>OldMastery</Name>
  <!--<Mastery Uses="100" Modifiers="Rank1"/>-->
</Castable>`;
    const first = await parseCastableXml(xml);
    expect(first.mastery.deprecated).toBe(true);
    const second = await parseCastableXml(serializeCastableXml(first));
    expect(second).toEqual(first);
  });

  it('deprecated Prerequisites round-trips', async () => {
    const xml = `<?xml version="1.0"?>
<Castable xmlns="${XMLNS}">
  <Name>DepPrereq</Name>
  <Requirements>
    <Requirement Class="Wizard">
      <!--
        <Prerequisites ForbidCookie="forbid">
          <Prerequisite Level="5">Mend</Prerequisite>
        </Prerequisites>
      -->
    </Requirement>
  </Requirements>
</Castable>`;
    const first = await parseCastableXml(xml);
    expect(first.requirements[0].prerequisites.deprecated).toBe(true);
    expect(first.requirements[0].prerequisites.forbidCookie).toBe('forbid');
    const second = await parseCastableXml(serializeCastableXml(first));
    expect(second.requirements[0].prerequisites).toEqual(first.requirements[0].prerequisites);
  });
});

// ---------------------------------------------------------------------------
// 2. All fields
// ---------------------------------------------------------------------------

describe('castableXml — all fields', () => {
  let c;
  beforeAll(async () => { c = await parseCastableXml(FULL_XML); });

  // Top-level scalars
  it('parses name', () => expect(c.name).toBe('Fireball'));
  it('parses comment annotation', () => expect(c.comment).toBe('Test castable comment'));
  it('parses creidhne:meta isTest', () => expect(c.meta.isTest).toBe(true));
  it('parses creidhne:meta specialty', () => expect(c.meta.specialty).toBe('magic'));
  it('parses lines', () => expect(c.lines).toBe('2'));
  it('parses cooldown', () => expect(c.cooldown).toBe('5'));
  it('parses icon', () => expect(c.icon).toBe('42'));
  it('parses book', () => expect(c.book).toBe('PrimarySpell'));
  it('parses elements', () => expect(c.elements).toBe('Fire'));
  it('parses class', () => expect(c.class).toBe('Wizard'));
  it('parses isAssail false', () => expect(c.isAssail).toBe(false));
  it('parses reflectable true', () => expect(c.reflectable).toBe(true));
  it('parses breakStealth true', () => expect(c.breakStealth).toBe(true));
  it('parses includeInMetafile true', () => expect(c.includeInMetafile).toBe(true));
  it('parses pvpOnly false', () => expect(c.pvpOnly).toBe(false));

  // Descriptions
  it('parses descriptions array', () => expect(c.descriptions).toHaveLength(2));
  it('parses description class', () => expect(c.descriptions[0].class).toBe('Wizard'));
  it('parses description text', () => expect(c.descriptions[0].text).toBe('Hurls a fireball'));

  // Categories
  it('parses categories array', () => expect(c.categories).toEqual(['Offensive', 'Fire']));

  // CastCosts
  it('parses stat cast cost', () => {
    const stat = c.castCosts.find((x) => x.type === 'Mp');
    expect(stat).toBeDefined();
    expect(stat.value).toBe('30');
  });
  it('parses item cast cost', () => {
    const item = c.castCosts.find((x) => x.type === 'Item');
    expect(item).toBeDefined();
    expect(item.itemName).toBe('Firestone');
    expect(item.quantity).toBe('2');
  });

  // Intents
  it('parses intent useType', () => expect(c.intents[0].useType).toBe('UseOnTarget'));
  it('parses intent maxTargets', () => expect(c.intents[0].maxTargets).toBe('1'));
  it('parses intent flags', () => expect(c.intents[0].flags).toEqual(['Invincible']));
  it('parses intent cross shape', () => {
    expect(c.intents[0].crosses[0]).toEqual({ radius: '2', visualEffect: 'AllTiles' });
  });
  it('parses intent line shape', () => {
    expect(c.intents[0].lines[0]).toEqual({ length: '3', direction: 'East', visualEffect: 'Targets' });
  });

  // MaxLevel (active)
  it('parses maxLevel not deprecated', () => expect(c.maxLevel.deprecated).toBe(false));
  it('parses maxLevel wizard', () => expect(c.maxLevel.wizard).toBe('100'));
  it('parses maxLevel monk', () => expect(c.maxLevel.monk).toBe('20'));

  // Mastery (active)
  it('parses mastery not deprecated', () => expect(c.mastery.deprecated).toBe(false));
  it('parses mastery uses', () => expect(c.mastery.uses).toBe('500'));
  it('parses mastery modifiers', () => expect(c.mastery.modifiers).toEqual(['Rank1', 'Rank2']));
  it('parses mastery tiered', () => expect(c.mastery.tiered).toBe(true));

  // Script
  it('parses script', () => expect(c.script).toBe('fireball.cs'));

  // Requirements
  it('parses requirement class', () => expect(c.requirements[0].class).toBe('Wizard'));
  it('parses requirement forbidCookie', () => expect(c.requirements[0].forbidCookie).toBe('notallowed'));
  it('parses requirement requireCookie', () => expect(c.requirements[0].requireCookie).toBe('required'));
  it('parses requirement levelMin', () => expect(c.requirements[0].levelMin).toBe('10'));
  it('parses requirement levelMax', () => expect(c.requirements[0].levelMax).toBe('50'));
  it('parses requirement abMin', () => expect(c.requirements[0].abMin).toBe('1'));
  it('parses requirement abMax', () => expect(c.requirements[0].abMax).toBe('5'));
  it('parses requirement physical str', () => expect(c.requirements[0].str).toBe('10'));
  it('parses requirement physical int', () => expect(c.requirements[0].int).toBe('15'));
  it('parses requirement item', () => {
    expect(c.requirements[0].items[0]).toEqual({ itemName: 'Spell Tome', quantity: '2' });
  });
  it('parses requirement gold', () => expect(c.requirements[0].gold).toBe('500'));
  it('parses requirement prerequisites active', () => {
    const pr = c.requirements[0].prerequisites;
    expect(pr.deprecated).toBe(false);
    expect(pr.forbidCookie).toBe('forbid');
    expect(pr.requireCookie).toBe('req');
    expect(pr.forbidMessage).toBe('No');
    expect(pr.requireMessage).toBe('Yes');
    expect(pr.castables[0]).toEqual({ name: 'Mend', level: '5' });
  });

  // Effects — ScriptOverride
  it('parses scriptOverride true', () => expect(c.scriptOverride).toBe(true));

  // Effects — Sound
  it('parses sound id', () => expect(c.sound.id).toBe('7'));

  // Effects — Animations
  it('parses onCast wizard motion', () => expect(c.animations.onCast.player.wizard).toEqual({ id: '5', speed: '25' }));
  it('parses onCast priest motion', () => expect(c.animations.onCast.player.priest).toEqual({ id: '6', speed: '20' }));
  it('parses onCast spellEffect', () => expect(c.animations.onCast.spellEffect).toEqual({ id: '20', speed: '100' }));
  it('parses onCast target', () => expect(c.animations.onCast.target).toEqual({ id: '10', speed: '50' }));
  it('parses onEnd spellEffect', () => expect(c.animations.onEnd.spellEffect).toEqual({ id: '21', speed: '60' }));
  it('parses onEnd target', () => expect(c.animations.onEnd.target).toEqual({ id: '11', speed: '30' }));

  // Effects — Heal (Static)
  it('parses heal kind Static', () => expect(c.heal.kind).toBe('Static'));
  it('parses heal value', () => expect(c.heal.value).toBe('50'));

  // Effects — Damage (Variable)
  it('parses damage kind Variable', () => expect(c.damage.kind).toBe('Variable'));
  it('parses damage type', () => expect(c.damage.type).toBe('Fire'));
  it('parses damage flags', () => expect(c.damage.flags).toEqual(['Resistance']));
  it('parses damage min', () => expect(c.damage.min).toBe('10'));
  it('parses damage max', () => expect(c.damage.max).toBe('30'));

  // Effects — Statuses
  it('parses status add', () => {
    expect(c.statuses.add[0]).toEqual({ name: 'Burn', duration: '10', intensity: '2', tick: '3' });
  });
  it('parses status remove', () => {
    expect(c.statuses.remove[0]).toEqual({ name: 'FireGroup', isCategory: true, quantity: '2' });
  });

  // Restrictions
  it('parses restriction type', () => expect(c.restrictions[0].type).toBe('Equipped'));
  it('parses restriction slot', () => expect(c.restrictions[0].slot).toBe('Armor'));
  it('parses restriction weaponType', () => expect(c.restrictions[0].weaponType).toBe('None'));
  it('parses restriction message', () => expect(c.restrictions[0].message).toBe('Wrong gear'));
  it('parses restriction itemName', () => expect(c.restrictions[0].itemName).toBe('Breastplate'));

  // Reactors
  it('parses reactor script', () => expect(c.reactors[0].script).toBe('explode.cs'));
  it('parses reactor relativeX', () => expect(c.reactors[0].relativeX).toBe('1'));
  it('parses reactor relativeY', () => expect(c.reactors[0].relativeY).toBe('-1'));
  it('parses reactor sprite', () => expect(c.reactors[0].sprite).toBe('5'));
  it('parses reactor expiration', () => expect(c.reactors[0].expiration).toBe('30'));
  it('parses reactor uses', () => expect(c.reactors[0].uses).toBe('3'));
  it('parses reactor displayOwner', () => expect(c.reactors[0].displayOwner).toBe(true));
  it('parses reactor displayGroup', () => expect(c.reactors[0].displayGroup).toBe(true));
  it('parses reactor displayStatus', () => expect(c.reactors[0].displayStatus).toBe('OnFire'));
  it('parses reactor displayCookie', () => expect(c.reactors[0].displayCookie).toBe('burned'));
});

// ---------------------------------------------------------------------------
// 3. Minimal
// ---------------------------------------------------------------------------

describe('castableXml — minimal', () => {
  let c;
  beforeAll(async () => { c = await parseCastableXml(MINIMAL_XML); });

  it('parses name', () => expect(c.name).toBe('MinSpell'));
  it('comment defaults to empty string', () => expect(c.comment).toBe(''));
  it('meta defaults to all false', () => {
    expect(c.meta).toEqual({ isTest: false, isGM: false, givenViaScript: false, deprecated: false, specialty: '' });
  });
  it('lines defaults to empty string', () => expect(c.lines).toBe(''));
  it('cooldown defaults to empty string', () => expect(c.cooldown).toBe(''));
  it('icon defaults to empty string', () => expect(c.icon).toBe(''));
  it('book defaults to PrimarySkill', () => expect(c.book).toBe('PrimarySkill'));
  it('elements defaults to None', () => expect(c.elements).toBe('None'));
  it('class defaults to empty string', () => expect(c.class).toBe(''));
  it('isAssail defaults to false', () => expect(c.isAssail).toBe(false));
  it('reflectable defaults to false', () => expect(c.reflectable).toBe(false));
  it('breakStealth defaults to false', () => expect(c.breakStealth).toBe(false));
  it('includeInMetafile defaults to false', () => expect(c.includeInMetafile).toBe(false));
  it('pvpOnly defaults to false', () => expect(c.pvpOnly).toBe(false));
  it('descriptions defaults to empty array', () => expect(c.descriptions).toEqual([]));
  it('categories defaults to empty array', () => expect(c.categories).toEqual([]));
  it('castCosts defaults to empty array', () => expect(c.castCosts).toEqual([]));
  it('intents defaults to empty array', () => expect(c.intents).toEqual([]));
  it('maxLevel defaults to empty per-class with deprecated false', () => {
    expect(c.maxLevel).toEqual({ deprecated: false, monk: '', warrior: '', peasant: '', wizard: '', priest: '', rogue: '' });
  });
  it('mastery defaults to empty with deprecated false', () => {
    expect(c.mastery).toEqual({ deprecated: false, uses: '', modifiers: [], tiered: false });
  });
  it('script defaults to empty string', () => expect(c.script).toBe(''));
  it('scriptOverride defaults to false', () => expect(c.scriptOverride).toBe(false));
  it('requirements defaults to empty array', () => expect(c.requirements).toEqual([]));
  it('sound defaults to id empty string', () => expect(c.sound).toEqual({ id: '' }));
  it('animations onCast defaults to null', () => expect(c.animations.onCast).toBeNull());
  it('animations onEnd defaults to null', () => expect(c.animations.onEnd).toBeNull());
  it('heal defaults to null', () => expect(c.heal).toBeNull());
  it('damage defaults to null', () => expect(c.damage).toBeNull());
  it('statuses defaults to empty add/remove arrays', () => {
    expect(c.statuses).toEqual({ add: [], remove: [] });
  });
  it('restrictions defaults to empty array', () => expect(c.restrictions).toEqual([]));
  it('reactors defaults to empty array', () => expect(c.reactors).toEqual([]));
});

// ---------------------------------------------------------------------------
// 4. Output structure
// ---------------------------------------------------------------------------

describe('castableXml — output structure', () => {
  let raw;
  beforeAll(async () => {
    const castable = {
      name: 'TestSpell',
      comment: 'Test comment',
      meta: { isTest: true, isGM: false, givenViaScript: false, deprecated: false, specialty: '' },
      lines: '1', cooldown: '3', icon: '5', book: 'PrimarySpell',
      elements: 'Wind', class: 'Rogue', isAssail: true, reflectable: false,
      breakStealth: false, includeInMetafile: false, pvpOnly: true,
      descriptions: [{ class: 'Rogue', text: 'Slash!' }],
      categories: ['Physical'],
      castCosts: [
        { type: 'Hp', value: '10' },
        { type: 'Item', itemName: 'Knife', quantity: '1' },
      ],
      intents: [{
        useType: 'UseOnSelf', maxTargets: '', flags: ['Stealth'],
        map: false, crosses: [], cones: [], squares: [],
        lines: [{ length: '2', direction: 'North', visualEffect: 'Targets' }],
        tiles: [],
      }],
      maxLevel: { deprecated: false, monk: '', warrior: '', peasant: '', wizard: '50', priest: '', rogue: '40' },
      mastery: { deprecated: false, uses: '100', modifiers: ['Rank1'], tiered: false },
      script: 'test.cs',
      requirements: [{
        class: 'Rogue', forbidCookie: '', requireCookie: '',
        levelMin: '5', levelMax: '', abMin: '', abMax: '',
        str: '3', int: '3', wis: '3', con: '3', dex: '3',
        gold: '100', items: [],
        prerequisites: { deprecated: false, forbidCookie: '', forbidMessage: '', requireCookie: '', requireMessage: '', castables: [] },
      }],
      scriptOverride: true,
      sound: { id: '3' },
      animations: {
        onCast: {
          player: {
            peasant: { id: '1', speed: '20' }, warrior: { id: '1', speed: '20' },
            wizard: { id: '', speed: '' }, priest: { id: '', speed: '' },
            rogue: { id: '9', speed: '15' }, monk: { id: '', speed: '' },
          },
          spellEffect: { id: '7', speed: '80' },
          target: { id: '4', speed: '10' },
        },
        onEnd: {
          player: {
            peasant: { id: '', speed: '' }, warrior: { id: '', speed: '' },
            wizard: { id: '', speed: '' }, priest: { id: '', speed: '' },
            rogue: { id: '', speed: '' }, monk: { id: '', speed: '' },
          },
          spellEffect: { id: '', speed: '' },
          target: { id: '', speed: '' },
        },
      },
      heal: { kind: 'Formula', value: '', min: '', max: '', formula: 'Hp * 0.5' },
      damage: { kind: 'Static', type: 'Physical', flags: ['None'], value: '25', min: '', max: '', formula: '' },
      statuses: {
        add: [{ name: 'Blind', duration: '5', intensity: '', tick: '' }],
        remove: [{ name: 'Burn', isCategory: false, quantity: '' }],
      },
      restrictions: [{ type: 'NotEquipped', slot: 'Weapon', weaponType: 'Staff', message: 'No staff', itemName: '' }],
      reactors: [{ script: 'r.cs', relativeX: '0', relativeY: '0', sprite: '1', expiration: '10', uses: '2', displayOwner: false, displayGroup: true, displayStatus: '', displayCookie: '' }],
    };
    const xml = serializeCastableXml(castable);
    raw = await rawParse(xml);
  });

  it('root element is Castable', () => expect(raw.Castable).toBeDefined());
  it('Castable has Lines attribute', () => expect(raw.Castable.$.Lines).toBe('1'));
  it('Castable has Book attribute', () => expect(raw.Castable.$.Book).toBe('PrimarySpell'));
  it('Castable has Elements attribute', () => expect(raw.Castable.$.Elements).toBe('Wind'));
  it('Castable has IsAssail attribute', () => expect(raw.Castable.$.IsAssail).toBe('true'));
  it('Castable has PvpOnly attribute', () => expect(raw.Castable.$.PvpOnly).toBe('true'));
  it('Name element present', () => expect(raw.Castable.Name[0]).toBe('TestSpell'));
  it('Descriptions > Description with Class attribute', () => {
    expect(raw.Castable.Descriptions[0].Description[0].$.Class).toBe('Rogue');
    expect(raw.Castable.Descriptions[0].Description[0]._).toBe('Slash!');
  });
  it('Categories > Category', () => expect(raw.Castable.Categories[0].Category[0]).toBe('Physical'));
  it('CastCosts > CastCost > Stat with Hp attribute', () => {
    expect(raw.Castable.CastCosts[0].CastCost[0].Stat[0].$.Hp).toBe('10');
  });
  it('CastCosts > CastCost > Item with Quantity', () => {
    expect(raw.Castable.CastCosts[0].CastCost[0].Item[0].$.Quantity).toBe('1');
    expect(raw.Castable.CastCosts[0].CastCost[0].Item[0]._).toBe('Knife');
  });
  it('Intents > Intent with UseType', () => {
    expect(raw.Castable.Intents[0].Intent[0].$.UseType).toBe('UseOnSelf');
  });
  it('Intents > Intent > Line shape', () => {
    expect(raw.Castable.Intents[0].Intent[0].Line[0].$.Length).toBe('2');
    expect(raw.Castable.Intents[0].Intent[0].Line[0].$.Direction).toBe('North');
  });
  it('MaxLevel with Wizard and Rogue attributes', () => {
    expect(raw.Castable.MaxLevel[0].$.Wizard).toBe('50');
    expect(raw.Castable.MaxLevel[0].$.Rogue).toBe('40');
    expect(raw.Castable.MaxLevel[0].$.Monk).toBeUndefined();
  });
  it('Mastery with Uses and Modifiers', () => {
    expect(raw.Castable.Mastery[0].$.Uses).toBe('100');
    expect(raw.Castable.Mastery[0].$.Modifiers).toBe('Rank1');
  });
  it('Script element present', () => expect(raw.Castable.Script[0]).toBe('test.cs'));
  it('Requirements > Requirement with Level and Gold', () => {
    const req = raw.Castable.Requirements[0].Requirement[0];
    expect(req.$.Class).toBe('Rogue');
    expect(req.Level[0].$.Min).toBe('5');
    expect(req.Gold[0]).toBe('100');
  });
  it('Effects has ScriptOverride attribute', () => {
    expect(raw.Castable.Effects[0].$.ScriptOverride).toBe('true');
  });
  it('Effects > Animations > OnCast > Player > Motion with Class', () => {
    const motions = raw.Castable.Effects[0].Animations[0].OnCast[0].Player[0].Motion;
    const rogue = motions.find((m) => m.$.Class === 'Rogue');
    expect(rogue).toBeDefined();
    expect(rogue.$.Id).toBe('9');
    expect(rogue.$.Speed).toBe('15');
  });
  it('Effects > Animations > OnCast > SpellEffect', () => {
    expect(raw.Castable.Effects[0].Animations[0].OnCast[0].SpellEffect[0].$.Id).toBe('7');
    expect(raw.Castable.Effects[0].Animations[0].OnCast[0].SpellEffect[0].$.Speed).toBe('80');
  });
  it('Effects > Animations > OnCast > Target', () => {
    expect(raw.Castable.Effects[0].Animations[0].OnCast[0].Target[0].$.Id).toBe('4');
  });
  it('Effects > Animations > OnEnd omits SpellEffect when id is empty', () => {
    expect(raw.Castable.Effects[0].Animations[0].OnEnd).toBeUndefined();
  });
  it('Effects > Sound with Id', () => {
    expect(raw.Castable.Effects[0].Sound[0].$.Id).toBe('3');
  });
  it('Effects > Heal > Formula', () => {
    expect(raw.Castable.Effects[0].Heal[0].Formula[0]).toBe('Hp * 0.5');
  });
  it('Effects > Damage with Type and Flags', () => {
    const dmg = raw.Castable.Effects[0].Damage[0];
    expect(dmg.$.Type).toBe('Physical');
    expect(dmg.Flags[0]).toBe('None');
    expect(dmg.Simple[0]).toBe('25');
  });
  it('Effects > Statuses > Add', () => {
    const add = raw.Castable.Effects[0].Statuses[0].Add[0];
    expect(add.$.Duration).toBe('5');
    expect(add._).toBe('Blind');
  });
  it('Effects > Statuses > Remove without attributes serializes as plain text', () => {
    // isCategory=false and no quantity → no attributes → xml2js parses as plain string
    const rem = raw.Castable.Effects[0].Statuses[0].Remove[0];
    expect(rem).toBe('Burn');
  });
  it('Restrictions > Item with RestrictionType and Slot', () => {
    const r = raw.Castable.Restrictions[0].Item[0];
    expect(r.$.RestrictionType).toBe('NotEquipped');
    expect(r.$.Slot).toBe('Weapon');
    expect(r.$.WeaponType).toBe('Staff');
  });
  it('Effects > Reactors > Reactor with Script and DisplayGroup', () => {
    const reactor = raw.Castable.Effects[0].Reactors[0].Reactor[0];
    expect(reactor.$.Script).toBe('r.cs');
    expect(reactor.$.DisplayGroup).toBe('true');
    expect(reactor.$.DisplayOwner).toBeUndefined();
  });
});
