import xml2js from 'xml2js';
import { extractComment, injectComment } from './xmlCommentUtils.js';

// ── Status-specific meta (creidhne:meta comment) ──────────────────────────────
// Stores string keys for prohibited message and per-block message channels.
// Format: { pm?: string, msgs?: { onApply?: {...}, onTick?: {...}, ... } }

function extractStatusMeta(xmlString) {
  const m = /<!--\s*creidhne:meta\s+({.*?})\s*-->/.exec(xmlString);
  if (!m) return {};
  try { return JSON.parse(m[1]); }
  catch { return {}; }
}

function injectStatusMeta(xml, status) {
  const payload = {};
  if (status.prohibitedMessageKey) payload.pm = status.prohibitedMessageKey;

  const msgBlocks = {};
  for (const block of ['onApply', 'onTick', 'onRemove', 'onExpire']) {
    const msgs = status[block]?.messages;
    if (!Array.isArray(msgs)) continue;
    const keys = {};
    for (const entry of msgs) {
      if (entry.key) keys[entry.type] = entry.key;
    }
    if (Object.keys(keys).length) msgBlocks[block] = keys;
  }
  if (Object.keys(msgBlocks).length) payload.msgs = msgBlocks;

  const fnBlocks = {};
  for (const block of ['onApply', 'onTick', 'onRemove', 'onExpire']) {
    const healName   = status[block]?.heal?.formulaName;
    const damageName = status[block]?.damage?.formulaName;
    if (healName || damageName) {
      fnBlocks[block] = {};
      if (healName)   fnBlocks[block].heal   = healName;
      if (damageName) fnBlocks[block].damage = damageName;
    }
  }
  if (Object.keys(fnBlocks).length) payload.formulaNames = fnBlocks;

  if (!Object.keys(payload).length) return xml;
  return xml.replace(/(<Status[^>]*>)/, `$1\n  <!-- creidhne:meta ${JSON.stringify(payload)} -->`);
}

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02';

const first = (arr, def = undefined) => Array.isArray(arr) && arr.length ? arr[0] : def;
const a = (node, key, def = '') => node?.$?.[key] ?? def;

export function makeDefaultEffectBlock() {
  return {
    animations: null,
    messages: null,
    heal: null,
    damage: null,
    statModifiers: null,
    conditions: null,
    handler: null,
  };
}

// =============================================================================
// PARSER
// =============================================================================

function mapMessages(msgsNode, msgKeys) {
  if (!msgsNode) return null;
  const m = first(msgsNode);
  if (!m) return [];
  const k = msgKeys || {};
  const arr = [];
  if (m.Target) arr.push({ type: 'target', text: first(m.Target, ''), key: k.target || '' });
  if (m.Source) arr.push({ type: 'source', text: first(m.Source, ''), key: k.source || '' });
  if (m.Group)  arr.push({ type: 'group',  text: first(m.Group,  ''), key: k.group  || '' });
  if (m.Say)    arr.push({ type: 'say',    text: first(m.Say,    ''), key: k.say    || '' });
  if (m.Shout)  arr.push({ type: 'shout',  text: first(m.Shout,  ''), key: k.shout  || '' });
  return arr;
}

function parseSimpleNode(simpleEl) {
  if (simpleEl === undefined || simpleEl === null) return { kind: 'none' };
  if (typeof simpleEl === 'string') return { kind: 'static', value: simpleEl };
  const min = a(simpleEl, 'Min', '0');
  const max = a(simpleEl, 'Max', '0');
  const val = simpleEl._ || '0';
  if (min !== '0' || max !== '0') return { kind: 'variable', min, max };
  return { kind: 'static', value: val };
}

function mapHeal(healNode) {
  if (!healNode) return null;
  const h = first(healNode);
  if (!h) return null;
  const formulaEl = first(h.Formula, null);
  if (formulaEl) {
    const f = typeof formulaEl === 'string' ? formulaEl : (formulaEl._ || '');
    if (f) return { kind: 'Formula', value: '', min: '', max: '', formula: f };
  }
  const sq = parseSimpleNode(first(h.Simple, null));
  if (sq.kind === 'variable') return { kind: 'Variable', value: '', min: sq.min, max: sq.max, formula: '' };
  if (sq.kind === 'static' && sq.value) return { kind: 'Static', value: sq.value, min: '', max: '', formula: '' };
  return null;
}

