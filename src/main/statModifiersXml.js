// The common <StatModifiers> block (Common.xsd `StatModifiers`), in the
// { rows, elementalModifiers } shape that StatsTab edits. Each attribute is a
// row; <ElementalModifiers> is a list of { type, element, modifier }.
//
// behaviorSetXml.js and statusXml.js hold their own copies of these two
// functions, from before this module. New types use this one.

const first = (arr, def = undefined) => (Array.isArray(arr) && arr.length ? arr[0] : def)
const a = (node, key, def = '') => node?.$?.[key] ?? def

/** The model of a parsed <StatModifiers> node list; empty when there is none. */
export function parseStatModifiers(statNode) {
  const s = first(statNode)
  if (!s) return { rows: [], elementalModifiers: [] }
  const rows = Object.entries(s.$ || {})
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

/** The xml2js node list for the model, or undefined when there is nothing to write. */
export function buildStatModifiers(sm) {
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
