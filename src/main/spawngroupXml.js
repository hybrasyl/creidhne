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

export function parseSpawngroupXml(xmlString) {
  return new Promise((resolve, reject) => {
    const comment = extractComment(xmlString);
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err);
      try { resolve(mapXmlToSpawngroup(result, comment)); }
      catch (e) { reject(e); }
    });
  });
}

function mapImmunities(immsArr) {
  const node = first(immsArr);
  if (!node) return [];
  return (node.Immunity || []).map((imm) => ({
    type: a(imm, 'Type', 'Element'),
    value: typeof imm === 'string' ? imm : (imm._ || ''),
    messageType: a(imm, 'MessageType', 'Say'),
    message: a(imm, 'Message', ''),
  }));
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
  const hasPlayers = Array.isArray(hosNode.Players) && hosNode.Players.length > 0;
  const hasMonsters = Array.isArray(hosNode.Monsters) && hosNode.Monsters.length > 0;
  const players = hasPlayers ? hosNode.Players[0] : null;
  const monsters = hasMonsters ? hosNode.Monsters[0] : null;
  return {
    players: hasPlayers,
    playerExceptCookie: players ? a(players, 'ExceptCookie', '') : '',
    playerOnlyCookie: players ? a(players, 'OnlyCookie', '') : '',
    monsters: hasMonsters,
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

function mapSpawn(spawnNode) {
  const coordsNode = first(spawnNode.Coordinates);
  const damage = first(spawnNode.Damage);
  const defense = first(spawnNode.Defense);
  const spec = first(spawnNode.Spec);
  const base = first(spawnNode.Base);

  return {
    name: a(spawnNode, 'Name', ''),
    import: a(spawnNode, 'Import', ''),
    flags: a(spawnNode, 'Flags', '').split(' ').filter(Boolean),
    despawnAfter: a(spawnNode, 'DespawnAfter', ''),
    activeFrom: a(spawnNode, 'ActiveFrom', ''),
    activeTo: a(spawnNode, 'ActiveTo', ''),
    despawnLoot: a(spawnNode, 'DespawnLoot', 'false') === 'true',
    immunities: mapImmunities(spawnNode.Immunities),
    loot: mapLoot(first(spawnNode.Loot)),
    coordinates: (coordsNode?.Coordinate || []).map((c) => ({
      x: a(c, 'X', ''),
      y: a(c, 'Y', ''),
    })),
    combat: {
      minDmg: a(damage, 'MinDmg', ''),
      maxDmg: a(damage, 'MaxDmg', ''),
      offensiveElement: a(damage, 'Elements', ''),
      ac: a(defense, 'Ac', ''),
      mr: a(defense, 'Mr', ''),
      defensiveElement: a(defense, 'Elements', ''),
    },
    base: {
      level: a(base, 'Level', ''),
      weakChance: a(base, 'WeakChance', ''),
      strongChance: a(base, 'StrongChance', ''),
      behaviorSet: a(base, 'BehaviorSet', ''),
    },
    spec: {
      disabled: a(spec, 'Disabled', 'false') === 'true',
      minCount: a(spec, 'MinCount', ''),
      maxCount: a(spec, 'MaxCount', ''),
      maxPerInterval: a(spec, 'MaxPerInterval', ''),
      interval: a(spec, 'Interval', ''),
      limit: a(spec, 'Limit', ''),
      percentage: a(spec, 'Percentage', ''),
      when: a(spec, 'When', ''),
    },
    hostility: mapHostility(first(spawnNode.Hostility)),
    cookies: mapCookies(first(spawnNode.SetCookies)),
  };
}

function mapXmlToSpawngroup(result, comment) {
  const root = result.SpawnGroup;
  const lootNode = first(root?.Loot);
  const spawnsNode = first(root?.Spawns);

  return {
    name: a(root, 'Name', ''),
    prefix: '',
    baseLevel: a(root, 'BaseLevel', ''),
    despawnAfter: a(root, 'DespawnAfter', ''),
    disabled: a(root, 'Disabled', 'false') === 'true',
    comment,
    loot: mapLoot(lootNode),
    spawns: (spawnsNode?.Spawn || []).map(mapSpawn),
  };
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeSpawngroupXml(sg) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' },
  });
  const xml = injectComment(builder.buildObject(buildXmlObject(sg)), sg.comment, 'SpawnGroup');
  return xml + '\n';
}