function mapDamage(damNode) {
  if (!damNode) return null;
  const d = first(damNode);
  if (!d) return null;
  const flagsRaw = first(d.Flags, '');
  const flags    = flagsRaw ? flagsRaw.split(' ').filter(Boolean) : [];
  const element  = a(d, 'Element', 'None');
  const type     = a(d, 'Type', 'Direct');
  const formulaEl = first(d.Formula, null);
  if (formulaEl) {
    const f = typeof formulaEl === 'string' ? formulaEl : (formulaEl._ || '');
    if (f) return { element, type, flags, kind: 'Formula', value: '', min: '', max: '', formula: f };
  }
  const sq = parseSimpleNode(first(d.Simple, null));
  if (sq.kind === 'variable') return { element, type, flags, kind: 'Variable', value: '', min: sq.min, max: sq.max, formula: '' };
  if (sq.kind === 'static' && sq.value) return { element, type, flags, kind: 'Static', value: sq.value, min: '', max: '', formula: '' };
  return null;
}

function mapStatModifiers(statNode) {
  if (!statNode) return null;
  const s = first(statNode);
  if (!s) return null;
  // Convert all present XML attributes to rows (same format as StatsTab)
  const attrs = s.$ || {};
  const rows = Object.entries(attrs)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => ({ key: k, value: v }));
  const elemsNode = first(s.ElementalModifiers);
  const elementalModifiers = elemsNode
    ? (elemsNode.ElementalModifier || []).map((em) => ({
        type:     a(em, 'Type', 'Augment'),
        element:  a(em, 'Element', ''),
        modifier: a(em, 'Modifier', '1'),
      }))
    : [];
  return { rows, elementalModifiers };
}

function mapConditions(condNode) {
  if (!condNode) return null;
  const c = first(condNode);
  if (!c) return null;
  return {
    set:   (c.Set   || []).filter(Boolean),
    unset: (c.Unset || []).filter(Boolean),
  };
}

function mapHandler(handlerNode) {
  if (!handlerNode) return null;
  const h = first(handlerNode);
  if (!h) return null;
  return {
    function:     first(h.Function,     ''),
    scriptSource: first(h.ScriptSource, ''),
  };
}

function mapEffectBlock(blockNode, msgKeys, formulaNames) {
  const b = first(blockNode);
  if (!b) return makeDefaultEffectBlock();

  const animsNode = first(b.Animations);
  let animations = null;
  if (animsNode) {
    const target      = first(animsNode.Target);
    const spellEffect = first(animsNode.SpellEffect);
    animations = {
      targetId:        target      ? a(target,      'Id',    '') : '',
      targetSpeed:     target      ? a(target,      'Speed', '') : '',
      spellEffectId:   spellEffect ? a(spellEffect, 'Id',    '') : '',
      spellEffectSpeed: spellEffect ? a(spellEffect, 'Speed', '') : '',
      soundId: '',
    };
  }

  const soundNode = first(b.Sound);
  if (soundNode) {
    const sid = a(soundNode, 'Id', '');
    if (sid) {
      if (!animations) {
        animations = { targetId: '', targetSpeed: '', spellEffectId: '', spellEffectSpeed: '', soundId: sid };
      } else {
        animations.soundId = sid;
      }
    }
  }

  const fn  = formulaNames || {};
  const heal   = mapHeal(b.Heal);
  const damage = mapDamage(b.Damage);
  return {
    animations,
    messages:      mapMessages(b.Messages, msgKeys),
    heal:          heal   && fn.heal   ? { ...heal,   formulaName: fn.heal }   : heal,
    damage:        damage && fn.damage ? { ...damage, formulaName: fn.damage } : damage,
    statModifiers: mapStatModifiers(b.StatModifiers),
    conditions:    mapConditions(b.Conditions),
    handler:       mapHandler(b.Handler),
  };
}

