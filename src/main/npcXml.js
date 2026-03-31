import xml2js from 'xml2js';
import { extractComment, injectComment, extractMeta, injectMeta } from './xmlCommentUtils.js';

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02';

const first = (arr, def = undefined) => Array.isArray(arr) && arr.length ? arr[0] : def;
const a = (node, key, def = '') => node?.$?.[key] ?? def;
const toBool = (val, def = false) =>
  val === 'true' ? true : val === 'false' ? false : val === undefined ? def : Boolean(val);
const omitEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined));

const NPC_META_DEFAULTS = { job: '', location: '' };

function extractNpcMeta(xmlString) {
  const raw = extractMeta(xmlString);
  return { job: raw.job || '', location: raw.location || '' };
}

function injectNpcMeta(xml, meta) {
  if (!meta || (!meta.job && !meta.location)) return xml;
  const payload = {};
  if (meta.job) payload.job = meta.job;
  if (meta.location) payload.location = meta.location;
  return xml.replace(/(<Npc[^>]*>)/, `$1\n  <!-- creidhne:meta ${JSON.stringify(payload)} -->`);
}

// =============================================================================
// PARSER
// =============================================================================

export function parseNpcXml(xmlString) {
  return new Promise((resolve, reject) => {
    const comment = extractComment(xmlString);
    const meta = extractNpcMeta(xmlString);
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err);
      try { resolve(mapXmlToNpc(result, comment, meta)); }
      catch (e) { reject(e); }
    });
  });
}

function mapXmlToNpc(result, comment, meta) {
  const root = result.Npc;
  const appearance = first(root.Appearance);
  const roles = first(root.Roles);
  const vend = roles ? first(roles.Vend) : null;
  const train = roles ? first(roles.Train) : null;
  const post = roles ? first(roles.Post) : null;

  return {
    name: first(root.Name, ''),
    displayName: first(root.DisplayName, ''),
    comment,
    meta: meta || { ...NPC_META_DEFAULTS },
    sprite: a(appearance, 'Sprite', ''),
    portrait: a(appearance, 'Portrait', ''),
    allowDead: toBool(first(root.AllowDead, 'false')),
    responses: (root.Responses?.[0]?.Response || []).map((r) => ({
      call: a(r, 'Call', ''),
      response: typeof r === 'string' ? r : (r._ || ''),
    })),
    strings: (root.Strings?.[0]?.String || []).map((s) => ({
      key: a(s, 'Key', ''),
      message: typeof s === 'string' ? s : (s._ || ''),
    })),
    roles: {
      bank: roles?.Bank?.[0] ? {
        exceptCookie: a(roles.Bank[0], 'ExceptCookie', ''),
        onlyCookie: a(roles.Bank[0], 'OnlyCookie', ''),
        adjustments: (roles.Bank[0].CostAdjustment || []).map((adj) => ({
          nation: a(adj, 'Nation', ''),
          value: typeof adj === 'string' ? adj : (adj._ || ''),
        })),
      } : null,
      post: post ? {
        nation: a(post, 'Nation', ''),
        exceptCookie: a(post, 'ExceptCookie', ''),
        onlyCookie: a(post, 'OnlyCookie', ''),
        adjustments: (post.CostAdjustment || []).map((adj) => ({
          nation: a(adj, 'Nation', ''),
          value: typeof adj === 'string' ? adj : (adj._ || ''),
        })),
      } : null,
      repair: roles?.Repair?.[0] ? {
        type: a(roles.Repair[0], 'Type', ''),
        exceptCookie: a(roles.Repair[0], 'ExceptCookie', ''),
        onlyCookie: a(roles.Repair[0], 'OnlyCookie', ''),
        adjustments: (roles.Repair[0].CostAdjustment || []).map((adj) => ({
          nation: a(adj, 'Nation', ''),
          value: typeof adj === 'string' ? adj : (adj._ || ''),
        })),
      } : null,
      vend: vend ? {
        exceptCookie: a(vend, 'ExceptCookie', ''),
        onlyCookie: a(vend, 'OnlyCookie', ''),
        items: (vend.Items?.[0]?.Item || []).map((item) => ({
          name: a(item, 'Name', ''),
          quantity: a(item, 'Quantity', '1'),
          restock: a(item, 'Restock', ''),
        })),
        adjustments: (vend.CostAdjustment || []).map((adj) => ({
          nation: a(adj, 'Nation', ''),
          value: typeof adj === 'string' ? adj : (adj._ || ''),
        })),
      } : null,
      train: train ? {
        exceptCookie: a(train, 'ExceptCookie', ''),
        onlyCookie: a(train, 'OnlyCookie', ''),
        castables: (train.Castable || []).map((c) => ({
          name: a(c, 'Name', ''),
          type: a(c, 'Type', ''),
          class: a(c, 'Class', ''),
        })),
        adjustments: (train.CostAdjustment || []).map((adj) => ({
          nation: a(adj, 'Nation', ''),
          value: typeof adj === 'string' ? adj : (adj._ || ''),
        })),
      } : null,
    },
  };
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeNpcXml(npc) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' },
  });
  let xml = injectComment(builder.buildObject(buildXmlObject(npc)), npc.comment, 'Npc');
  xml = injectNpcMeta(xml, npc.meta);
  return xml + '\n';
}

