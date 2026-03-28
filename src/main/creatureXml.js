import xml2js from 'xml2js';
import { extractComment, injectComment } from './xmlCommentUtils.js';

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02';

const first = (arr, def = undefined) => Array.isArray(arr) && arr.length ? arr[0] : def;
const a = (node, key, def = '') => node?.$?.[key] ?? def;
const omitEmpty = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined));

// =============================================================================
// PARSER
// =============================================================================

export function parseCreatureXml(xmlString) {
  return new Promise((resolve, reject) => {
    const comment = extractComment(xmlString);

    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err);
      try { resolve(mapXmlToCreature(result, comment)); }
      catch (e) { reject(e); }
    });
  });
}

function mapLoot(lootNode) {
  if (!lootNode) return [];
  return (lootNode.Set || []).map((s) => ({
    name: a(s, 'Name', ''),
    rolls: a(s, 'Rolls', ''),
    chance: a(s, 'Chance', ''),
  }));
}

function mapHostility(hosNode) {
  if (!hosNode) {
    return {
      players: false, playerExceptCookie: '', playerOnlyCookie: '',
      monsters: false, monsterExceptCookie: '', monsterOnlyCookie: '',
    };
  }
  const players = first(hosNode.Players);
  const monsters = first(hosNode.Monsters);
  return {
    players: !!players,
    playerExceptCookie: players ? a(players, 'ExceptCookie', '') : '',
    playerOnlyCookie: players ? a(players, 'OnlyCookie', '') : '',
    monsters: !!monsters,
    monsterExceptCookie: monsters ? a(monsters, 'ExceptCookie', '') : '',
    monsterOnlyCookie: monsters ? a(monsters, 'OnlyCookie', '') : '',
  };
}

function mapCookies(cookiesNode) {
  if (!cookiesNode) return [];
  return (cookiesNode.Cookie || []).map((c) => ({
    name: a(c, 'Name', ''),
    value: a(c, 'Value', ''),
  }));
}

function mapSubtype(typeNode) {
  return {
    name: a(typeNode, 'Name', ''),
    sprite: a(typeNode, 'Sprite', ''),
    behaviorSet: a(typeNode, 'BehaviorSet', ''),
    minDmg: a(typeNode, 'MinDmg', ''),
    maxDmg: a(typeNode, 'MaxDmg', ''),
    assailSound: a(typeNode, 'AssailSound', ''),
    description: first(typeNode.Description, ''),
    loot: mapLoot(first(typeNode.Loot)),
    hostility: mapHostility(first(typeNode.Hostility)),
    cookies: mapCookies(first(typeNode.SetCookies)),
  };
}

function mapXmlToCreature(result, comment) {
  const root = result.Creature;
  return {
    name: a(root, 'Name', ''),
    sprite: a(root, 'Sprite', ''),
    behaviorSet: a(root, 'BehaviorSet', ''),
    minDmg: a(root, 'MinDmg', ''),
    maxDmg: a(root, 'MaxDmg', ''),
    assailSound: a(root, 'AssailSound', ''),
    comment,
    description: first(root.Description, ''),
    loot: mapLoot(first(root.Loot)),
    hostility: mapHostility(first(root.Hostility)),
    cookies: mapCookies(first(root.SetCookies)),
    subtypes: (root.Types?.[0]?.Type || []).map(mapSubtype),
  };
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeCreatureXml(creature) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' },
  });

  let xml = builder.buildObject(buildXmlObject(creature));

  xml = injectComment(xml, creature.comment, 'Creature');

  return xml + '\n';
}

function buildLoot(lootArr) {
  if (!lootArr?.length) return undefined;
  return [{
    Set: lootArr.map((s) => ({ $: omitEmpty({ Name: s.name, Rolls: s.rolls, Chance: s.chance }) })),
  }];
}

function buildHostility(hos) {
  const hasMonsters = hos?.monsters;
  const hasPlayers = hos?.players;
  if (!hasMonsters && !hasPlayers) return undefined;

  const node = {};
  if (hasMonsters) {
    node.Monsters = [{ $: omitEmpty({ ExceptCookie: hos.monsterExceptCookie, OnlyCookie: hos.monsterOnlyCookie }) }];
  }
  if (hasPlayers) {
    node.Players = [{ $: omitEmpty({ ExceptCookie: hos.playerExceptCookie, OnlyCookie: hos.playerOnlyCookie }) }];
  }
  return [node];
}

function buildCookies(cookies) {
  if (!cookies?.length) return undefined;
  return [{ Cookie: cookies.map((c) => ({ $: omitEmpty({ Name: c.name, Value: c.value }) })) }];
}

function buildSubtype(sub) {
  const node = {
    $: Object.assign(
      { Name: sub.name },
      omitEmpty({ Sprite: sub.sprite, BehaviorSet: sub.behaviorSet, MinDmg: sub.minDmg, MaxDmg: sub.maxDmg, AssailSound: sub.assailSound }),
    ),
  };
  if (sub.description) node.Description = [sub.description];
  const loot = buildLoot(sub.loot);
  if (loot) node.Loot = loot;
  const hos = buildHostility(sub.hostility);
  if (hos) node.Hostility = hos;
  const cookies = buildCookies(sub.cookies);
  if (cookies) node.SetCookies = cookies;
  return node;
}

function buildXmlObject(creature) {
  const root = {
    $: Object.assign(
      { xmlns: XMLNS, Name: creature.name },
      omitEmpty({ Sprite: creature.sprite, BehaviorSet: creature.behaviorSet, MinDmg: creature.minDmg, MaxDmg: creature.maxDmg, AssailSound: creature.assailSound }),
    ),
  };

  if (creature.description) root.Description = [creature.description];

  const loot = buildLoot(creature.loot);
  if (loot) root.Loot = loot;

  const hos = buildHostility(creature.hostility);
  if (hos) root.Hostility = hos;

  const cookies = buildCookies(creature.cookies);
  if (cookies) root.SetCookies = cookies;

  if (creature.subtypes?.length) {
    root.Types = [{ Type: creature.subtypes.map(buildSubtype) }];
  }

  return { Creature: root };
}
