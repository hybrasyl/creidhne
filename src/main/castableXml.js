import xml2js from 'xml2js';

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02';

const first = (arr, def = undefined) => Array.isArray(arr) && arr.length ? arr[0] : def;
const a = (node, key, def = '') => node?.$?.[key] ?? def;

// =============================================================================
// PARSER
// =============================================================================

function mapDescriptions(descsNode) {
  const node = first(descsNode);
  if (!node) return [];
  return (node.Description || []).map((d) => ({
    class: a(d, 'Class', ''),
    text: typeof d === 'string' ? d : (d._ ?? ''),
  }));
}

function mapCategories(catsNode) {
  const node = first(catsNode);
  if (!node) return [];
  return (node.Category || []).map((c) => (typeof c === 'string' ? c : (c._ ?? String(c))));
}

function mapCastCosts(costsNode) {
  const costsWrapper = first(costsNode);
  if (!costsWrapper) return [];
  const castCostNode = first(costsWrapper.CastCost);
  if (!castCostNode) return [];

  const costs = [];

  for (const stat of (castCostNode.Stat || [])) {
    const attrs = stat.$ || {};
    if ('Hp' in attrs)   costs.push({ type: 'Hp',   value: attrs.Hp });
    if ('Mp' in attrs)   costs.push({ type: 'Mp',   value: attrs.Mp });
    if ('Gold' in attrs) costs.push({ type: 'Gold', value: attrs.Gold });
  }

  for (const item of (castCostNode.Item || [])) {
    costs.push({
      type:     'Item',
      quantity: a(item, 'Quantity', '1'),
      itemName: typeof item === 'string' ? item : (item._ ?? ''),
    });
  }

  return costs;
}

function mapIntents(intentsNode) {
  const node = first(intentsNode);
  if (!node) return [];
  return (node.Intent || []).map((intent) => {
    const flagsRaw = a(intent, 'Flags', '');
    return {
      useType:    a(intent, 'UseType',    'NoTarget'),
      maxTargets: a(intent, 'MaxTargets', ''),
      flags:      flagsRaw ? flagsRaw.split(' ').filter(Boolean) : [],
      map:        !!(intent.Map && intent.Map.length),
      crosses: (intent.Cross  || []).map((c) => ({
        radius:       a(c, 'Radius',       ''),
        visualEffect: a(c, 'VisualEffect', 'Targets'),
      })),
      cones: (intent.Cone   || []).map((c) => ({
        radius:       a(c, 'Radius',       ''),
        direction:    a(c, 'Direction',    'None'),
        visualEffect: a(c, 'VisualEffect', 'Targets'),
      })),
      squares: (intent.Square || []).map((s) => ({
        side:         a(s, 'Side',         ''),
        visualEffect: a(s, 'VisualEffect', 'Targets'),
      })),
      lines: (intent.Line   || []).map((l) => ({
        length:       a(l, 'Length',       ''),
        direction:    a(l, 'Direction',    'None'),
        visualEffect: a(l, 'VisualEffect', 'Targets'),
      })),
      tiles: (intent.Tile   || []).map((t) => ({
        direction:    a(t, 'Direction',    'None'),
        relativeX:    a(t, 'RelativeX',   '0'),
        relativeY:    a(t, 'RelativeY',   '0'),
        visualEffect: a(t, 'VisualEffect', 'Targets'),
      })),
    };
  });
}

// Extracts an attribute value from a raw attribute string, e.g. Monk="11"
function extractAttr(attrStr, name) {
  const m = new RegExp(`${name}="([^"]*)"`, 'i').exec(attrStr);
  return m ? m[1] : '';
}

