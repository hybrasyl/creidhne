import xml2js from 'xml2js'
import {
  extractComment,
  extractLocation,
  extractMeta,
  injectMeta,
  injectNameAnnotations
} from './xmlCommentUtils.js'

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const first = (arr, def = undefined) => (Array.isArray(arr) && arr.length ? arr[0] : def)
const a = (node, key, def = '') => node?.$?.[key] ?? def
const toBool = (val, def = false) =>
  val === 'true' ? true : val === 'false' ? false : val === undefined ? def : Boolean(val)
const omitEmpty = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  )

const NPC_META_DEFAULTS = { job: '', species: '', location: '' }

// `location` has two sources and they are not equivalent. The legacy
// `<!-- Location: -->` annotation is what 572 of the world's 594 NPCs actually
// carry; `creidhne:meta` is what Creidhne writes, and exactly one file has one.
// So meta wins when present (it is the newer, deliberate value) and the legacy
// annotation is the fallback — which means opening any untouched NPC now shows
// its Location instead of an empty field.
function extractNpcMeta(xmlString) {
  const raw = extractMeta(xmlString, NPC_META_DEFAULTS)
  return {
    job: raw.job || '',
    species: raw.species || '',
    location: raw.location || extractLocation(xmlString)
  }
}

// =============================================================================
// PARSER
// =============================================================================

export function parseNpcXml(xmlString) {
  return new Promise((resolve, reject) => {
    const comment = extractComment(xmlString)
    const meta = extractNpcMeta(xmlString)
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err)
      try {
        resolve(mapXmlToNpc(result, comment, meta))
      } catch (e) {
        reject(e)
      }
    })
  })
}

function mapXmlToNpc(result, comment, meta) {
  const root = result.Npc
  const appearance = first(root.Appearance)
  const roles = first(root.Roles)
  const vend = roles ? first(roles.Vend) : null
  const train = roles ? first(roles.Train) : null
  const post = roles ? first(roles.Post) : null

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
      response: typeof r === 'string' ? r : r._ || ''
    })),
    strings: (root.Strings?.[0]?.String || []).map((s) => ({
      key: a(s, 'Key', ''),
      message: typeof s === 'string' ? s : s._ || ''
    })),
    roles: {
      disableForget: toBool(a(roles, 'DisableForget'), false),
      bank: roles?.Bank?.[0]
        ? {
            nation: a(roles.Bank[0], 'Nation', ''),
            discount: a(roles.Bank[0], 'Discount', ''),
            exceptCookie: a(roles.Bank[0], 'ExceptCookie', ''),
            onlyCookie: a(roles.Bank[0], 'OnlyCookie', ''),
            adjustments: (roles.Bank[0].CostAdjustment || []).map((adj) => ({
              nation: a(adj, 'Nation', ''),
              value: typeof adj === 'string' ? adj : adj._ || ''
            }))
          }
        : null,
      post: post
        ? {
            nation: a(post, 'Nation', ''),
            exceptCookie: a(post, 'ExceptCookie', ''),
            onlyCookie: a(post, 'OnlyCookie', ''),
            surcharges: (post.Surcharge || []).map((s) => ({
              nation: a(s, 'Nation', ''),
              percent: a(s, 'Percent', '')
            })),
            adjustments: (post.CostAdjustment || []).map((adj) => ({
              nation: a(adj, 'Nation', ''),
              value: typeof adj === 'string' ? adj : adj._ || ''
            }))
          }
        : null,
      repair: roles?.Repair?.[0]
        ? {
            nation: a(roles.Repair[0], 'Nation', ''),
            discount: a(roles.Repair[0], 'Discount', ''),
            type: a(roles.Repair[0], 'Type', ''),
            exceptCookie: a(roles.Repair[0], 'ExceptCookie', ''),
            onlyCookie: a(roles.Repair[0], 'OnlyCookie', ''),
            adjustments: (roles.Repair[0].CostAdjustment || []).map((adj) => ({
              nation: a(adj, 'Nation', ''),
              value: typeof adj === 'string' ? adj : adj._ || ''
            }))
          }
        : null,
      vend: vend
        ? {
            exceptCookie: a(vend, 'ExceptCookie', ''),
            onlyCookie: a(vend, 'OnlyCookie', ''),
            items: (vend.Items?.[0]?.Item || []).map((item) => ({
              name: a(item, 'Name', ''),
              quantity: a(item, 'Quantity', '1'),
              restock: a(item, 'Restock', '')
            })),
            adjustments: (vend.CostAdjustment || []).map((adj) => ({
              nation: a(adj, 'Nation', ''),
              value: typeof adj === 'string' ? adj : adj._ || ''
            }))
          }
        : null,
      train: train
        ? {
            exceptCookie: a(train, 'ExceptCookie', ''),
            onlyCookie: a(train, 'OnlyCookie', ''),
            castables: (train.Castable || []).map((c) => ({
              name: a(c, 'Name', ''),
              type: a(c, 'Type', ''),
              class: a(c, 'Class', '')
            })),
            adjustments: (train.CostAdjustment || []).map((adj) => ({
              nation: a(adj, 'Nation', ''),
              value: typeof adj === 'string' ? adj : adj._ || ''
            }))
          }
        : null
    }
  }
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeNpcXml(npc) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' }
  })
  let xml = builder.buildObject(buildXmlObject(npc))
  // Location and Comment go after <Name>, where the world repo keeps them.
  xml = injectNameAnnotations(xml, npc.meta?.location || '', npc.comment)
  // `job` and `species` have neither an XML element nor a legacy annotation,
  // so they are what creidhne:meta holds. Writing `location` here as well would
  // duplicate it, and writing it here INSTEAD would retire the
  // `<!-- Location: -->` line on 572 files to say the same thing in a form no
  // human wrote — so the legacy annotation stays the home for it, and the two
  // files that currently keep location in meta converge onto it on next save.
  xml = injectMeta(xml, { job: npc.meta?.job || '', species: npc.meta?.species || '' }, 'Npc')
  return xml + '\n'
}