function buildXmlObject(npc) {
  const root = { $: { xmlns: XMLNS } };

  root.Name = [npc.name];
  root.DisplayName = [npc.displayName || npc.name];
  root.Appearance = [{ $: omitEmpty({ Sprite: npc.sprite, Portrait: npc.portrait }) }];
  if (npc.allowDead) root.AllowDead = ['true'];

  if (npc.responses?.length) {
    root.Responses = [{
      Response: npc.responses.map((r) => ({ $: { Call: r.call }, _: r.response })),
    }];
  }

  if (npc.strings?.length) {
    root.Strings = [{
      String: npc.strings.map((s) => ({ $: { Key: s.key }, _: s.message })),
    }];
  }

  const { bank, post, repair, vend, train } = npc.roles;
  const hasAnyRole = bank !== null || post !== null || repair !== null || vend !== null || train !== null;

  if (hasAnyRole) {
    const rolesNode = {};

    const serializeAdjustments = (adjustments) =>
      adjustments.map((adj) => ({
        $: omitEmpty({ Nation: adj.nation }),
        _: adj.value,
      }));

    if (bank !== null) {
      const bankEl = { $: omitEmpty({ ExceptCookie: bank.exceptCookie, OnlyCookie: bank.onlyCookie }) };
      if (bank.adjustments?.length) bankEl.CostAdjustment = serializeAdjustments(bank.adjustments);
      rolesNode.Bank = [bankEl];
    }

    if (post !== null) {
      const postEl = { $: omitEmpty({ Nation: post.nation, ExceptCookie: post.exceptCookie, OnlyCookie: post.onlyCookie }) };
      if (post.adjustments?.length) postEl.CostAdjustment = serializeAdjustments(post.adjustments);
      rolesNode.Post = [postEl];
    }

    if (repair !== null) {
      const repairEl = { $: omitEmpty({ Type: repair.type, ExceptCookie: repair.exceptCookie, OnlyCookie: repair.onlyCookie }) };
      if (repair.adjustments?.length) repairEl.CostAdjustment = serializeAdjustments(repair.adjustments);
      rolesNode.Repair = [repairEl];
    }

    if (vend !== null) {
      const vendEl = { $: omitEmpty({ ExceptCookie: vend.exceptCookie, OnlyCookie: vend.onlyCookie }) };
      if (vend.items?.length) {
        vendEl.Items = [{
          Item: vend.items.map((item) => ({
            $: omitEmpty({ Name: item.name, Quantity: item.quantity, Restock: item.restock }),
          })),
        }];
      }
      if (vend.adjustments?.length) vendEl.CostAdjustment = serializeAdjustments(vend.adjustments);
      rolesNode.Vend = [vendEl];
    }

    if (train !== null) {
      const trainEl = { $: omitEmpty({ ExceptCookie: train.exceptCookie, OnlyCookie: train.onlyCookie }) };
      if (train.castables?.length) {
        trainEl.Castable = train.castables.map((c) => ({
          $: omitEmpty({ Name: c.name, Type: c.type, Class: c.class }),
        }));
      }
      if (train.adjustments?.length) trainEl.CostAdjustment = serializeAdjustments(train.adjustments);
      rolesNode.Train = [trainEl];
    }

    root.Roles = [rolesNode];
  }

  return { Npc: root };
}