function mapMaxLevel(root, xmlString) {
  // Active element — xml2js handles it normally
  const active = first(root.MaxLevel);
  if (active) {
    return {
      deprecated: false,
      monk:    a(active, 'Monk',    ''),
      warrior: a(active, 'Warrior', ''),
      peasant: a(active, 'Peasant', ''),
      wizard:  a(active, 'Wizard',  ''),
      priest:  a(active, 'Priest',  ''),
      rogue:   a(active, 'Rogue',   ''),
    };
  }
  // Commented-out element — xml2js ignores comments, use regex on raw string
  const m = /<!--\s*<MaxLevel([^>]*)\/>\s*-->/.exec(xmlString);
  if (m) {
    const s = m[1];
    return {
      deprecated: true,
      monk:    extractAttr(s, 'Monk'),
      warrior: extractAttr(s, 'Warrior'),
      peasant: extractAttr(s, 'Peasant'),
      wizard:  extractAttr(s, 'Wizard'),
      priest:  extractAttr(s, 'Priest'),
      rogue:   extractAttr(s, 'Rogue'),
    };
  }
  return { deprecated: false, monk: '', warrior: '', peasant: '', wizard: '', priest: '', rogue: '' };
}

function mapMastery(root, xmlString) {
  const active = first(root.Mastery);
  if (active) {
    const modStr = a(active, 'Modifiers', '');
    return {
      deprecated: false,
      uses:       a(active, 'Uses',   ''),
      modifiers:  modStr ? modStr.split(' ').filter(Boolean) : [],
      tiered:     a(active, 'Tiered', 'false') === 'true',
    };
  }
  const m = /<!--\s*<Mastery([^/]*)\/>\s*-->/.exec(xmlString);
  if (m) {
    const s    = m[1];
    const modStr = extractAttr(s, 'Modifiers');
    return {
      deprecated: true,
      uses:       extractAttr(s, 'Uses'),
      modifiers:  modStr ? modStr.split(' ').filter(Boolean) : [],
      tiered:     extractAttr(s, 'Tiered') === 'true',
    };
  }
  return { deprecated: false, uses: '', modifiers: [], tiered: false };
}

function mapPrerequisites(prereqNode) {
  return {
    deprecated:     false,
    forbidCookie:   a(prereqNode, 'ForbidCookie',   ''),
    forbidMessage:  a(prereqNode, 'ForbidMessage',  ''),
    requireCookie:  a(prereqNode, 'RequireCookie',  ''),
    requireMessage: a(prereqNode, 'RequireMessage', ''),
    castables: (prereqNode.Prerequisite || []).map((p) => ({
      name:  typeof p === 'string' ? p : (p._ ?? ''),
      level: a(p, 'Level', ''),
    })),
  };
}

function mapCommentedPrerequisites(rawBlock) {
  const openTagMatch = /^<Prerequisites([^>]*)>/.exec(rawBlock.trim());
  const attrStr = openTagMatch ? openTagMatch[1] : '';
  const castables = [];
  const prereqRe = /<Prerequisite([^>]*)>([^<]*)<\/Prerequisite>/g;
  let m;
  while ((m = prereqRe.exec(rawBlock)) !== null) {
    castables.push({ name: m[2].trim(), level: extractAttr(m[1], 'Level') });
  }
  return {
    deprecated:     true,
    forbidCookie:   extractAttr(attrStr, 'ForbidCookie'),
    forbidMessage:  extractAttr(attrStr, 'ForbidMessage'),
    requireCookie:  extractAttr(attrStr, 'RequireCookie'),
    requireMessage: extractAttr(attrStr, 'RequireMessage'),
    castables,
  };
}

function extractCommentedPrerequisitesForIndex(xmlString, index) {
  const segments = xmlString.split('</Requirement>');
  const chunk = segments[index] || '';
  const m = /<!--\s*(<Prerequisites[\s\S]*?<\/Prerequisites>)\s*-->/.exec(chunk);
  return m ? m[1] : null;
}

