import xml2js from 'xml2js';
import { extractComment, injectComment } from './xmlCommentUtils.js';

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

function mapMessages(msgsNode) {
  if (!msgsNode) return null;
  const m = first(msgsNode);
  if (!m) return null;
  return {
    target: { enabled: !!m.Target, text: first(m.Target, '') },
    source: { enabled: !!m.Source, text: first(m.Source, '') },
    group:  { enabled: !!m.Group,  text: first(m.Group,  '') },
    say:    { enabled: !!m.Say,    text: first(m.Say,    '') },
    shout:  { enabled: !!m.Shout,  text: first(m.Shout,  '') },
  };
}

function mapHeal(healNode) {
  if (!healNode) return null;
  const h = first(healNode);
  if (!h) return null;
  const formula = first(h.Formula, '');
  const simple  = first(h.Simple, '');
  return { mode: formula ? 'formula' : 'simple', simple, formula };
}

function mapDamage(damNode) {
  if (!damNode) return null;
  const d = first(damNode);
  if (!d) return null;
  const formula  = first(d.Formula, '');
  const simple   = first(d.Simple, '');
  const flagsRaw = first(d.Flags, '');
  return {
    element: a(d, 'Element', 'None'),
    type:    a(d, 'Type', ''),
    flags:   flagsRaw ? flagsRaw.split(' ').filter(Boolean) : [],
    mode:    formula ? 'formula' : 'simple',
    simple,
    formula,
  };
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

function mapEffectBlock(blockNode) {
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

  return {
    animations,
    messages:      mapMessages(b.Messages),
    heal:          mapHeal(b.Heal),
    damage:        mapDamage(b.Damage),
    statModifiers: mapStatModifiers(b.StatModifiers),
    conditions:    mapConditions(b.Conditions),
    handler:       mapHandler(b.Handler),
  };
}

function mapXmlToStatus(result, comment) {
  const root    = result.Status;
  const effects = first(root.Effects);
  return {
    name:             a(root, 'Name',          ''),
    comment,
    icon:             a(root, 'Icon',          ''),
    duration:         a(root, 'Duration',      ''),
    tick:             a(root, 'Tick',          ''),
    removeChance:     a(root, 'RemoveChance',  ''),
    removeOnDeath:    a(root, 'RemoveOnDeath', 'false') === 'true',
    prohibitedMessage: first(root.ProhibitedMessage, ''),
    categories: ((first(root.Categories) || {}).Category || []).filter(Boolean),
    castRestrictions: ((first(root.CastRestrictions) || {}).CastRestriction || []).flatMap((cr) => {
      const result = [];
      const use     = a(cr, 'Use',     '');
      const receive = a(cr, 'Receive', '');
      if (use)     result.push({ type: 'use-castable',     value: use });
      if (receive) result.push({ type: 'receive-castable', value: receive });
      return result;
    }),
    onApply:  mapEffectBlock(effects?.OnApply),
    onTick:   mapEffectBlock(effects?.OnTick),
    onRemove: mapEffectBlock(effects?.OnRemove),
    onExpire: mapEffectBlock(effects?.OnExpire),
  };
}

export function parseStatusXml(xmlString) {
  return new Promise((resolve, reject) => {
    const comment = extractComment(xmlString);
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err);
      try { resolve(mapXmlToStatus(result, comment)); }
      catch (e) { reject(e); }
    });
  });
}

// =============================================================================
// SERIALIZER
// =============================================================================

function buildMessages(msgs) {
  if (!msgs) return undefined;
  const node = {};
  if (msgs.target?.enabled && msgs.target.text) node.Target = [msgs.target.text];
  if (msgs.source?.enabled && msgs.source.text) node.Source = [msgs.source.text];
  if (msgs.group?.enabled  && msgs.group.text)  node.Group  = [msgs.group.text];
  if (msgs.say?.enabled    && msgs.say.text)    node.Say    = [msgs.say.text];
  if (msgs.shout?.enabled  && msgs.shout.text)  node.Shout  = [msgs.shout.text];
  return Object.keys(node).length ? [node] : undefined;
}

function buildHeal(heal) {
  if (!heal) return undefined;
  const node = {};
  if (heal.mode === 'simple'  && heal.simple)  node.Simple  = [heal.simple];
  if (heal.mode === 'formula' && heal.formula) node.Formula = [heal.formula];
  return Object.keys(node).length ? [node] : undefined;
}

function buildDamage(damage) {
  if (!damage) return undefined;
  const node  = {};
  const attrs = {};
  if (damage.element && damage.element !== 'None') attrs.Element = damage.element;
  if (damage.type)                                 attrs.Type    = damage.type;
  if (Object.keys(attrs).length) node.$ = attrs;
  if (damage.flags?.length)                     node.Flags   = [damage.flags.join(' ')];
  if (damage.mode === 'simple'  && damage.simple)  node.Simple  = [damage.simple];
  if (damage.mode === 'formula' && damage.formula) node.Formula = [damage.formula];
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
  const xml = injectComment(builder.buildObject(buildXmlObject(status)), status.comment, 'Status');
  return xml + '\n';
}
