import xml2js from 'xml2js'
import { extractComment, injectComment } from './xmlCommentUtils.js'
import { buildStatModifiers, parseStatModifiers } from './statModifiersXml.js'

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const first = (arr, def = undefined) => (Array.isArray(arr) && arr.length ? arr[0] : def)
const a = (node, key, def = '') => node?.$?.[key] ?? def
const text = (node) => (typeof node === 'string' ? node : (node?._ ?? ''))
const omitEmpty = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  )

// The Trait root type (HXML-28, HTOO-617). Unlike most types, a trait's key is
// the `Name` ATTRIBUTE, not a <Name> element. Children follow Trait.xsd:
// Description, ExclusiveGroup, ConflictsWith, StatModifiers. No empty optional
// block is written.
//
// The model:
//   name, comment, icon, iconSet ('Skill' | 'Spell'), category, description
//   exclusiveGroup        the group name, '' for none
//   exclusivePolicy       'Reject' | 'Replace' | '' (absent: the schema default, Reject)
//   conflictsWith         [trait name, ...]
//   statModifiers         { rows, elementalModifiers }, as StatsTab edits it

// =============================================================================
// PARSER
// =============================================================================

export function parseTraitXml(xmlString) {
  return new Promise((resolve, reject) => {
    const comment = extractComment(xmlString)
    xml2js.parseString(xmlString, { trim: true }, (err, result) => {
      if (err) return reject(err)
      try {
        resolve(mapXmlToTrait(result, comment))
      } catch (e) {
        reject(e)
      }
    })
  })
}

function mapXmlToTrait(result, comment) {
  const root = result.Trait
  const group = first(root.ExclusiveGroup)
  return {
    name: a(root, 'Name'),
    comment,
    icon: a(root, 'Icon'),
    iconSet: a(root, 'IconSet', 'Skill'),
    category: a(root, 'Category'),
    description: text(first(root.Description, '')),
    exclusiveGroup: group === undefined ? '' : text(group),
    exclusivePolicy: group === undefined ? '' : a(group, 'Policy'),
    conflictsWith: (first(root.ConflictsWith)?.Trait || []).map(text),
    statModifiers: parseStatModifiers(root.StatModifiers)
  }
}

// =============================================================================
// SERIALIZER
// =============================================================================

export function serializeTraitXml(trait) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0' },
    renderOpts: { pretty: true, indent: '  ', newline: '\n' }
  })
  const xml = injectComment(builder.buildObject(buildXmlObject(trait)), trait.comment, 'Trait')
  return xml + '\n'
}

function buildXmlObject(trait) {
  const root = {
    $: {
      xmlns: XMLNS,
      Name: trait.name ?? '',
      ...omitEmpty({
        Icon: trait.icon,
        IconSet: trait.iconSet,
        Category: trait.category
      })
    }
  }
  if (trait.description) root.Description = [trait.description]
  if (trait.exclusiveGroup) {
    root.ExclusiveGroup = [
      trait.exclusivePolicy
        ? { _: trait.exclusiveGroup, $: { Policy: trait.exclusivePolicy } }
        : trait.exclusiveGroup
    ]
  }
  if (trait.conflictsWith?.length) root.ConflictsWith = [{ Trait: trait.conflictsWith }]
  const sm = buildStatModifiers(trait.statModifiers)
  if (sm) root.StatModifiers = sm
  return { Trait: root }
}
