import xml2js from 'xml2js'
import { extractComment, injectComment } from './xmlCommentUtils.js'
import { buildLootTable, mapLootTable } from './lootTableXml.js'
import { emptyLootTable } from '../shared/lootModel.js'

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const a = (node, key, def = '') => node?.$?.[key] ?? def
const omitEmpty = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  )

// =============================================================================
// PARSER
// =============================================================================

export function parseLootXml(xmlString) {
  return new Promise((resolve, reject) => {
    const comment = extractComment(xmlString)
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err)
      try {
        resolve(mapXmlToLoot(result, comment))
      } catch (e) {
        reject(e)
      }
    })
  })
}

function mapXmlToLoot(result, comment) {
  const root = result.LootSet
  // Every <Table>, and every <Items> list in each (HTOO-522). The XSD requires
  // one table, so a file with none opens with one blank table to fill.
  const tables = (root.Table || []).map(mapLootTable)
  return {
    name: a(root, 'Name', ''),
    inInventory: a(root, 'InInventory', 'false') === 'true',
    comment,
    tables: tables.length ? tables : [emptyLootTable()]
  }
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeLootXml(loot) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' }
  })
  const xml = injectComment(builder.buildObject(buildXmlObject(loot)), loot.comment, 'LootSet')
  return xml + '\n'
}

function buildXmlObject(loot) {
  const rootAttrs = omitEmpty({ xmlns: XMLNS, Name: loot.name })
  if (loot.inInventory) rootAttrs.InInventory = 'true'

  return {
    LootSet: {
      $: rootAttrs,
      Table: loot.tables.map(buildLootTable)
    }
  }
}
