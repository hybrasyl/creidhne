import xml2js from 'xml2js'
import { extractComment, injectComment } from './xmlCommentUtils.js'

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const first = (arr, def = undefined) => (Array.isArray(arr) && arr.length ? arr[0] : def)
const a = (node, key, def = '') => node?.$?.[key] ?? def
const text = (node) => (typeof node === 'string' ? node : (node?._ ?? ''))
const omitEmpty = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  )

// The Species root type (HXML-37, HTOO-618). The key is the `Key` ATTRIBUTE.
// Children follow Species.xsd: Names, Description, Bodies. No empty optional
// block is written. Every value stays the file's text.
//
// The model:
//   key, comment, id, origin, playerOption, branchOf, affinity, resistance
//   names         { singular, plural, adjective }
//   description
//   bodies        [{ key, id, name, isDefault (boolean), retailSkinColor }]

// =============================================================================
// PARSER
// =============================================================================

export function parseSpeciesXml(xmlString) {
  return new Promise((resolve, reject) => {
    const comment = extractComment(xmlString)
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err)
      try {
        resolve(mapXmlToSpecies(result, comment))
      } catch (e) {
        reject(e)
      }
    })
  })
}

function mapXmlToSpecies(result, comment) {
  const root = result.Species
  const names = first(root.Names)
  return {
    key: a(root, 'Key'),
    comment,
    id: a(root, 'Id'),
    origin: a(root, 'Origin'),
    playerOption: a(root, 'PlayerOption'),
    branchOf: a(root, 'BranchOf'),
    affinity: a(root, 'Affinity'),
    resistance: a(root, 'Resistance'),
    names: {
      singular: a(names, 'Singular'),
      plural: a(names, 'Plural'),
      adjective: a(names, 'Adjective')
    },
    description: text(first(root.Description, '')),
    bodies: (first(root.Bodies)?.Body || []).map((b) => ({
      key: a(b, 'Key'),
      id: a(b, 'Id'),
      name: a(b, 'Name'),
      isDefault: a(b, 'Default') === 'true' || a(b, 'Default') === '1',
      retailSkinColor: a(b, 'RetailSkinColor')
    }))
  }
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeSpeciesXml(species) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' }
  })
  const xml = injectComment(
    builder.buildObject(buildXmlObject(species)),
    species.comment,
    'Species'
  )
  return xml + '\n'
}

function buildXmlObject(species) {
  const root = {
    $: {
      xmlns: XMLNS,
      Key: species.key ?? '',
      ...omitEmpty({
        Id: species.id,
        Origin: species.origin,
        PlayerOption: species.playerOption,
        BranchOf: species.branchOf,
        Affinity: species.affinity,
        Resistance: species.resistance
      })
    }
  }
  // Names is required, so it is always written, even with empty forms.
  const names = species.names ?? {}
  root.Names = [
    {
      $: {
        Singular: names.singular ?? '',
        Plural: names.plural ?? '',
        Adjective: names.adjective ?? ''
      }
    }
  ]
  if (species.description) root.Description = [species.description]
  if (species.bodies?.length) {
    root.Bodies = [
      {
        Body: species.bodies.map((b) => ({
          $: omitEmpty({
            Key: b.key,
            Id: b.id,
            Name: b.name,
            Default: b.isDefault ? 'true' : '',
            RetailSkinColor: b.retailSkinColor
          })
        }))
      }
    ]
  }
  return { Species: root }
}