function mapRequirements(reqsNode, xmlString) {
  const node = first(reqsNode);
  if (!node) return [];
  return (node.Requirement || []).map((req, idx) => {
    const levelNode = first(req.Level);
    const abNode    = first(req.Ab);
    const physNode  = first(req.Physical);
    const itemsNode = first(req.Items);
    const items = (itemsNode?.Item || []).map((item) => ({
      itemName: typeof item === 'string' ? item : (item._ ?? ''),
      quantity: a(item, 'Quantity', '1'),
    }));
    const activePrereq = first(req.Prerequisites);
    let prerequisites;
    if (activePrereq) {
      prerequisites = mapPrerequisites(activePrereq);
    } else {
      const block = extractCommentedPrerequisitesForIndex(xmlString, idx);
      prerequisites = block ? mapCommentedPrerequisites(block)
        : { deprecated: true, forbidCookie: '', forbidMessage: '', requireCookie: '', requireMessage: '', castables: [] };
    }
    return {
      class:         a(req, 'Class',         ''),
      forbidCookie:  a(req, 'ForbidCookie',  ''),
      requireCookie: a(req, 'RequireCookie', ''),
      levelMin: levelNode ? a(levelNode, 'Min', '') : '',
      levelMax: levelNode ? a(levelNode, 'Max', '') : '',
      abMin:    abNode    ? a(abNode,    'Min', '') : '',
      abMax:    abNode    ? a(abNode,    'Max', '') : '',
      gold:     first(req.Gold, ''),
      str: physNode ? a(physNode, 'Str', '3') : '3',
      int: physNode ? a(physNode, 'Int', '3') : '3',
      wis: physNode ? a(physNode, 'Wis', '3') : '3',
      con: physNode ? a(physNode, 'Con', '3') : '3',
      dex: physNode ? a(physNode, 'Dex', '3') : '3',
      items,
      prerequisites,
    };
  });
}

function mapRestrictions(restrictsNode) {
  const node = first(restrictsNode);
  if (!node) return [];
  return (node.Item || []).map((item) => ({
    type:       a(item, 'RestrictionType', 'Equipped'),
    slot:       a(item, 'Slot',           'None'),
    weaponType: a(item, 'WeaponType',     'None'),
    message:    a(item, 'Message',        ''),
    itemName:   typeof item === 'string' ? item : (item._ ?? ''),
  }));
}

const DEFAULT_MOTION        = { id: '', speed: '' };
const DEFAULT_PLAYER_MOTION = { id: '1', speed: '20' };
const DEFAULT_PLAYER = {
  peasant: { ...DEFAULT_PLAYER_MOTION }, warrior: { ...DEFAULT_PLAYER_MOTION },
  wizard:  { ...DEFAULT_PLAYER_MOTION }, priest:  { ...DEFAULT_PLAYER_MOTION },
  rogue:   { ...DEFAULT_PLAYER_MOTION }, monk:    { ...DEFAULT_PLAYER_MOTION },
};
const EMPTY_PLAYER = {
  peasant: { ...DEFAULT_MOTION }, warrior: { ...DEFAULT_MOTION },
  wizard:  { ...DEFAULT_MOTION }, priest:  { ...DEFAULT_MOTION },
  rogue:   { ...DEFAULT_MOTION }, monk:    { ...DEFAULT_MOTION },
};
const DEFAULT_GROUP = { player: { ...DEFAULT_PLAYER }, target: { ...DEFAULT_MOTION } };
const EMPTY_GROUP   = { player: { ...EMPTY_PLAYER },   target: { ...DEFAULT_MOTION } };

function mapAnimationGroup(groupArr, emptyDefaults = false) {
  const group = first(groupArr);
  if (!group) return emptyDefaults ? { ...EMPTY_GROUP } : { ...DEFAULT_GROUP };

  const player = emptyDefaults ? { ...EMPTY_PLAYER } : { ...DEFAULT_PLAYER };
  const fallbackMotion = emptyDefaults ? DEFAULT_MOTION : DEFAULT_PLAYER_MOTION;
  const playerNode = first(group.Player);
  if (playerNode) {
    for (const motion of (playerNode.Motion || [])) {
      const cls = a(motion, 'Class', '').toLowerCase();
      if (cls && cls in player) {
        player[cls] = { id: a(motion, 'Id', fallbackMotion.id), speed: a(motion, 'Speed', fallbackMotion.speed) };
      }
    }
  }

  const targetNode = first(group.Target);
  const target = targetNode
    ? { id: a(targetNode, 'Id', ''), speed: a(targetNode, 'Speed', '') }
    : { ...DEFAULT_MOTION };

  return { player, target };
}

