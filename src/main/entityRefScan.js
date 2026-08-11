import { xmlText } from '@eriscorp/hybindex-ts'
import { REFERENCE_SITES, sitesIn, sourceTypesFor } from '../shared/entityReferences.js'

/**
 * Find and rewrite the places that name an entity, when its `<Name>` changes.
 * HTOO-378.
 *
 * Pure string work over XML text, deliberately: the alternative is a parse and
 * re-serialize, which reformats every file it touches. A forty-file rename
 * should be forty one-line diffs in the world repository, not forty files whose
 * whitespace changed.
 *
 * ## Matching is scoped to the element, never to the string
 *
 * The attribute form is spelled the same as the attribute that DEFINES a name.
 * `<Item Name="Lorica"/>` inside an npc is a reference; `<Item Name="Lorica">`
 * at the root of an item file is that item's identity. A rewrite keyed on
 * `Name="Lorica"` would corrupt the referring file. So every match is anchored
 * on the element the table names, and an attribute is never matched alone.
 *
 * ## Comparison is on the DECODED value
 *
 * `The Crow & Cask` is stored as `The Crow &amp; Cask`. A raw-text search misses
 * it and then reports a clean result, which reads as "nothing to update" rather
 * than "the search was wrong" — the worse of the two failures, because it is
 * indistinguishable from success. `xmlText` is the index's own decoder, so this
 * agrees with the index about what a name is by construction.
 */

/** Attribute value → decoded text. `xmlText` also trims, which is what we want. */
function decode(raw) {
  return xmlText(raw)
}

/**
 * Escape a name for insertion back into XML.
 *
 * Only the characters that would change the parse. Escaping a value taken from
 * a decoded source and assumed still-encoded is what produced `&amp;amp;` and a
 * dead warp (HTOO-343); the rule is decode on the way in, escape once on the way
 * out, and never both.
 */
function escapeXml(value, forAttribute) {
  const base = String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return forAttribute ? base.replace(/"/g, '&quot;') : base
}

/** A regex matching `<Element … attr="…" …>` or `<Element …>text</Element>`. */
function siteRegex(site) {
  const el = site.element
  if (site.attribute) {
    // The element, then anything that is not `>`, then the attribute. Anchored
    // on the tag so a bare `Name="…"` elsewhere cannot match, and tolerant of
    // attribute order because nothing guarantees it.
    return new RegExp(`(<${el}\\b[^>]*?\\b${site.attribute}=")([^"]*)(")`, 'g')
  }
  // Text content. `[^<]*` keeps it to a leaf element, which every reference in
  // the table is.
  return new RegExp(`(<${el}\\b[^>]*>)([^<]*)(</${el}>)`, 'g')
}

/**
 * True when the whole match should be skipped because a disqualifying attribute
 * is set — `IsCategory="true"` on a castable's `<Add>`/`<Remove>`, where the
 * value names a category rather than a status and a status may legitimately
 * share the string.
 */
function disqualified(site, openingTag) {
  if (!site.unless) return false
  return new RegExp(`\\b${site.unless}="true"`, 'i').test(openingTag)
}

/**
 * Every reference to `oldName` in one file's XML, as `{ site, value }`.
 * Exported for testing; `rewriteReferences` is what callers use.
 */
export function findReferences(xml, sites, oldName) {
  const target = decode(oldName)
  if (!target) return []
  const hits = []
  for (const site of sites) {
    for (const m of xml.matchAll(siteRegex(site))) {
      if (disqualified(site, m[1])) continue
      if (decode(m[2]) !== target) continue
      hits.push({ site, value: m[2] })
    }
  }
  return hits
}

/**
 * Rewrite every reference to `oldName` as `newName`.
 *
 * Returns `{ xml, count }`. Only the inside of a matching element or attribute
 * is replaced, so an untouched file comes back byte-identical and a touched one
 * differs only on the lines that carry a reference.
 */
export function rewriteReferences(xml, sites, oldName, newName) {
  const target = decode(oldName)
  if (!target) return { xml, count: 0 }
  let count = 0
  let out = xml
  for (const site of sites) {
    out = out.replace(siteRegex(site), (whole, open, value, close) => {
      if (disqualified(site, open)) return whole
      if (decode(value) !== target) return whole
      count++
      return `${open}${escapeXml(newName, !!site.attribute)}${close}`
    })
  }
  return { xml: out, count }
}

/**
 * The source types that must be read to answer "who names a `type`", and the
 * sites within each. A thin re-export so a caller does not import two modules.
 */
export function scanPlan(type) {
  if (!REFERENCE_SITES[type]) {
    throw new Error(`entityRefScan: no reference table for type "${type}"`)
  }
  return sourceTypesFor(type).map((sourceType) => ({
    sourceType,
    sites: sitesIn(type, sourceType)
  }))
}