function mapXmlToStatus(result, comment, meta) {
  const root    = result.Status;
  const effects = first(root.Effects);
  const msgs    = meta.msgs || {};
  return {
    name:             a(root, 'Name',          ''),
    comment,
    icon:             a(root, 'Icon',          ''),
    duration:         a(root, 'Duration',      ''),
    tick:             a(root, 'Tick',          ''),
    removeChance:     a(root, 'RemoveChance',  ''),
    removeOnDeath:    a(root, 'RemoveOnDeath', 'false') === 'true',
    prohibitedMessage:    first(root.ProhibitedMessage, ''),
    prohibitedMessageKey: meta.pm || '',
    categories: ((first(root.Categories) || {}).Category || []).filter(Boolean),
    castRestrictions: ((first(root.CastRestrictions) || {}).CastRestriction || []).flatMap((cr) => {
      const result = [];
      const use     = a(cr, 'Use',     '');
      const receive = a(cr, 'Receive', '');
      if (use)     result.push({ type: 'use-castable',     value: use });
      if (receive) result.push({ type: 'receive-castable', value: receive });
      return result;
    }),
    onApply:  mapEffectBlock(effects?.OnApply,  msgs.onApply,  (meta.formulaNames || {}).onApply),
    onTick:   mapEffectBlock(effects?.OnTick,   msgs.onTick,   (meta.formulaNames || {}).onTick),
    onRemove: mapEffectBlock(effects?.OnRemove, msgs.onRemove, (meta.formulaNames || {}).onRemove),
    onExpire: mapEffectBlock(effects?.OnExpire, msgs.onExpire, (meta.formulaNames || {}).onExpire),
  };
}

export function parseStatusXml(xmlString) {
  return new Promise((resolve, reject) => {
    const comment = extractComment(xmlString);
    const meta    = extractStatusMeta(xmlString);
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err);
      try { resolve(mapXmlToStatus(result, comment, meta)); }
      catch (e) { reject(e); }
    });
  });
}

// =============================================================================
// SERIALIZER
// =============================================================================

function buildMessages(msgs) {
  if (!msgs) return undefined;
  const typeMap = { target: 'Target', source: 'Source', group: 'Group', say: 'Say', shout: 'Shout' };
  const node = {};
  for (const entry of msgs) {
    if (entry.text) node[typeMap[entry.type]] = [entry.text];
  }
  return Object.keys(node).length ? [node] : undefined;
}

function buildHeal(heal) {
  if (!heal) return undefined;
  const node = {};
  if (heal.kind === 'Formula'  && heal.formula) node.Formula = [heal.formula];
  else if (heal.kind === 'Variable')            node.Simple  = [{ $: { Min: heal.min || '0', Max: heal.max || '0' } }];
  else if (heal.kind === 'Static' && heal.value) node.Simple = [heal.value];
  return Object.keys(node).length ? [node] : undefined;
}

function buildDamage(damage) {
  if (!damage) return undefined;
  const node  = {};
  const attrs = {};
  if (damage.element && damage.element !== 'None') attrs.Element = damage.element;
  if (damage.type)                                 attrs.Type    = damage.type;
  if (Object.keys(attrs).length) node.$ = attrs;
  if (damage.flags?.length) node.Flags = [damage.flags.join(' ')];
  if (damage.kind === 'Formula' && damage.formula) node.Formula = [damage.formula];
  else if (damage.kind === 'Variable')            node.Simple  = [{ $: { Min: damage.min || '0', Max: damage.max || '0' } }];
  else if (damage.kind === 'Static' && damage.value) node.Simple = [damage.value];
  return (node.$ || node.Flags || node.Simple || node.Formula) ? [node] : undefined;
}