function mapAnimations(effectsNode) {
  const ew = first(effectsNode);
  if (!ew) return { onCast: { ...DEFAULT_GROUP }, onEnd: { ...EMPTY_GROUP } };
  const animNode = first(ew.Animations);
  if (!animNode) return { onCast: { ...DEFAULT_GROUP }, onEnd: { ...EMPTY_GROUP } };
  return {
    onCast: mapAnimationGroup(animNode.OnCast),
    onEnd:  mapAnimationGroup(animNode.OnEnd, true),
  };
}

function mapSound(effectsNode) {
  const ew = first(effectsNode);
  if (!ew) return { id: '' };
  const soundNode = first(ew.Sound);
  if (!soundNode) return { id: '' };
  return { id: a(soundNode, 'Id', '') };
}

function mapScriptOverride(effectsNode) {
  const ew = first(effectsNode);
  if (!ew) return false;
  return a(ew, 'ScriptOverride', 'false') === 'true';
}

function mapStatuses(effectsNode) {
  const effectsWrapper = first(effectsNode);
  if (!effectsWrapper) return { add: [], remove: [] };
  const node = first(effectsWrapper.Statuses);
  if (!node) return { add: [], remove: [] };

  const add = (node.Add || []).map((s) => ({
    name:      typeof s === 'string' ? s : (s._ ?? ''),
    duration:  a(s, 'Duration',  ''),
    intensity: a(s, 'Intensity', ''),
    tick:      a(s, 'Tick',      ''),
  }));

  const remove = (node.Remove || []).map((s) => ({
    name:       typeof s === 'string' ? s : (s._ ?? ''),
    isCategory: a(s, 'IsCategory', 'false') === 'true',
    quantity:   a(s, 'Quantity',   ''),
  }));

  return { add, remove };
}

function parseSimple(simpleEl) {
  if (simpleEl === undefined || simpleEl === null) return { kind: 'none' };
  if (typeof simpleEl === 'string') return { kind: 'static', value: simpleEl };
  const min = a(simpleEl, 'Min', '0');
  const max = a(simpleEl, 'Max', '0');
  const val = simpleEl._ ?? '0';
  if (min !== '0' || max !== '0') return { kind: 'variable', min, max };
  return { kind: 'static', value: val };
}

function mapHeal(effectsNode) {
  const ew = first(effectsNode);
  if (!ew) return null;
  const healNode = first(ew.Heal);
  if (!healNode) return null;

  const formulaEl = first(healNode.Formula, null);
  if (formulaEl !== null) {
    const f = typeof formulaEl === 'string' ? formulaEl : (formulaEl?._ ?? '');
    if (f) return { kind: 'Formula', value: '', min: '', max: '', formula: f };
  }

  const sq = parseSimple(first(healNode.Simple, null));
  if (sq.kind === 'variable') return { kind: 'Variable', value: '', min: sq.min, max: sq.max, formula: '' };
  if (sq.kind === 'static')   return { kind: 'Static',   value: sq.value, min: '', max: '', formula: '' };
  return null;
}

function mapDamage(effectsNode) {
  const ew = first(effectsNode);
  if (!ew) return null;
  const damageNode = first(ew.Damage);
  if (!damageNode) return null;

  const damageType = a(damageNode, 'Type', 'Physical');

  const flagsEl  = first(damageNode.Flags, null);
  const flagsStr = flagsEl !== null ? (typeof flagsEl === 'string' ? flagsEl : (flagsEl?._ ?? '')) : '';
  const flags    = flagsStr.split(' ').filter(Boolean);

  const formulaEl = first(damageNode.Formula, null);
  if (formulaEl !== null) {
    const f = typeof formulaEl === 'string' ? formulaEl : (formulaEl?._ ?? '');
    if (f) return { kind: 'Formula', type: damageType, flags, value: '', min: '', max: '', formula: f };
  }

  const sq = parseSimple(first(damageNode.Simple, null));
  if (sq.kind === 'variable') return { kind: 'Variable', type: damageType, flags, value: '', min: sq.min, max: sq.max, formula: '' };
  return { kind: 'Static', type: damageType, flags, value: sq.kind === 'static' ? sq.value : '', min: '', max: '', formula: '' };
}

