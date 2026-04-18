import xml2js from 'xml2js'
import { extractComment, injectComment } from './xmlCommentUtils.js'

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const first = (arr, def = undefined) => (Array.isArray(arr) && arr.length ? arr[0] : def)
const a = (node, key, def = '') => node?.$?.[key] ?? def
const omitEmpty = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  )

// =============================================================================
// PARSER
// =============================================================================

export function parseNationXml(xmlString) {
  return new Promise((resolve, reject) => {
    const comment = extractComment(xmlString)
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err)
      try {
        resolve(mapXmlToNation(result, comment))
      } catch (e) {
        reject(e)
      }
    })
  })
}

function mapXmlToNation(result, comment) {
  const root = result.Nation
  const spawnPoints = first(root.SpawnPoints)
  const territory = first(root.Territory)

  return {
    name: first(root.Name, ''),
    comment,
    description: first(root.Description, ''),
    flag: a(root, 'Flag', ''),
    isDefault: a(root, 'Default', 'false') === 'true',
    spawnPoints: (spawnPoints?.SpawnPoint || []).map((sp) => ({
      mapName: a(sp, 'MapName', ''),
      x: a(sp, 'X', ''),
      y: a(sp, 'Y', '')
    })),
    territory: territory
      ? (territory.Map || []).map((m) => (typeof m === 'string' ? m : m._ || ''))
      : null
  }
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeNationXml(nation) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' }
  })
  const xml = injectComment(builder.buildObject(buildXmlObject(nation)), nation.comment, 'Nation')
  return xml + '\n'
}

function buildXmlObject(nation) {
  const rootAttrs = { xmlns: XMLNS, Flag: nation.flag }
  if (nation.isDefault) rootAttrs.Default = 'true'
  const root = { $: omitEmpty(rootAttrs) }

  root.Name = [nation.name]
  if (nation.description) root.Description = [nation.description]

  if (nation.spawnPoints?.length) {
    root.SpawnPoints = [
      {
        SpawnPoint: nation.spawnPoints.map((sp) => ({
          $: omitEmpty({ X: sp.x, Y: sp.y, MapName: sp.mapName })
        }))
      }
    ]
  }

  if (nation.territory !== null) {
    root.Territory = [{ Map: nation.territory }]
  }

  return { Nation: root }
}