function buildStatModifiers(sm) {
  if (!sm) return undefined;
  // rows format: [{ key: 'BaseStr', value: '1' }, ...]
  const attrs = {};
  for (const row of (sm.rows || [])) {
    if (row.value !== '' && row.value != null) attrs[row.key] = row.value;
  }
  const node = {};
  if (Object.keys(attrs).length) node.$ = attrs;
  if (sm.elementalModifiers?.length) {
    node.ElementalModifiers = [{
      ElementalModifier: sm.elementalModifiers.map((em) => ({
        $: { Type: em.type, Element: em.element, Modifier: em.modifier },
      })),
    }];
  }
  return (node.$ || node.ElementalModifiers) ? [node] : undefined;
}

function buildConditions(conds) {
  if (!conds) return undefined;
  const node = {};
  if (conds.set?.length)   node.Set   = conds.set;
  if (conds.unset?.length) node.Unset = conds.unset;
  return (node.Set || node.Unset) ? [node] : undefined;
}

function buildHandler(handler) {
  if (!handler) return undefined;
  const node = {};
  if (handler.function)     node.Function     = [handler.function];
  if (handler.scriptSource) node.ScriptSource = [handler.scriptSource];
  return Object.keys(node).length ? [node] : undefined;
}

function buildEffectBlock(block) {
  if (!block) return undefined;
  const node = {};

  if (block.animations) {
    const anim     = block.animations;
    const animNode = {};
    if (anim.targetId || anim.targetSpeed) {
      animNode.Target = [{ $: { Id: anim.targetId, Speed: anim.targetSpeed } }];
    }
    if (anim.spellEffectId || anim.spellEffectSpeed) {
      animNode.SpellEffect = [{ $: { Id: anim.spellEffectId, Speed: anim.spellEffectSpeed } }];
    }
    if (Object.keys(animNode).length) node.Animations = [animNode];
    if (anim.soundId) node.Sound = [{ $: { Id: anim.soundId } }];
  }

  const msgs = buildMessages(block.messages);  if (msgs)  node.Messages      = msgs;
  const heal = buildHeal(block.heal);           if (heal)  node.Heal          = heal;
  const dam  = buildDamage(block.damage);       if (dam)   node.Damage        = dam;
  const sm   = buildStatModifiers(block.statModifiers); if (sm) node.StatModifiers = sm;
  const cond = buildConditions(block.conditions);       if (cond) node.Conditions  = cond;
  const hdlr = buildHandler(block.handler);             if (hdlr) node.Handler     = hdlr;

  return Object.keys(node).length ? [node] : undefined;
}

function buildXmlObject(status) {
  const attrs = { xmlns: XMLNS, Name: status.name };
  if (status.icon)           attrs.Icon          = status.icon;
  if (status.duration)       attrs.Duration      = status.duration;
  if (status.tick)           attrs.Tick          = status.tick;
  if (status.removeChance)   attrs.RemoveChance  = status.removeChance;
  if (status.removeOnDeath)  attrs.RemoveOnDeath = 'true';

  const root = { $: attrs };

  if (status.categories?.length) {
    root.Categories = [{ Category: status.categories }];
  }
  if (status.castRestrictions?.length) {
    root.CastRestrictions = [{
      CastRestriction: status.castRestrictions.map((cr) => ({
        $: cr.type.startsWith('use') ? { Use: cr.value } : { Receive: cr.value },
      })),
    }];
  }
  if (status.prohibitedMessage) {
    root.ProhibitedMessage = [status.prohibitedMessage];
  }

  const effects = {};
  const onApply  = buildEffectBlock(status.onApply);  if (onApply)  effects.OnApply  = onApply;
  const onTick   = buildEffectBlock(status.onTick);   if (onTick)   effects.OnTick   = onTick;
  const onRemove = buildEffectBlock(status.onRemove); if (onRemove) effects.OnRemove = onRemove;
  const onExpire = buildEffectBlock(status.onExpire); if (onExpire) effects.OnExpire = onExpire;
  if (Object.keys(effects).length) root.Effects = [effects];

  return { Status: root };
}

export function serializeStatusXml(status) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' },
  });
  let xml = builder.buildObject(buildXmlObject(status));
  xml = injectComment(xml, status.comment, 'Status');
  xml = injectStatusMeta(xml, status);
  return xml + '\n';
}