function mapReactors(reactorsNode) {
  const node = first(reactorsNode);
  if (!node) return [];
  return (node.Reactor || []).map((r) => ({
    script:        a(r, 'Script',        ''),
    relativeX:     a(r, 'RelativeX',    '0'),
    relativeY:     a(r, 'RelativeY',    '0'),
    sprite:        a(r, 'Sprite',       '0'),
    expiration:    a(r, 'Expiration',   '0'),
    uses:          a(r, 'Uses',         '1'),
    displayOwner:  a(r, 'DisplayOwner', 'false') === 'true',
    displayGroup:  a(r, 'DisplayGroup', 'false') === 'true',
    displayStatus: a(r, 'DisplayStatus', ''),
    displayCookie: a(r, 'DisplayCookie', ''),
  }));
}

function mapXmlToCastable(result, xmlString) {
  const root = result.Castable;

  return {
    name:             first(root.Name, ''),
    lines:            a(root, 'Lines',            ''),
    cooldown:         a(root, 'Cooldown',         ''),
    icon:             a(root, 'Icon',             ''),
    book:             a(root, 'Book',             'PrimarySkill'),
    elements:         a(root, 'Elements',         'None'),
    class:            a(root, 'Class',            ''),
    reflectable:      a(root, 'Reflectable',      'false') === 'true',
    breakStealth:     a(root, 'BreakStealth',     'false') === 'true',
    includeInMetafile: a(root, 'IncludeInMetafile', 'false') === 'true',
    descriptions:     mapDescriptions(root.Descriptions),
    categories:       mapCategories(root.Categories),
    castCosts:        mapCastCosts(root.CastCosts),
    intents:          mapIntents(root.Intents),
    maxLevel:         mapMaxLevel(root, xmlString),
    mastery:          mapMastery(root, xmlString),
    requirements:     mapRequirements(root.Requirements, xmlString),
    script:           first(root.Script, ''),
    scriptOverride:   mapScriptOverride(root.Effects),
    sound:            mapSound(root.Effects),
    animations:       mapAnimations(root.Effects),
    heal:             mapHeal(root.Effects),
    damage:           mapDamage(root.Effects),
    statuses:         mapStatuses(root.Effects),
    restrictions:     mapRestrictions(root.Restrictions),
    reactors:         mapReactors(root.Reactors),
  };
}

export function parseCastableXml(xmlString) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err);
      try { resolve(mapXmlToCastable(result, xmlString)); }
      catch (e) { reject(e); }
    });
  });
}

// =============================================================================
// SERIALIZER
// =============================================================================

