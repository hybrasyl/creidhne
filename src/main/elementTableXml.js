import xml2js from 'xml2js'
import { extractComment, injectComment } from './xmlCommentUtils.js'
import { blankElement } from '../shared/elementTable.js'

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const a = (node, key, def = '') => node?.$?.[key] ?? def

// The model is described in src/shared/elementTable.js. A save writes back
// every attribute and pair that the file declared, and no pair that it left
// out (HTOO-581): a pair the file does not declare uses the row and table
// defaults, so writing it as 1 would change the table.

// =============================================================================
// PARSER
// =============================================================================

export function parseElementTableXml(xmlString) {
  return new Promise((resolve, reject) => {
    const comment = extractComment(xmlString)

    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err)
      try {
        resolve(mapXmlToElementTable(result, comment))
      } catch (e) {
        reject(e)
      }
    })
  })
}

function mapXmlToElementTable(result, comment) {
  const root = result.ElementTable
  const sources = (root.Source || []).map((s) => ({
    element: a(s, 'Element'),
    defaultMultiplier: a(s, 'DefaultMultiplier'),
    targets: (s.Target || []).map((t) => ({
      element: a(t, 'Element'),
      multiplier: a(t, 'Multiplier')
    }))
  }))

  const elementsNode = root.Elements?.[0]
  const registry = elementsNode !== undefined
  let elements
  if (registry) {
    elements = (elementsNode.Element || []).map((e) => ({
      key: a(e, 'Key'),
      id: a(e, 'Id'),
      retailId: a(e, 'RetailId'),
      name: a(e, 'Name'),
      isDefault: a(e, 'Default') === 'true' || a(e, 'Default') === '1',
      ivernic: a(e, 'Ivernic')
    }))
  } else {
    // The old format: the elements are the Source rows, then any Target that
    // names an element with no row of its own.
    const keys = []
    for (const row of sources) {
      if (!keys.includes(row.element)) keys.push(row.element)
      for (const t of row.targets) if (!keys.includes(t.element)) keys.push(t.element)
    }
    elements = keys.map(blankElement)
  }

  const groups = (root.Groups?.[0]?.Group || []).map((g) => ({
    key: a(g, 'Key'),
    members: a(g, 'Members').split(/\s+/).filter(Boolean)
  }))

  return {
    name: a(root, 'Name'),
    comment,
    defaultMultiplier: a(root, 'DefaultMultiplier'),
    registry,
    elements,
    groups,
    sources
  }
}

// =============================================================================
// SERIALIZER
// =============================================================================

/** The attributes whose value is not empty, in the order given. */
function attrs(pairs) {
  const out = {}
  for (const [k, v] of pairs) if (v !== '' && v !== undefined && v !== null) out[k] = v
  return out
}

export function serializeElementTableXml(tableData) {
  const { name, comment, defaultMultiplier, registry, elements, groups, sources } = tableData

  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' }
  })

  // The schema's order: Elements, Groups, then the Source rows.
  const body = {
    $: {
      xmlns: XMLNS,
      ...attrs([
        ['Name', name],
        ['DefaultMultiplier', defaultMultiplier]
      ])
    }
  }
  if (registry) {
    body.Elements = [
      {
        Element: elements.map((e) => ({
          $: attrs([
            ['Key', e.key],
            ['Id', e.id],
            ['RetailId', e.retailId],
            ['Name', e.name],
            ['Default', e.isDefault ? 'true' : ''],
            ['Ivernic', e.ivernic]
          ])
        }))
      }
    ]
  }
  if (groups?.length) {
    body.Groups = [
      {
        Group: groups.map((g) => ({ $: { Key: g.key, Members: g.members.join(' ') } }))
      }
    ]
  }
  body.Source = sources.map((row) => {
    const node = {
      $: attrs([
        ['Element', row.element],
        ['DefaultMultiplier', row.defaultMultiplier]
      ])
    }
    // A pair the editor cleared has no value, and is not written: it then uses
    // the row and table defaults. No file in the world or ceridwen has a
    // Target without a Multiplier.
    const targets = row.targets.filter((t) => String(t.multiplier ?? '').trim() !== '')
    if (targets.length) {
      node.Target = targets.map((t) => ({
        $: attrs([
          ['Element', t.element],
          ['Multiplier', t.multiplier]
        ])
      }))
    }
    return node
  })

  let xml = builder.buildObject({ ElementTable: body })

  xml = injectComment(xml, comment, 'ElementTable')

  return xml + '\n'
}