function buildXmlObject(npc) {
  const root = { $: { xmlns: XMLNS } }

  root.Name = [npc.name]
  root.DisplayName = [npc.displayName || npc.name]
  root.Appearance = [{ $: omitEmpty({ Sprite: npc.sprite, Portrait: npc.portrait }) }]
  if (npc.allowDead) root.AllowDead = ['true']

  if (npc.responses?.length) {
    root.Responses = [
      {
        Response: npc.responses.map((r) => ({ $: { Call: r.call }, _: r.response }))
      }
    ]
  }

  if (npc.strings?.length) {
    root.Strings = [
      {
        String: npc.strings.map((s) => ({ $: { Key: s.key }, _: s.message }))
      }
    ]
  }

  const { bank, post, repair, vend, train } = npc.roles
  const hasAnyRole =
    bank !== null || post !== null || repair !== null || vend !== null || train !== null

  if (hasAnyRole) {
    const rolesNode = {}
    if (npc.roles.disableForget) rolesNode.$ = { DisableForget: 'true' }

    const serializeAdjustments = (adjustments) =>
      adjustments.map((adj) => ({
        $: omitEmpty({ Nation: adj.nation }),
        _: adj.value
      }))

    // Attribute order follows the world repo's own files (Nation, Discount,
    // then Type where it applies), so a save produces no gratuitous diff.
    if (bank !== null) {
      const bankEl = {
        $: omitEmpty({
          Nation: bank.nation,
          Discount: bank.discount,
          ExceptCookie: bank.exceptCookie,
          OnlyCookie: bank.onlyCookie
        })
      }
      if (bank.adjustments?.length) bankEl.CostAdjustment = serializeAdjustments(bank.adjustments)
      rolesNode.Bank = [bankEl]
    }

    if (post !== null) {
      const postEl = {
        $: omitEmpty({
          Nation: post.nation,
          ExceptCookie: post.exceptCookie,
          OnlyCookie: post.onlyCookie
        })
      }
      if (post.surcharges?.length) {
        postEl.Surcharge = post.surcharges.map((s) => ({
          $: omitEmpty({ Nation: s.nation, Percent: s.percent })
        }))
      }
      if (post.adjustments?.length) postEl.CostAdjustment = serializeAdjustments(post.adjustments)
      rolesNode.Post = [postEl]
    }

    if (repair !== null) {
      const repairEl = {
        $: omitEmpty({
          Nation: repair.nation,
          Discount: repair.discount,
          Type: repair.type,
          ExceptCookie: repair.exceptCookie,
          OnlyCookie: repair.onlyCookie
        })
      }
      if (repair.adjustments?.length)
        repairEl.CostAdjustment = serializeAdjustments(repair.adjustments)
      rolesNode.Repair = [repairEl]
    }

    if (vend !== null) {
      const vendEl = {
        $: omitEmpty({ ExceptCookie: vend.exceptCookie, OnlyCookie: vend.onlyCookie })
      }
      if (vend.items?.length) {
        vendEl.Items = [
          {
            Item: vend.items.map((item) => ({
              $: omitEmpty({ Name: item.name, Quantity: item.quantity, Restock: item.restock })
            }))
          }
        ]
      }
      if (vend.adjustments?.length) vendEl.CostAdjustment = serializeAdjustments(vend.adjustments)
      rolesNode.Vend = [vendEl]
    }

    if (train !== null) {
      const trainEl = {
        $: omitEmpty({ ExceptCookie: train.exceptCookie, OnlyCookie: train.onlyCookie })
      }
      if (train.castables?.length) {
        trainEl.Castable = train.castables.map((c) => ({
          $: omitEmpty({ Name: c.name, Type: c.type, Class: c.class })
        }))
      }
      if (train.adjustments?.length)
        trainEl.CostAdjustment = serializeAdjustments(train.adjustments)
      rolesNode.Train = [trainEl]
    }

    root.Roles = [rolesNode]
  }

  return { Npc: root }
}
