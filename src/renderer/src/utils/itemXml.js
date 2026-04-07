import xml2js from 'xml2js';

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02';

// Known StatModifier attribute names (used to filter out xmlns/other attrs)
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

// --- Helpers ---
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

export function parseItemXml(xmlString) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err);
      try { resolve(mapXmlToItem(result)); }
      catch (e) { reject(e); }
    });
  });
}

function mapXmlToItem(result) {
  const root = result.Item;
  const props = first(root.Properties, {});
  return {
    name: first(root.Name, ''),
    unidentifiedName: first(root.UnidentifiedName, ''),
    comment: first(root.Comment, ''),
    includeInMetafile: toBool(a(root, 'IncludeInMetafile'), true),
    properties: {
      tags: spaceList(a(props, 'Tags')),
      appearance: parseAppearance(first(props.Appearance)),
      stackable: { max: a(first(props.Stackable), 'Max', '1') },
      physical: parsePhysical(first(props.Physical)),
      categories: parseCategories(first(props.Categories)),
      equipment: parseEquipment(first(props.Equipment)),
      statModifiers: parseStatModifiers(first(props.StatModifiers)),
      flags: spaceList(first(props.Flags, '')),
      variants: parseVariants(first(props.Variants)),
      vendor: parseVendor(first(props.Vendor)),
      damage: parseDamage(first(props.Damage)),
      use: parseUse(first(props.Use)),
      restrictions: parseRestrictions(first(props.Restrictions)),
      motions: parseMotions(props.Motion || props.Motions),
      castModifiers: parseCastModifiers(first(props.CastModifiers)),
      procs: parseProcs(first(props.Procs)),
    },
  };
}

function parseAppearance(node) {
  if (!node) return { sprite: '', equipSprite: '', displaySprite: '', bodyStyle: 'Transparent', color: 'None', hideBoots: false };
  return {
    sprite: a(node, 'Sprite', ''),
    equipSprite: a(node, 'EquipSprite', ''),
    displaySprite: a(node, 'DisplaySprite', ''),
    bodyStyle: a(node, 'BodyStyle', 'Transparent'),
    color: a(node, 'Color', 'None'),
    hideBoots: toBool(a(node, 'HideBoots'), false),
  };
}

function parsePhysical(node) {
  if (!node) return { value: '1', weight: '1', durability: '1' };
  return { value: a(node, 'Value', '1'), weight: a(node, 'Weight', '1'), durability: a(node, 'Durability', '1') };
}

function parseCategories(node) {
  if (!node) return [];
  return (node.Category || []).map((c) =>
    typeof c === 'string' ? { name: c, unique: false } : { name: c._ ?? c, unique: toBool(a(c, 'Unique'), false) }
  );
}

function parseEquipment(node) {
  if (!node) return null;
  return { slot: a(node, 'Slot', 'None'), weaponType: a(node, 'WeaponType', 'None') };
}

function parseStatModifiers(node) {
  if (!node) return { rows: [], elementalModifiers: [] };
  const attrs = node.$ || {};
  const rows = Object.entries(attrs)
    .filter(([k]) => STAT_KEYS.has(k))
    .map(([key, value]) => ({ key, value }));
  const emList = first(node.ElementalModifiers, {});
  const elementalModifiers = (emList.ElementalModifier || []).map((em) => ({
    type: a(em, 'Type', 'Augment'),
    element: a(em, 'Element', 'None'),
    modifier: a(em, 'Modifier', '1'),
  }));
  return { rows, elementalModifiers };
}

function parseVariants(node) {
  if (!node) return { names: [], groups: [] };
  const groups = (node.Group || []).map((g) => (typeof g === 'string' ? g : g._ ?? ''));
  const names = (node.Name || []).map((n) =>
    typeof n === 'string' ? { group: '', value: n } : { group: a(n, 'Group', ''), value: n._ ?? '' }
  );
  return { names, groups };
}

function parseVendor(node) {
  if (!node) return null;
  return { shopTab: a(node, 'ShopTab', ''), description: first(node.Description, '') };
}

function parseDamage(node) {
  if (!node) return null;
  return {
    smallMin: a(node, 'SmallMin', '0'), smallMax: a(node, 'SmallMax', '0'),
    largeMin: a(node, 'LargeMin', '0'), largeMax: a(node, 'LargeMax', '0'),
  };
}

function parseUse(node) {
  if (!node) return null;
  const tel = first(node.Teleport);
  const eff = first(node.Effect);
  const snd = first(node.Sound);
  const stat = first(node.Statuses);
  return {
    script: first(node.Script, ''),
    teleport: tel ? { map: tel._ ?? '', x: a(tel, 'X', '0'), y: a(tel, 'Y', '0') } : null,
    effect: eff ? { id: a(eff, 'Id', '0'), speed: a(eff, 'Speed', '100') } : null,
    sound: snd ? { id: a(snd, 'Id', '1') } : null,
    statuses: {
      add: (stat?.Add || []).map((s) => ({
        name: s._ ?? '',
        duration: a(s, 'Duration', '0'),
        intensity: a(s, 'Intensity', '1.0'),
        tick: a(s, 'Tick', '0'),
        removeChance: a(s, 'RemoveChance', ''),
        persistDeath: toBool(a(s, 'PersistDeath'), false),
      })),
      remove: (stat?.Remove || []).map((s) => ({
        name: s._ ?? '',
        isCategory: toBool(a(s, 'IsCategory'), false),
        quantity: a(s, 'Quantity', '1'),
      })),
    },
  };
}

