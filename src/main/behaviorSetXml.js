import xml2js from 'xml2js'
import { extractComment, injectComment } from './xmlCommentUtils.js'

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const first = (arr, def = undefined) => (Array.isArray(arr) && arr.length ? arr[0] : def)
const a = (node, key, def = '') => node?.$?.[key] ?? def

// =============================================================================
// PARSER
// =============================================================================

function mapStatModifiers(statNode) {
  if (!statNode) return { rows: [], elementalModifiers: [] }
  const s = first(statNode)
  if (!s) return { rows: [], elementalModifiers: [] }
  const attrs = s.$ || {}
  const rows = Object.entries(attrs)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => ({ key: k, value: v }))
  const elemsNode = first(s.ElementalModifiers)
  const elementalModifiers = elemsNode
    ? (elemsNode.ElementalModifier || []).map((em) => ({
        type: a(em, 'Type', 'Augment'),
        element: a(em, 'Element', ''),
        modifier: a(em, 'Modifier', '1')
      }))
    : []
  return { rows, elementalModifiers }
}

function mapImmunities(immNode) {
  if (!immNode) return []
  const imm = first(immNode)
  if (!imm) return []
  return (imm.Immunity || []).map((i) => ({
    type: a(i, 'Type', 'Element'),
    value: i._ || '',
    messageType: a(i, 'MessageType', 'Say'),
    message: a(i, 'Message', '')
  }))
}

function mapHostilityEntry(node) {
  if (!node) return { enabled: false, exceptCookie: '', onlyCookie: '' }
  const n = first(node)
  if (!n) return { enabled: false, exceptCookie: '', onlyCookie: '' }
  return {
    enabled: true,
    exceptCookie: a(n, 'ExceptCookie', ''),
    onlyCookie: a(n, 'OnlyCookie', '')
  }
}

function mapBehavior(behaviorNode) {
  const defaultResult = {
    castingSets: [],
    hostility: {
      monsters: { enabled: false, exceptCookie: '', onlyCookie: '' },
      players: { enabled: false, exceptCookie: '', onlyCookie: '' }
    },
    cookies: []
  }

  if (!behaviorNode) return defaultResult
  const beh = first(behaviorNode)
  if (!beh) return defaultResult

  // Casting sets
  const csNode = first(beh.CastingSets)
  const castingSets = csNode
    ? (csNode.CastingSet || []).map((cs) => ({
        type: a(cs, 'Type', 'Offense'),
        interval: a(cs, 'Interval', ''),
        targetPriority: a(cs, 'TargetPriority', ''),
        healthPercentage: a(cs, 'HealthPercentage', ''),
        random: a(cs, 'Random', 'true') !== 'false',
        categories: a(cs, 'Categories', ''),
        castables: (cs.Castable || []).map((c) => ({
          name: c._ || '',
          healthPercentage: a(c, 'HealthPercentage', ''),
          interval: a(c, 'Interval', '')
        }))
      }))
    : []

  // Hostility
  const hostilityNode = first(beh.Hostility)
  const hostility = {
    monsters: mapHostilityEntry(hostilityNode?.Monsters),
    players: mapHostilityEntry(hostilityNode?.Players)
  }

  // Cookies
  const cookiesNode = first(beh.SetCookies)
  const cookies = cookiesNode
    ? (cookiesNode.Cookie || []).map((c) => ({
        name: a(c, 'Name', ''),
        value: a(c, 'Value', '')
      }))
    : []

  return { castingSets, hostility, cookies }
}

function mapCastables(castablesNode) {
  const node = first(castablesNode)
  if (!node) return { auto: true, skillCategories: '', spellCategories: '', names: [] }
  return {
    auto: a(node, 'Auto', 'true') !== 'false',
    skillCategories: a(node, 'SkillCategories', ''),
    spellCategories: a(node, 'SpellCategories', ''),
    names: (node.Castable || []).filter(Boolean)
  }
}

function mapXmlToBehaviorSet(result, comment) {
  const root = result.BehaviorSet
  const { castingSets, hostility, cookies } = mapBehavior(root.Behavior)
  return {
    name: a(root, 'Name', ''),
    comment,
    import: a(root, 'Import', ''),
    statAlloc: first(root.StatAlloc, ''),
    castables: mapCastables(root.Castables),
    castingSets,
    hostility,
    cookies,
    immunities: mapImmunities(root.Immunities),
    statModifiers: mapStatModifiers(root.StatModifiers)
  }
}

export function parseBehaviorSetXml(xmlString) {
  return new Promise((resolve, reject) => {
    const comment = extractComment(xmlString)
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err)
      try {
        resolve(mapXmlToBehaviorSet(result, comment))
      } catch (e) {
        reject(e)
      }
    })
  })
}

// =============================================================================
// SERIALIZER
// =============================================================================