function buildImmunities(immunities) {
  if (!immunities?.length) return undefined;
  return [{
    Immunity: immunities.map((imm) => ({
      _: imm.value,
      $: omitEmpty({ Type: imm.type, MessageType: imm.messageType, Message: imm.message }),
    })),
  }];
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
  return [{
    Cookie: cookies.map((c) => ({ $: omitEmpty({ Name: c.name, Value: c.value }) })),
  }];
}

function buildSpawn(spawn) {
  const spawnAttrs = omitEmpty({
    Name: spawn.name,
    Import: spawn.import,
    Flags: spawn.flags?.length ? spawn.flags.join(' ') : undefined,
    DespawnAfter: spawn.despawnAfter,
    ActiveFrom: spawn.activeFrom,
    ActiveTo: spawn.activeTo,
  });
  if (spawn.despawnLoot) spawnAttrs.DespawnLoot = 'true';
  const node = { $: spawnAttrs };

  const immunities = buildImmunities(spawn.immunities);
  if (immunities) node.Immunities = immunities;

  const loot = buildLoot(spawn.loot);
  if (loot) node.Loot = loot;

  if (spawn.coordinates?.length) {
    node.Coordinates = [{
      Coordinate: spawn.coordinates.map((c) => ({ $: omitEmpty({ X: c.x, Y: c.y }) })),
    }];
  }

  const dmgAttrs = omitEmpty({ MinDmg: spawn.combat.minDmg, MaxDmg: spawn.combat.maxDmg, Elements: spawn.combat.offensiveElement });
  if (Object.keys(dmgAttrs).length) node.Damage = [{ $: dmgAttrs }];

  const defAttrs = omitEmpty({ Ac: spawn.combat.ac, Mr: spawn.combat.mr, Elements: spawn.combat.defensiveElement });
  if (Object.keys(defAttrs).length) node.Defense = [{ $: defAttrs }];

  const specAttrs = omitEmpty({
    MinCount: spawn.spec.minCount,
    MaxCount: spawn.spec.maxCount,
    MaxPerInterval: spawn.spec.maxPerInterval,
    Interval: spawn.spec.interval,
    Limit: spawn.spec.limit,
    Percentage: spawn.spec.percentage,
    When: spawn.spec.when,
  });
  if (spawn.spec.disabled) specAttrs.Disabled = 'true';
  if (Object.keys(specAttrs).length) node.Spec = [{ $: specAttrs }];

  const baseAttrs = omitEmpty({
    BehaviorSet: spawn.base.behaviorSet,
    Level: spawn.base.level,
    WeakChance: spawn.base.weakChance,
    StrongChance: spawn.base.strongChance,
  });
  if (Object.keys(baseAttrs).length) node.Base = [{ $: baseAttrs }];

  const hostility = buildHostility(spawn.hostility);
  if (hostility) node.Hostility = hostility;

  const cookies = buildCookies(spawn.cookies);
  if (cookies) node.SetCookies = cookies;

  return node;
}

function buildXmlObject(sg) {
  const rootAttrs = omitEmpty({
    xmlns: XMLNS,
    Name: sg.name,
    BaseLevel: sg.baseLevel,
    DespawnAfter: sg.despawnAfter,
  });
  if (sg.disabled) rootAttrs.Disabled = 'true';

  const node = { SpawnGroup: { $: rootAttrs } };

  if (sg.spawns?.length) {
    node.SpawnGroup.Spawns = [{ Spawn: sg.spawns.map(buildSpawn) }];
  }

  const loot = buildLoot(sg.loot);
  if (loot) node.SpawnGroup.Loot = loot;

  return node;
}