function parseRestrictions(node) {
  if (!node) return null;
  const lev = first(node.Level);
  const ab = first(node.Ab);
  const cast = first(node.Castables);
  const slots = first(node.SlotRestrictions);
  return {
    level: { min: a(lev, 'Min', '0'), max: a(lev, 'Max', '255') },
    ab: { min: a(ab, 'Min', '0'), max: a(ab, 'Max', '255') },
    class: first(node.Class, 'Peasant'),
    gender: first(node.Gender, 'Neutral'),
    castables: (cast?.Castable || []).map((c) => (typeof c === 'string' ? c : c._ ?? '')),
    slotRestrictions: (slots?.SlotRestriction || []).map((sr) => ({
      type: a(sr, 'Type', 'ItemRequired'),
      slot: a(sr, 'Slot', 'None'),
      message: a(sr, 'Message', ''),
    })),
  };
}

function parseMotions(nodeArr) {
  if (!nodeArr) return [];
  const container = first(Array.isArray(nodeArr) ? nodeArr : [nodeArr], {});
  return (container.Motion || []).map((m) => ({ id: a(m, 'Id', ''), speed: a(m, 'Speed', '') }));
}

function parseCastModifiers(node) {
  if (!node) return [];
  return (node.Match || []).map((match) => ({
    group: a(match, 'Group', ''),
    castable: a(match, 'Castable', ''),
    all: toBool(a(match, 'All'), false),
    add: (match.Add || []).map(parseOp),
    subtract: (match.Subtract || []).map(parseOp),
    replace: (match.Replace || []).map(parseOp),
  }));
}

function parseOp(op) {
  return { match: a(op, 'Match', '-1'), amount: a(op, 'Amount', '0'), min: a(op, 'Min', '-1'), max: a(op, 'Max', '255') };
}

function parseProcs(node) {
  if (!node) return [];
  return (node.Proc || []).map((p) => ({
    type: a(p, 'Type', 'OnUse'),
    castable: a(p, 'Castable', ''),
    script: a(p, 'Script', ''),
    chance: a(p, 'Chance', '0'),
  }));
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeItemXml(item) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' },
  });
  return builder.buildObject(buildXmlObject(item));
}

function buildXmlObject(item) {
  const p = item.properties;
  const propsObj = {};

  if (p.tags.length) propsObj.$ = { Tags: p.tags.join(' ') };

  propsObj.Appearance = [{ $: omitEmpty({
    Sprite: String(p.appearance.sprite),
    EquipSprite: p.appearance.equipSprite !== '' ? String(p.appearance.equipSprite) : undefined,
    DisplaySprite: p.appearance.displaySprite !== '' ? String(p.appearance.displaySprite) : undefined,
    BodyStyle: p.appearance.bodyStyle !== 'Transparent' ? p.appearance.bodyStyle : undefined,
    Color: p.appearance.color !== 'None' ? p.appearance.color : undefined,
    HideBoots: p.appearance.hideBoots ? 'true' : undefined,
  }) }];

  if (p.categories.length) {
    propsObj.Categories = [{ Category: p.categories.map((c) => c.name) }];
  }

  if (p.castModifiers.length) {
    propsObj.CastModifiers = [{ Match: p.castModifiers.map(buildCastModifier) }];
  }

  propsObj.Stackable = [{ $: { Max: String(p.stackable.max) } }];
  propsObj.Physical = [{ $: omitEmpty({ Value: String(p.physical.value), Weight: String(p.physical.weight), Durability: String(p.physical.durability) }) }];

  if (p.equipment) {
    propsObj.Equipment = [{ $: omitEmpty({ Slot: p.equipment.slot, WeaponType: p.equipment.weaponType !== 'None' ? p.equipment.weaponType : undefined }) }];
  }

  if (p.statModifiers.rows.length || p.statModifiers.elementalModifiers.length) {
    const smAttrs = Object.fromEntries(p.statModifiers.rows.map((r) => [r.key, r.value]));
    const smNode = { $: smAttrs };
    if (p.statModifiers.elementalModifiers.length) {
      smNode.ElementalModifiers = [{ ElementalModifier: p.statModifiers.elementalModifiers.map((em) => ({ $: { Type: em.type, Element: em.element, Modifier: em.modifier } })) }];
    }
    propsObj.StatModifiers = [smNode];
  }

  if (p.flags.length) propsObj.Flags = [p.flags.join(' ')];

  if (p.variants.groups.length || p.variants.names.length) {
    const varNode = {};
    if (p.variants.groups.length) varNode.Group = p.variants.groups;
    if (p.variants.names.length) varNode.Name = p.variants.names.map((n) => ({ $: { Group: n.group }, _: n.value }));
    propsObj.Variants = [varNode];
  }

  if (p.vendor && (p.vendor.shopTab || p.vendor.description)) {
    const vendorNode = { $: { ShopTab: p.vendor.shopTab } };
    if (p.vendor.description) vendorNode.Description = [p.vendor.description];
    propsObj.Vendor = [vendorNode];
  }

  if (p.damage) {
    propsObj.Damage = [{ $: { SmallMin: String(p.damage.smallMin), SmallMax: String(p.damage.smallMax), LargeMin: String(p.damage.largeMin), LargeMax: String(p.damage.largeMax) } }];
  }

  if (p.use) propsObj.Use = [buildUse(p.use)];

  if (p.restrictions) propsObj.Restrictions = [buildRestrictions(p.restrictions)];

  if (p.motions.length) {
    propsObj.Motion = [{ Motion: p.motions.map((m) => ({ $: omitEmpty({ Id: String(m.id), Speed: String(m.speed) }) })) }];
  }

  if (p.procs.length) {
    propsObj.Procs = [{ Proc: p.procs.map((pr) => ({ $: omitEmpty({ Type: pr.type, Castable: pr.castable || undefined, Script: pr.script || undefined, Chance: String(pr.chance) }) })) }];
  }

  const itemAttrs = { xmlns: XMLNS };
  if (!item.includeInMetafile) itemAttrs.IncludeInMetafile = 'false';

  return {
    Item: {
      $: itemAttrs,
      Name: [item.name],
      ...(item.unidentifiedName ? { UnidentifiedName: [item.unidentifiedName] } : {}),
      ...(item.comment ? { Comment: [item.comment] } : {}),
      Properties: [propsObj],
    },
  };
}

