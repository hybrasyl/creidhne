import xml2js from 'xml2js';

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02';

const STAT_KEYS = new Set([
  'BaseStr','BaseInt','BaseWis','BaseCon','BaseDex','BaseHp','BaseMp',
  'CurrentHp','CurrentMp','CurrentGold','CurrentXp','CurrentFaith',
  'BaseHit','BaseDmg','BaseAc','BaseRegen','BaseMr','BaseCrit','BaseMagicCrit',
  'BaseInboundDamageToMp','BaseOffensiveElement','BaseDefensiveElement','BaseExtraFaith',
  'OffensiveElementOverride','DefensiveElementOverride',
  'BaseInboundDamageModifier','BaseOutboundDamageModifier',
  'BaseInboundHealModifier','BaseOutboundHealModifier','DamageType',
  'BaseReflectMagical','BaseReflectPhysical','BaseExtraGold','BaseDodge','BaseMagicDodge',
  'BaseExtraXp','BaseExtraItemFind','BaseLifeSteal','BaseManaSteal',
  'BonusStr','BonusInt','BonusWis','BonusCon','BonusDex','BonusHp','BonusMp',
  'BonusHit','BonusDmg','BonusAc','BonusRegen','BonusMr','BonusCrit','BonusMagicCrit',
  'BonusInboundDamageModifier','BonusOutboundDamageModifier',
  'BonusInboundHealModifier','BonusOutboundHealModifier',
  'BonusReflectMagical','BonusReflectPhysical','BonusExtraGold','BonusDodge','BonusMagicDodge',
  'BonusExtraXp','BonusExtraItemFind','BonusLifeSteal','BonusManaSteal',
  'BonusInboundDamageToMp','BonusExtraFaith','Shield',
]);

const first = (arr, def = undefined) => Array.isArray(arr) && arr.length ? arr[0] : def;
const a = (node, key, def = '') => node?.$?.[key] ?? def;
const toBool = (val, def = false) =>
  val === 'true' ? true : val === 'false' ? false : val === undefined ? def : Boolean(val);
const spaceList = (str) => (str || '').split(' ').filter(Boolean);
const omitEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined));

// =============================================================================
// PARSER
// =============================================================================

export function parseVariantXml(xmlString) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err);
      try { resolve(mapXmlToVariantGroup(result)); }
      catch (e) { reject(e); }
    });
  });
}

function mapXmlToVariantGroup(result) {
  const root = result.VariantGroup;
  return {
    name: first(root.Name, ''),
    comment: first(root.Comment, ''),
    prefix: first(root.Prefix, ''),
    variants: (root.Variant || []).map(mapVariant),
  };
}

function mapVariant(v) {
  const props = first(v.Properties, {});
  return {
    name: first(v.Name, ''),
    modifier: first(v.Modifier, ''),
    comment: first(v.Comment, ''),
    properties: {
      tags: spaceList(a(props, 'Tags')),
      script: first(props.Script, ''),
      stackable: { max: a(first(props.Stackable), 'Max', '') },
      appearance: parseAppearance(first(props.Appearance)),
      flags: spaceList(first(props.Flags, '')),
      physical: parsePhysical(first(props.Physical)),
      restrictions: parseRestrictions(first(props.Restrictions)),
      statModifiers: parseStatModifiers(first(props.StatModifiers)),
    },
  };
}

function parseAppearance(node) {
  if (!node) return { sprite: '', equipSprite: '', displaySprite: '', styleEnabled: false, bodyStyle: 'Transparent', color: 'None', hideBoots: false };
  const bodyStyle = a(node, 'BodyStyle', 'Transparent');
  const color = a(node, 'Color', 'None');
  const hideBoots = toBool(a(node, 'HideBoots'), false);
  return {
    sprite: a(node, 'Sprite', ''),
    equipSprite: a(node, 'EquipSprite', ''),
    displaySprite: a(node, 'DisplaySprite', ''),
    styleEnabled: bodyStyle !== 'Transparent' || color !== 'None' || hideBoots,
    bodyStyle,
    color,
    hideBoots,
  };
}

function parsePhysical(node) {
  if (!node) return { value: '', weight: '', durability: '' };
  return {
    value: a(node, 'Value', ''),
    weight: a(node, 'Weight', ''),
    durability: a(node, 'Durability', ''),
  };
}

function parseStatModifiers(node) {
  if (!node) return { rows: [], elementalModifiers: [] };
  const attrs = node.$ || {};
  const rows = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (STAT_KEYS.has(k)) rows.push({ key: k, value: v });
  }
  const emList = first(node.ElementalModifiers, {});
  const elementalModifiers = (emList.ElementalModifier || []).map((em) => ({
    type: a(em, 'Type', 'Augment'),
    element: a(em, 'Element', 'None'),
    modifier: a(em, 'Modifier', '1'),
  }));
  return { rows, elementalModifiers };
}

