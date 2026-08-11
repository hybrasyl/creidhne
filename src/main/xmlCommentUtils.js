/**
 * Extracts the value of a `<!-- Comment: ... -->` annotation from raw XML.
 * Must be called before xml2js parsing since the parser strips comments.
 */
export function extractComment(xmlString) {
  const m = /<!--\s*Comment:\s*(.*?)\s*-->/.exec(xmlString)
  return m ? m[1] : ''
}

/**
 * Injects a `<!-- Comment: ... -->` annotation as the first child of the root element.
 * @param {string} xml       - Serialized XML string
 * @param {string} comment   - Comment text (empty string = no-op)
 * @param {string} rootTag   - Root element name, e.g. 'BehaviorSet'
 */
export function injectComment(xml, comment, rootTag) {
  if (!comment) return xml
  return xml.replace(new RegExp(`(<${rootTag}[^>]*>)`), `$1\n  <!-- Comment: ${comment} -->`)
}

/**
 * Extracts the value of a `<!-- Location: ... -->` annotation from raw XML.
 * Must be called before xml2js parsing since the parser strips comments.
 *
 * NPC-only in practice: 572 of the 594 files in the production world carry it
 * and no other entity type uses it at all. It predates `creidhne:meta` (exactly
 * one NPC carries that), which is why it is a bare annotation rather than a
 * meta key — and why nothing may drop it on save.
 */
export function extractLocation(xmlString) {
  const m = /<!--\s*Location:\s*(.*?)\s*-->/.exec(xmlString)
  return m ? m[1] : ''
}

/**
 * Injects `<!-- Location: ... -->` and `<!-- Comment: ... -->` after the root's
 * `<Name>` element, which is where every hand-authored file in the world repo
 * puts them — checked against all 572 files that carry a Location, and 400
 * sampled for position without a single exception.
 *
 * Placement is the whole reason this is separate from `injectComment`. That one
 * writes immediately after the root tag, i.e. BEFORE `<Name>`, so using it here
 * would move the annotation on every file it touches and turn a one-line save
 * into a three-line diff across most of the world repo.
 *
 * Order matches the files too: Location first, then Comment.
 *
 * @param {string} xml       - Serialized XML string
 * @param {string} location  - Location text (empty string = omitted)
 * @param {string} comment   - Comment text (empty string = omitted)
 */
export function injectNameAnnotations(xml, location, comment) {
  const lines = []
  if (location) lines.push(`  <!-- Location: ${location} -->`)
  if (comment) lines.push(`  <!-- Comment: ${comment} -->`)
  if (!lines.length) return xml
  return xml.replace(/(<Name>.*?<\/Name>)/, `$1\n${lines.join('\n')}`)
}

const CASTABLE_META_DEFAULTS = {
  isTest: false,
  isGM: false,
  givenViaScript: false,
  deprecated: false,
  specialty: '',
  healFormulaName: '',
  damageFormulaName: ''
}

/**
 * Extracts the `<!-- creidhne:meta {...} -->` annotation from raw XML.
 * Must be called before xml2js parsing. Returns `defaults` if not present.
 *
 * Keys outside `defaults` survive — the parsed JSON is spread over it, not
 * filtered by it — so a domain may read a key this module has never heard of.
 * Pass the defaults for your own domain; the castable set is the default only
 * because castables were the first caller.
 *
 * @param {string} xmlString
 * @param {object} defaults  Shape and fallback values for this domain's meta.
 */
export function extractMeta(xmlString, defaults = CASTABLE_META_DEFAULTS) {
  const m = /<!--\s*creidhne:meta\s+({.*?})\s*-->/.exec(xmlString)
  if (!m) return { ...defaults }
  try {
    return { ...defaults, ...JSON.parse(m[1]) }
  } catch {
    return { ...defaults }
  }
}

/**
 * Injects a `<!-- creidhne:meta {...} -->` annotation as the first child of the
 * root element. No-op when nothing is worth recording, so files that carry no
 * meta stay clean.
 *
 * KEY-AGNOSTIC ON PURPOSE. This used to test a hardcoded seven-field `&&`
 * chain of castable keys, which silently dropped the whole annotation for any
 * domain whose keys were not in that list — no throw, no warning. Creature and
 * NPC meta each grew a private copy of this function to get around it, so the
 * bug produced three near-identical injectors rather than one visible failure.
 *
 * The contract that replaces the key list: **falsy means absent.** Only truthy
 * values are written, and a meta whose every value is falsy is not annotated at
 * all. Every meta key in the app defaults to `false` or `''`, so this holds
 * today — but a future key whose meaningful value is falsy (a flag defaulting
 * to `true`, a legitimate `0`) cannot be expressed here and needs a real
 * element rather than an annotation.
 */
export function injectMeta(xml, meta, rootTag) {
  const payload = Object.fromEntries(Object.entries(meta || {}).filter(([, v]) => v))
  if (!Object.keys(payload).length) return xml
  const json = JSON.stringify(payload)
  return xml.replace(new RegExp(`(<${rootTag}[^>]*>)`), `$1\n  <!-- creidhne:meta ${json} -->`)
}