function buildCastModifier(cm) {
  const node = { $: omitEmpty({ Group: cm.group || undefined, Castable: cm.castable || undefined, All: cm.all ? 'true' : undefined }) };
  if (cm.add.length) node.Add = cm.add.map(buildOp);
  if (cm.subtract.length) node.Subtract = cm.subtract.map(buildOp);
  if (cm.replace.length) node.Replace = cm.replace.map(buildOp);
  return node;
}

function buildOp(op) {
  return { $: omitEmpty({ Match: op.match !== '-1' ? String(op.match) : undefined, Amount: String(op.amount), Min: op.min !== '-1' ? String(op.min) : undefined, Max: op.max !== '255' ? String(op.max) : undefined }) };
}

function buildUse(use) {
  const node = {};
  if (use.script) node.Script = [use.script];
  if (use.teleport) node.Teleport = [{ $: { X: String(use.teleport.x), Y: String(use.teleport.y) }, _: use.teleport.map }];
  if (use.effect) node.Effect = [{ $: omitEmpty({ Id: String(use.effect.id), Speed: use.effect.speed !== '100' ? String(use.effect.speed) : undefined }) }];
  if (use.sound) node.Sound = [{ $: { Id: String(use.sound.id) } }];
  const adds = use.statuses?.add || [];
  const removes = use.statuses?.remove || [];
  if (adds.length || removes.length) {
    const statNode = {};
    if (adds.length) statNode.Add = adds.map((s) => ({ $: omitEmpty({ Duration: String(s.duration), Intensity: String(s.intensity), Tick: String(s.tick), RemoveChance: s.removeChance || undefined, PersistDeath: s.persistDeath ? 'true' : undefined }), _: s.name }));
    if (removes.length) statNode.Remove = removes.map((s) => ({ $: omitEmpty({ IsCategory: s.isCategory ? 'true' : undefined, Quantity: String(s.quantity) }), _: s.name }));
    node.Statuses = [statNode];
  }
  return node;
}

function buildRestrictions(r) {
  const node = {};
  if (r.level) node.Level = [{ $: omitEmpty({ Min: r.level.min !== '0' ? String(r.level.min) : undefined, Max: r.level.max !== '255' ? String(r.level.max) : undefined }) }];
  if (r.ab) node.Ab = [{ $: omitEmpty({ Min: r.ab.min !== '0' ? String(r.ab.min) : undefined, Max: r.ab.max !== '255' ? String(r.ab.max) : undefined }) }];
  if (r.class && r.class !== 'Peasant') node.Class = [r.class];
  if (r.gender && r.gender !== 'Neutral') node.Gender = [r.gender];
  if (r.castables?.length) node.Castables = [{ Castable: r.castables }];
  if (r.slotRestrictions?.length) {
    node.SlotRestrictions = [{ SlotRestriction: r.slotRestrictions.map((sr) => ({ $: { Type: sr.type, Slot: sr.slot, Message: sr.message } })) }];
  }
  return node;
}