function buildXmlObject(castable) {
  const attrs = {
    xmlns:            XMLNS,
    Lines:            castable.lines            || '0',
    Icon:             castable.icon             || '0',
    Book:             castable.book             || 'PrimarySkill',
    Elements:         castable.elements         || 'None',
    Class:            castable.class            || '',
    Cooldown:         castable.cooldown         || '0',
    Reflectable:      castable.reflectable      ? 'true' : 'false',
    BreakStealth:     castable.breakStealth     ? 'true' : 'false',
    IncludeInMetafile: castable.includeInMetafile ? 'true' : 'false',
  };

  const root = { $: attrs };

  root.Name = [castable.name || ''];

  if (castable.descriptions?.length) {
    root.Descriptions = [{
      Description: castable.descriptions.map((d) => ({
        $: { Class: d.class },
        _: d.text,
      })),
    }];
  }

  if (castable.categories?.length) {
    root.Categories = [{ Category: castable.categories.filter(Boolean) }];
  }

  if (castable.castCosts?.length) {
    const statElems = [];
    const itemElems = [];
    for (const cost of castable.castCosts) {
      if (cost.type === 'Item') {
        itemElems.push({ $: { Quantity: cost.quantity || '1' }, _: cost.itemName || '' });
      } else {
        statElems.push({ $: { [cost.type]: cost.value || '0' } });
      }
    }
    const castCostNode = {};
    if (statElems.length) castCostNode.Stat = statElems;
    if (itemElems.length) castCostNode.Item = itemElems;
    root.CastCosts = [{ CastCost: [castCostNode] }];
  }

  if (castable.intents?.length) {
    root.Intents = [{
      Intent: castable.intents.map((intent) => {
        const node = {
          $: {
            UseType:    intent.useType    || 'NoTarget',
            MaxTargets: intent.maxTargets || '',
            Flags:      (intent.flags || []).join(' '),
          },
        };
        if (intent.map) node.Map = [{}];
        if (intent.crosses?.length)  node.Cross  = intent.crosses.map((c) => ({ $: { Radius: c.radius, VisualEffect: c.visualEffect } }));
        if (intent.cones?.length)    node.Cone   = intent.cones.map((c)   => ({ $: { Radius: c.radius, Direction: c.direction, VisualEffect: c.visualEffect } }));
        if (intent.squares?.length)  node.Square = intent.squares.map((s) => ({ $: { Side: s.side, VisualEffect: s.visualEffect } }));
        if (intent.lines?.length)    node.Line   = intent.lines.map((l)   => ({ $: { Length: l.length, Direction: l.direction, VisualEffect: l.visualEffect } }));
        if (intent.tiles?.length)    node.Tile   = intent.tiles.map((t)   => ({ $: { Direction: t.direction, RelativeX: t.relativeX, RelativeY: t.relativeY, VisualEffect: t.visualEffect } }));
        return node;
      }),
    }];
  }

  if (castable.script) root.Script = [castable.script];

  if (castable.requirements?.length) {
    root.Requirements = [{ Requirement: castable.requirements.map((req) => {
      const reqAttrs = {};
      if (req.class)         reqAttrs.Class         = req.class;
      if (req.forbidCookie)  reqAttrs.ForbidCookie  = req.forbidCookie;
      if (req.requireCookie) reqAttrs.RequireCookie = req.requireCookie;
      const reqNode = { $: reqAttrs };
      if (req.levelMin !== '' || req.levelMax !== '') {
        const la = {};
        if (req.levelMin !== '') la.Min = req.levelMin;
        if (req.levelMax !== '') la.Max = req.levelMax;
        reqNode.Level = [{ $: la }];
      }
      if (req.abMin !== '' || req.abMax !== '') {
        const aa = {};
        if (req.abMin !== '') aa.Min = req.abMin;
        if (req.abMax !== '') aa.Max = req.abMax;
        reqNode.Ab = [{ $: aa }];
      }
      if (req.items?.length) {
        reqNode.Items = [{ Item: req.items.map((it) => ({ $: { Quantity: it.quantity || '1' }, _: it.itemName || '' })) }];
      }
      if (req.gold !== '') reqNode.Gold = [req.gold];
      if (['str','int','wis','con','dex'].some((k) => req[k] !== '')) {
        const pa = {};
        if (req.str !== '') pa.Str = req.str;
        if (req.int !== '') pa.Int = req.int;
        if (req.wis !== '') pa.Wis = req.wis;
        if (req.con !== '') pa.Con = req.con;
        if (req.dex !== '') pa.Dex = req.dex;
        reqNode.Physical = [{ $: pa }];
      }
      const pr = req.prerequisites;
      const hasPrContent = pr && (pr.castables?.length || pr.forbidCookie || pr.requireCookie || pr.forbidMessage || pr.requireMessage);
      if (pr && !pr.deprecated && hasPrContent) {
        const pa = {};
        if (pr.forbidCookie)   pa.ForbidCookie   = pr.forbidCookie;
        if (pr.requireCookie)  pa.RequireCookie  = pr.requireCookie;
        if (pr.forbidMessage)  pa.ForbidMessage  = pr.forbidMessage;
        if (pr.requireMessage) pa.RequireMessage = pr.requireMessage;
        reqNode.Prerequisites = [{ $: pa, Prerequisite: (pr.castables || []).map((c) => ({
          $: c.level !== '' ? { Level: c.level } : {}, _: c.name || '',
        })) }];
      }
      return reqNode;
    }) }];
  }

  if (castable.restrictions?.length) {
    root.Restrictions = [{
      Item: castable.restrictions.map((r) => {
        const attrs = { RestrictionType: r.type, Slot: r.slot || 'None' };
        if (r.weaponType && r.weaponType !== 'None') attrs.WeaponType = r.weaponType;
        if (r.message) attrs.Message = r.message;
        return { $: attrs, _: r.itemName || '' };
      }),
    }];
  }

  if (castable.reactors?.length) {
    root.Reactors = [{
      Reactor: castable.reactors.map((r) => {
        const attrs = {
          Script:     r.script     || '',
          RelativeX:  r.relativeX  || '0',
          RelativeY:  r.relativeY  || '0',
          Sprite:     r.sprite     || '0',
          Expiration: r.expiration || '0',
          Uses:       r.uses       || '1',
        };
        if (r.displayOwner)  attrs.DisplayOwner = 'true';
        if (r.displayGroup)  attrs.DisplayGroup = 'true';
        if (r.displayStatus) attrs.DisplayStatus = r.displayStatus;
        if (r.displayCookie) attrs.DisplayCookie = r.displayCookie;
        return { $: attrs };
      }),
    }];
  }

  {
    const effectsNode = {};

    // Animations
    {
      const CLASSES = ['Peasant', 'Warrior', 'Wizard', 'Priest', 'Rogue', 'Monk'];
      const buildGroup = (group) => {
        if (!group) return null;
        const node = {};
        const motions = CLASSES
          .filter((cls) => group.player?.[cls.toLowerCase()]?.id)
          .map((cls) => {
            const m = group.player[cls.toLowerCase()];
            const attrs = { Class: cls, Id: m.id };
            if (m.speed) attrs.Speed = m.speed;
            return { $: attrs };
          });
        if (motions.length) node.Player = [{ Motion: motions }];
        if (group.target?.id) {
          const attrs = { Id: group.target.id };
          if (group.target.speed) attrs.Speed = group.target.speed;
          node.Target = [{ $: attrs }];
        }
        return Object.keys(node).length ? node : null;
      };
      const animNode = {};
      const onCast = buildGroup(castable.animations?.onCast);
      const onEnd  = buildGroup(castable.animations?.onEnd);
      if (onCast) animNode.OnCast = [onCast];
      if (onEnd)  animNode.OnEnd  = [onEnd];
      if (Object.keys(animNode).length) effectsNode.Animations = [animNode];
    }

    if (castable.sound?.id) {
      effectsNode.Sound = [{ $: { Id: castable.sound.id } }];
    }

    if (castable.heal) {
      const { kind, value, min, max, formula } = castable.heal;
      const healContent = {};
      if (kind === 'Formula') {
        healContent.Formula = [formula || ''];
      } else if (kind === 'Variable') {
        healContent.Simple = [{ $: { Min: min || '0', Max: max || '0' }, _: '0' }];
      } else {
        healContent.Simple = [value || '0'];
      }
      effectsNode.Heal = [healContent];
    }

    if (castable.damage) {
      const { kind, type, flags, value, min, max, formula } = castable.damage;
      const flagsStr = (flags || []).join(' ') || 'None';
      const damageContent = { $: { Type: type || 'Physical' }, Flags: [flagsStr] };
      if (kind === 'Formula') {
        damageContent.Simple  = ['0'];
        if (formula) damageContent.Formula = [formula];
      } else if (kind === 'Variable') {
        damageContent.Simple = [{ $: { Min: min || '0', Max: max || '0' }, _: '0' }];
      } else {
        damageContent.Simple = [value || '0'];
      }
      effectsNode.Damage = [damageContent];
    }

    if (castable.statuses?.add?.length || castable.statuses?.remove?.length) {
      const statusesNode = {};
      if (castable.statuses.add?.length) {
        statusesNode.Add = castable.statuses.add.map((s) => {
          const attrs = {};
          if (s.duration)  attrs.Duration  = s.duration;
          if (s.intensity) attrs.Intensity = s.intensity;
          if (s.tick)      attrs.Tick      = s.tick;
          return { $: attrs, _: s.name || '' };
        });
      }
      if (castable.statuses.remove?.length) {
        statusesNode.Remove = castable.statuses.remove.map((s) => {
          const attrs = {};
          if (s.isCategory) attrs.IsCategory = 'true';
          if (s.quantity)   attrs.Quantity   = s.quantity;
          return { $: attrs, _: s.name || '' };
        });
      }
      effectsNode.Statuses = [statusesNode];
    }

    if (castable.scriptOverride) effectsNode.$ = { ScriptOverride: 'true' };
    if (Object.keys(effectsNode).length) root.Effects = [effectsNode];
  }

  const ml = castable.maxLevel;
  if (ml && (ml.monk || ml.warrior || ml.peasant || ml.wizard || ml.priest || ml.rogue)) {
    const mlAttrs = {};
    if (ml.monk)    mlAttrs.Monk    = ml.monk;
    if (ml.warrior) mlAttrs.Warrior = ml.warrior;
    if (ml.peasant) mlAttrs.Peasant = ml.peasant;
    if (ml.wizard)  mlAttrs.Wizard  = ml.wizard;
    if (ml.priest)  mlAttrs.Priest  = ml.priest;
    if (ml.rogue)   mlAttrs.Rogue   = ml.rogue;
    root.MaxLevel = [{ $: mlAttrs }];
  }

  const ms = castable.mastery;
  if (ms && (ms.uses || ms.modifiers?.length || ms.tiered || ms.deprecated)) {
    const msAttrs = {};
    if (ms.uses)             msAttrs.Uses      = ms.uses;
    if (ms.modifiers?.length) msAttrs.Modifiers = ms.modifiers.join(' ');
    if (ms.tiered)           msAttrs.Tiered    = 'true';
    root.Mastery = [{ $: msAttrs }];
  }

  return { Castable: root };
}

