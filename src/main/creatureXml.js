import xml2js from 'xml2js'
import { extractComment, injectComment, extractMeta } from './xmlCommentUtils.js'

// Design note: LootList intentionally only supports <Set> (named loot-set imports).
// The XSD also defines <Table> (inline loot tables), <Gold>, and an Xp attribute,
// but by design all creature loot is managed centrally through named LootSets.
// Inline tables and gold/xp overrides on individual creatures are not supported.

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const CREATURE_META_DEFAULTS = { family: '', weapon: '' }

function extractCreatureMeta(xmlString) {
  // Root creature meta always sits between <Creature> and the first nested
  // <Types> block. Constrain the search so a per-subtype creidhne:meta
  // comment doesn't accidentally promote into the root meta.
  const typesIdx = xmlString.search(/<Types?\b/)
  const head = typesIdx === -1 ? xmlString : xmlString.slice(0, typesIdx)
  const raw = extractMeta(head)
  return { family: raw.family || '', weapon: raw.weapon || '' }
}

function injectCreatureMeta(xml, meta) {
  if (!meta?.family && !meta?.weapon) return xml
  const payload = {}
  if (meta.family) payload.family = meta.family
  if (meta.weapon) payload.weapon = meta.weapon
  return xml.replace(
    /(<Creature[^>]*>)/,
    `$1\n  <!-- creidhne:meta ${JSON.stringify(payload)} -->`
  )
}

const SUBTYPE_META_DEFAULTS = { weapon: '' }

// Per-subtype meta lives inside each <Type Name="X">...</Type> block. xml2js
// strips comments, so we scan the raw XML and build a name→meta map keyed
// by subtype name (subtype names are required and presumed unique within a
// creature file).
function extractSubtypeMetas(xmlString) {
  const map = {}
  const blockRe = /<Type\b([^>]*)>([\s\S]*?)<\/Type>/g
  let m
  while ((m = blockRe.exec(xmlString))) {
    const attrs = m[1]
    const body = m[2]
    const nameMatch = /Name="([^"]*)"/.exec(attrs)
    if (!nameMatch) continue
    const metaMatch = /<!--\s*creidhne:meta\s+({.*?})\s*-->/.exec(body)
    if (!metaMatch) continue
    try {
      map[nameMatch[1]] = { ...SUBTYPE_META_DEFAULTS, ...JSON.parse(metaMatch[1]) }
    } catch {
      /* skip malformed */
    }
  }
  return map
}

// Inject creidhne:meta inside each <Type> block whose corresponding subtype
// data carries a non-default meta. Handles self-closing tags by promoting
// them to paired form, since a comment can only live inside element bodies.
function injectSubtypeMetas(xml, subtypes) {
  let result = xml
  for (const sub of subtypes || []) {
    if (!sub.meta?.weapon) continue
    const escapedName = sub.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`<Type\\b[^>]*\\bName="${escapedName}"[^>]*?(\\/?)>`)
    const metaJson = JSON.stringify(sub.meta)
    result = result.replace(re, (match, slash) => {
      const metaComment = `<!-- creidhne:meta ${metaJson} -->`
      if (slash) {
        const opening = match.replace(/\s*\/\s*>$/, '>')
        return `${opening}\n      ${metaComment}\n    </Type>`
      }
      return `${match}\n      ${metaComment}`
    })
  }
  return result
}

const first = (arr, def = undefined) => (Array.isArray(arr) && arr.length ? arr[0] : def)
const a = (node, key, def = '') => node?.$?.[key] ?? def
const omitEmpty = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  )

// =============================================================================
// PARSER
// =============================================================================

export function parseCreatureXml(xmlString) {
  return new Promise((resolve, reject) => {
    const comment = extractComment(xmlString)
    const meta = extractCreatureMeta(xmlString)
    const subtypeMetas = extractSubtypeMetas(xmlString)

    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err)
      try {
        resolve(mapXmlToCreature(result, comment, meta, subtypeMetas))
      } catch (e) {
        reject(e)
      }
    })
  })
}

function mapLoot(lootNode) {
  if (!lootNode) return []
  return (lootNode.Set || []).map((s) => ({
    name: a(s, 'Name', ''),
    rolls: a(s, 'Rolls', ''),
    chance: a(s, 'Chance', '')
  }))
}

function mapHostility(hosNode) {
  if (!hosNode) {
    return {
      players: false,
      playerExceptCookie: '',
      playerOnlyCookie: '',
      monsters: false,
      monsterExceptCookie: '',
      monsterOnlyCookie: ''
    }
  }
  const hasPlayers = Array.isArray(hosNode.Players) && hosNode.Players.length > 0
  const hasMonsters = Array.isArray(hosNode.Monsters) && hosNode.Monsters.length > 0
  const players = hasPlayers ? hosNode.Players[0] : null
  const monsters = hasMonsters ? hosNode.Monsters[0] : null
  return {
    players: hasPlayers,
    playerExceptCookie: players ? a(players, 'ExceptCookie', '') : '',
    playerOnlyCookie: players ? a(players, 'OnlyCookie', '') : '',
    monsters: hasMonsters,
    monsterExceptCookie: monsters ? a(monsters, 'ExceptCookie', '') : '',
    monsterOnlyCookie: monsters ? a(monsters, 'OnlyCookie', '') : ''
  }
}

