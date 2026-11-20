import { xmlText } from '@eriscorp/hybindex-ts'

/**
 * Where a file of each type keeps its own name, and a one-line rewrite of it
 * (WP8, decision 2).
 *
 * hybindex-ts reads a name in one of two ways and does not export the map:
 * a root attribute (`ATTR_NAME_MAP`), or the first `<Name>` element in the
 * file. This restates that map, because the CLI's `rename` must change the
 * same text the index reads. `entityName.test.js` pins the copy to the
 * package: it builds an index over one file of each type and checks that
 * `readEntityName` gives the name the index gives.
 */

/** Types named by a root attribute, and the attribute. */
export const ROOT_ATTRIBUTE_NAME = Object.freeze({
  statuses: 'Name',
  creatures: 'Name',
  creaturebehaviorsets: 'Name',
  elementtables: 'Name',
  lootsets: 'Name',
  serverconfigs: 'Name',
  spawngroups: 'Name',
  traits: 'Name',
  species: 'Key',
  localizations: 'Locale'
})

/** The name hybindex gives a file of these types with no name attribute (`ATTR_NAME_DEFAULT`). */
export const ROOT_ATTRIBUTE_DEFAULT = Object.freeze({
  elementtables: 'default',
  serverconfigs: 'default'
})

/** Types named by the first `<Name>` element in the file. */
export const NAME_ELEMENT_TYPES = Object.freeze([
  'castables',
  'items',
  'nations',
  'npcs',
  'recipes',
  'variantgroups'
])

/** The types `rename` can change: one of the two shapes above. */
export const NAMED_TYPES = Object.freeze([
  ...Object.keys(ROOT_ATTRIBUTE_NAME),
  ...NAME_ELEMENT_TYPES
])

// The root element's opening tag, after a BOM, an XML declaration, comments
// and a DOCTYPE. The same prefix hybindex skips.
const ROOT_TAG =
  /^((?:\uFEFF|\s|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>)*<[A-Za-z_][^\s/>]*)([^>]*)(>)/
const NAME_ELEMENT = /(<Name>)([^<]*)(<\/Name>)/

function escapeXml(value, forAttribute) {
  const base = String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return forAttribute ? base.replace(/"/g, '&quot;') : base
}

function assertNamed(type) {
  if (!NAMED_TYPES.includes(type)) throw new Error(`No name rule for type "${type}"`)
}

/** The file's own name, decoded as the index decodes it, or "" when it has none. */
export function readEntityName(type, xml) {
  assertNamed(type)
  const attr = ROOT_ATTRIBUTE_NAME[type]
  if (attr) {
    const value = rootAttribute(xml, attr)
    return xmlText(value ?? ROOT_ATTRIBUTE_DEFAULT[type])
  }
  return xmlText(NAME_ELEMENT.exec(xml)?.[2])
}

/** The raw value of an attribute on the root element, or null when it is absent. */
function rootAttribute(xml, attr) {
  const attrs = ROOT_TAG.exec(xml)?.[2]
  const m = attrs == null ? null : new RegExp(`\\b${attr}="([^"]*)"`).exec(attrs)
  return m ? m[1] : null
}

/**
 * Change the file's own name from `oldName` to `newName`, and nothing else.
 * Returns the new XML. Throws when the file's name is not `oldName`, so a
 * rewrite never lands on a file the caller misread.
 */
export function rewriteEntityName(type, xml, oldName, newName) {
  assertNamed(type)
  const current = readEntityName(type, xml)
  if (current !== xmlText(oldName)) {
    throw new Error(`The file is named "${current}", not "${oldName}"`)
  }
  const attr = ROOT_ATTRIBUTE_NAME[type]
  if (attr) {
    if (rootAttribute(xml, attr) === null) {
      throw new Error(`The file has no ${attr} attribute to change (its name is the default)`)
    }
    return xml.replace(ROOT_TAG, (whole, open, attrs, close) => {
      const next = attrs.replace(
        new RegExp(`(\\b${attr}=")([^"]*)(")`),
        (m, a, _value, z) => `${a}${escapeXml(newName, true)}${z}`
      )
      return `${open}${next}${close}`
    })
  }
  return xml.replace(
    NAME_ELEMENT,
    (m, open, _value, close) => `${open}${escapeXml(newName, false)}${close}`
  )
}