function parseRestrictions(node) {
  const defaults = {
    level: { min: '1', max: '99' },
    ab: null,
    class: 'All',
    gender: 'Neutral',
    castables: [],
    slotRestrictions: [],
  };
  if (!node) return defaults;
  const lev = first(node.Level);
  const ab = first(node.Ab);
  const cast = first(node.Castables);
  const rawClass = first(node.Class, '');
  return {
    level: { min: a(lev, 'Min', '1'), max: a(lev, 'Max', '99') },
    ab: ab ? { min: a(ab, 'Min', '0'), max: a(ab, 'Max', '255') } : null,
    class: rawClass || 'All',
    gender: first(node.Gender, 'Neutral'),
    castables: (cast?.Castable || []).map((c) => (typeof c === 'string' ? c : c._ ?? '')),
    slotRestrictions: [],
  };
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeVariantXml(variantGroup) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' },
  });
  return builder.buildObject(buildXmlObject(variantGroup));
}

function buildXmlObject(vg) {
  const root = { $: { xmlns: XMLNS } };
  root.Name = [vg.name];
  if (vg.comment) root.Comment = [vg.comment];
  if (vg.prefix) root.Prefix = [vg.prefix];
  root.Variant = vg.variants.map(buildVariant);
  return { VariantGroup: root };
}

function buildVariant(v) {
  const node = {};
  node.Name = [v.name];
  node.Modifier = [v.modifier];
  if (v.comment) node.Comment = [v.comment];
  node.Properties = [buildVariantProperties(v.properties)];
  return node;
}

function buildVariantProperties(p) {
  const propsObj = {};
  if (p.tags.length) propsObj.$ = { Tags: p.tags.join(' ') };

  if (p.appearance.sprite !== '') {
    propsObj.Appearance = [{ $: omitEmpty({
      Sprite: String(p.appearance.sprite),
      EquipSprite: p.appearance.equipSprite !== '' ? String(p.appearance.equipSprite) : undefined,
      DisplaySprite: p.appearance.displaySprite !== '' ? String(p.appearance.displaySprite) : undefined,
      ...(p.appearance.styleEnabled ? {
        BodyStyle: p.appearance.bodyStyle !== 'Transparent' ? p.appearance.bodyStyle : undefined,
        Color: p.appearance.color !== 'None' ? p.appearance.color : undefined,
        HideBoots: p.appearance.hideBoots ? 'true' : undefined,
      } : {}),
    }) }];
  }

  if (p.flags.length) propsObj.Flags = [p.flags.join(' ')];

  if (p.physical.value || p.physical.weight || p.physical.durability) {
    propsObj.Physical = [{ $: omitEmpty({
      Value: p.physical.value || undefined,
      Weight: p.physical.weight || undefined,
      Durability: p.physical.durability || undefined,
    }) }];
  }

  propsObj.Restrictions = [buildRestrictions(p.restrictions)];

  if (p.script) propsObj.Script = [p.script];

  if (p.stackable.max) {
    propsObj.Stackable = [{ $: { Max: String(p.stackable.max) } }];
  }

  if (p.statModifiers.rows.length || p.statModifiers.elementalModifiers.length) {
    const smNode = { $: Object.fromEntries(p.statModifiers.rows.map((r) => [r.key, r.value])) };
    if (p.statModifiers.elementalModifiers.length) {
      smNode.ElementalModifiers = [{
        ElementalModifier: p.statModifiers.elementalModifiers.map((em) => ({
          $: { Type: em.type, Element: em.element, Modifier: em.modifier },
        })),
      }];
    }
    propsObj.StatModifiers = [smNode];
  }

  return propsObj;
}

const ALL_CLASSES = 'Peasant Wizard Rogue Monk Warrior Priest';

function buildRestrictions(r) {
  const node = {};
  node.Level = [{ $: omitEmpty({ Min: String(r.level?.min ?? '1'), Max: String(r.level?.max ?? '99') }) }];
  node.Class = [r.class === 'All' ? ALL_CLASSES : (r.class || ALL_CLASSES)];
  if (r.ab) node.Ab = [{ $: omitEmpty({ Min: r.ab.min !== '0' ? String(r.ab.min) : undefined, Max: r.ab.max !== '255' ? String(r.ab.max) : undefined }) }];
  if (r.gender && r.gender !== 'Neutral') node.Gender = [r.gender];
  if (r.castables?.length) node.Castables = [{ Castable: r.castables }];
  return node;
}