function buildStatModifiers(sm) {
  if (!sm) return undefined
  const attrs = {}
  for (const row of sm.rows || []) {
    if (row.value !== '' && row.value != null) attrs[row.key] = row.value
  }
  const node = {}
  if (Object.keys(attrs).length) node.$ = attrs
  if (sm.elementalModifiers?.length) {
    node.ElementalModifiers = [
      {
        ElementalModifier: sm.elementalModifiers.map((em) => ({
          $: { Type: em.type, Element: em.element, Modifier: em.modifier }
        }))
      }
    ]
  }
  return node.$ || node.ElementalModifiers ? [node] : undefined
}

function buildCastingSets(castingSets) {
  if (!castingSets?.length) return undefined
  const sets = castingSets.map((cs) => {
    const attrs = { Type: cs.type }
    if (cs.interval) attrs.Interval = cs.interval
    if (cs.targetPriority) attrs.TargetPriority = cs.targetPriority
    if (cs.healthPercentage) attrs.HealthPercentage = cs.healthPercentage
    attrs.Random = cs.random ? 'true' : 'false'
    if (cs.categories?.trim()) attrs.Categories = cs.categories.trim()

    const node = { $: attrs }
    if (cs.castables?.length) {
      node.Castable = cs.castables
        .filter((c) => c.name?.trim())
        .map((c) => {
          const cAttrs = {}
          if (c.healthPercentage) cAttrs.HealthPercentage = c.healthPercentage
          if (c.interval) cAttrs.Interval = c.interval
          return Object.keys(cAttrs).length ? { $: cAttrs, _: c.name } : c.name
        })
    }
    return node
  })
  return [{ CastingSet: sets }]
}

function buildHostility(hostility) {
  if (!hostility) return undefined
  const { monsters, players } = hostility
  if (!monsters?.enabled && !players?.enabled) return undefined

  const node = {}
  if (players?.enabled) {
    const attrs = {}
    if (players.exceptCookie) attrs.ExceptCookie = players.exceptCookie
    if (players.onlyCookie) attrs.OnlyCookie = players.onlyCookie
    node.Players = [Object.keys(attrs).length ? { $: attrs } : {}]
  }
  if (monsters?.enabled) {
    const attrs = {}
    if (monsters.exceptCookie) attrs.ExceptCookie = monsters.exceptCookie
    if (monsters.onlyCookie) attrs.OnlyCookie = monsters.onlyCookie
    node.Monsters = [Object.keys(attrs).length ? { $: attrs } : {}]
  }
  return [node]
}

function buildCookies(cookies) {
  if (!cookies?.length) return undefined
  const items = cookies.filter((c) => c.name?.trim())
  if (!items.length) return undefined
  return [
    {
      Cookie: items.map((c) => {
        const attrs = { Name: c.name }
        if (c.value) attrs.Value = c.value
        return { $: attrs }
      })
    }
  ]
}

function buildXmlObject(bvs) {
  const attrs = { xmlns: XMLNS, Name: bvs.name }
  if (bvs.import) attrs.Import = bvs.import

  const root = { $: attrs }

  if (bvs.statAlloc?.trim()) {
    root.StatAlloc = [bvs.statAlloc.trim()]
  }

  const c = bvs.castables
  if (c && (!c.auto || c.skillCategories?.trim() || c.spellCategories?.trim() || c.names?.length)) {
    const attrs = {}
    if (!c.auto) attrs.Auto = 'false'
    if (c.skillCategories?.trim()) attrs.SkillCategories = c.skillCategories.trim()
    if (c.spellCategories?.trim()) attrs.SpellCategories = c.spellCategories.trim()
    const castablesNode = { $: attrs }
    const filtered = (c.names || []).filter((n) => n?.trim())
    if (filtered.length) castablesNode.Castable = filtered
    root.Castables = [castablesNode]
  }

  const csSets = buildCastingSets(bvs.castingSets)
  const hostNode = buildHostility(bvs.hostility)
  const cookNode = buildCookies(bvs.cookies)

  if (csSets || hostNode || cookNode) {
    const behNode = {}
    if (csSets) behNode.CastingSets = csSets
    if (hostNode) behNode.Hostility = hostNode
    if (cookNode) behNode.SetCookies = cookNode
    root.Behavior = [behNode]
  }

  if (bvs.immunities?.length) {
    root.Immunities = [
      {
        Immunity: bvs.immunities.map((imm) => {
          const immAttrs = { Type: imm.type }
          if (imm.messageType) immAttrs.MessageType = imm.messageType
          if (imm.message) immAttrs.Message = imm.message
          return { $: immAttrs, _: imm.value }
        })
      }
    ]
  }

  const sm = buildStatModifiers(bvs.statModifiers)
  if (sm) root.StatModifiers = sm

  return { BehaviorSet: root }
}

export function serializeBehaviorSetXml(bvs) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' }
  })
  const xml = injectComment(builder.buildObject(buildXmlObject(bvs)), bvs.comment, 'BehaviorSet')
  return xml + '\n'
}