function mapCookies(cookiesNode) {
  if (!cookiesNode) return []
  return (cookiesNode.Cookie || []).map((c) => ({
    name: a(c, 'Name', ''),
    value: a(c, 'Value', '')
  }))
}

function mapSubtype(typeNode, subtypeMetas) {
  const name = a(typeNode, 'Name', '')
  return {
    name,
    sprite: a(typeNode, 'Sprite', ''),
    behaviorSet: a(typeNode, 'BehaviorSet', ''),
    minDmg: a(typeNode, 'MinDmg', ''),
    maxDmg: a(typeNode, 'MaxDmg', ''),
    assailSound: a(typeNode, 'AssailSound', ''),
    description: first(typeNode.Description, ''),
    loot: mapLoot(first(typeNode.Loot)),
    hostility: mapHostility(first(typeNode.Hostility)),
    cookies: mapCookies(first(typeNode.SetCookies)),
    meta: subtypeMetas[name] || { ...SUBTYPE_META_DEFAULTS }
  }
}

function mapXmlToCreature(result, comment, meta, subtypeMetas) {
  const root = result.Creature
  return {
    name: a(root, 'Name', ''),
    sprite: a(root, 'Sprite', ''),
    behaviorSet: a(root, 'BehaviorSet', ''),
    minDmg: a(root, 'MinDmg', ''),
    maxDmg: a(root, 'MaxDmg', ''),
    assailSound: a(root, 'AssailSound', ''),
    comment,
    meta: meta || { ...CREATURE_META_DEFAULTS },
    description: first(root.Description, ''),
    loot: mapLoot(first(root.Loot)),
    hostility: mapHostility(first(root.Hostility)),
    cookies: mapCookies(first(root.SetCookies)),
    subtypes: (root.Types?.[0]?.Type || []).map((t) => mapSubtype(t, subtypeMetas))
  }
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeCreatureXml(creature) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' }
  })

  let xml = builder.buildObject(buildXmlObject(creature))
  xml = injectComment(xml, creature.comment, 'Creature')
  xml = injectCreatureMeta(xml, creature.meta)
  xml = injectSubtypeMetas(xml, creature.subtypes)

  return xml + '\n'
}

function buildLoot(lootArr) {
  if (!lootArr?.length) return undefined
  return [
    {
      Set: lootArr.map((s) => ({
        $: omitEmpty({ Name: s.name, Rolls: s.rolls, Chance: s.chance })
      }))
    }
  ]
}

function buildHostility(hos) {
  const hasMonsters = hos?.monsters
  const hasPlayers = hos?.players
  if (!hasMonsters && !hasPlayers) return undefined

  const node = {}
  if (hasMonsters) {
    node.Monsters = [
      { $: omitEmpty({ ExceptCookie: hos.monsterExceptCookie, OnlyCookie: hos.monsterOnlyCookie }) }
    ]
  }
  if (hasPlayers) {
    node.Players = [
      { $: omitEmpty({ ExceptCookie: hos.playerExceptCookie, OnlyCookie: hos.playerOnlyCookie }) }
    ]
  }
  return [node]
}

function buildCookies(cookies) {
  if (!cookies?.length) return undefined
  return [{ Cookie: cookies.map((c) => ({ $: omitEmpty({ Name: c.name, Value: c.value }) })) }]
}

function buildSubtype(sub) {
  const node = {
    $: Object.assign(
      { Name: sub.name },
      omitEmpty({
        Sprite: sub.sprite,
        BehaviorSet: sub.behaviorSet,
        MinDmg: sub.minDmg,
        MaxDmg: sub.maxDmg,
        AssailSound: sub.assailSound
      })
    )
  }
  if (sub.description) node.Description = [sub.description]
  const loot = buildLoot(sub.loot)
  if (loot) node.Loot = loot
  const hos = buildHostility(sub.hostility)
  if (hos) node.Hostility = hos
  const cookies = buildCookies(sub.cookies)
  if (cookies) node.SetCookies = cookies
  return node
}

function buildXmlObject(creature) {
  const root = {
    $: Object.assign(
      { xmlns: XMLNS, Name: creature.name },
      omitEmpty({
        Sprite: creature.sprite,
        BehaviorSet: creature.behaviorSet,
        MinDmg: creature.minDmg,
        MaxDmg: creature.maxDmg,
        AssailSound: creature.assailSound
      })
    )
  }

  if (creature.description) root.Description = [creature.description]

  const loot = buildLoot(creature.loot)
  if (loot) root.Loot = loot

  const hos = buildHostility(creature.hostility)
  if (hos) root.Hostility = hos

  const cookies = buildCookies(creature.cookies)
  if (cookies) root.SetCookies = cookies

  if (creature.subtypes?.length) {
    root.Types = [{ Type: creature.subtypes.map(buildSubtype) }]
  }

  return { Creature: root }
}