function _escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function _replaceNth(str, search, replacement, n) {
  let count = -1;
  return str.replace(new RegExp(_escapeRegex(search), 'g'), (m) => (++count === n ? replacement : m));
}
function _attrsStr(obj) {
  return Object.entries(obj).filter(([, v]) => v).map(([k, v]) => ` ${k}="${v}"`).join('');
}

export function serializeCastableXml(castable) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' },
  });
  let xml = builder.buildObject(buildXmlObject(castable));
  if (castable.maxLevel?.deprecated) {
    xml = xml.replace(/(\s*)<MaxLevel([^/]*)\/>/,
      (_, indent, attrs) => `${indent}<!--<MaxLevel${attrs}/>-->`);
  }
  if (castable.mastery?.deprecated) {
    xml = xml.replace(/(\s*)<Mastery([^/]*)\/>/,
      (_, indent, attrs) => `${indent}<!--<Mastery${attrs}/>-->`);
  }
  // Inject deprecated Prerequisites as XML comments into their parent Requirement
  if (castable.requirements?.length) {
    castable.requirements.forEach((req, i) => {
      const pr = req.prerequisites;
      const hasPrContent = pr && (pr.castables?.length || pr.forbidCookie || pr.requireCookie || pr.forbidMessage || pr.requireMessage);
      if (!pr?.deprecated || !hasPrContent) return;
      const prAttrs = _attrsStr({ ForbidCookie: pr.forbidCookie, RequireCookie: pr.requireCookie, ForbidMessage: pr.forbidMessage, RequireMessage: pr.requireMessage });
      const prereqLines = (pr.castables || []).map((c) => {
        const lvl = c.level !== '' ? ` Level="${c.level}"` : '';
        return `          <Prerequisite${lvl}>${c.name}</Prerequisite>`;
      });
      const inner = prereqLines.length
        ? `\n          <Prerequisites${prAttrs}>\n${prereqLines.join('\n')}\n          </Prerequisites>`
        : `\n          <Prerequisites${prAttrs}/>`;
      const comment = `\n        <!--${inner}\n        -->`;
      xml = _replaceNth(xml, '    </Requirement>', comment + '\n    </Requirement>', i);
    });
  }
  return xml + '\n';
}
