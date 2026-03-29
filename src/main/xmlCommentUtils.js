/**
 * Extracts the value of a `<!-- Comment: ... -->` annotation from raw XML.
 * Must be called before xml2js parsing since the parser strips comments.
 */
export function extractComment(xmlString) {
  const m = /<!--\s*Comment:\s*(.*?)\s*-->/.exec(xmlString);
  return m ? m[1] : '';
}

/**
 * Injects a `<!-- Comment: ... -->` annotation as the first child of the root element.
 * @param {string} xml       - Serialized XML string
 * @param {string} comment   - Comment text (empty string = no-op)
 * @param {string} rootTag   - Root element name, e.g. 'BehaviorSet'
 */
export function injectComment(xml, comment, rootTag) {
  if (!comment) return xml;
  return xml.replace(new RegExp(`(<${rootTag}[^>]*>)`), `$1\n  <!-- Comment: ${comment} -->`);
}

const META_DEFAULTS = { isTest: false, isGM: false, givenViaScript: false, deprecated: false, specialty: '' };

/**
 * Extracts the `<!-- creidhne:meta {...} -->` annotation from raw XML.
 * Must be called before xml2js parsing. Returns defaults if not present.
 */
export function extractMeta(xmlString) {
  const m = /<!--\s*creidhne:meta\s+({.*?})\s*-->/.exec(xmlString);
  if (!m) return { ...META_DEFAULTS };
  try { return { ...META_DEFAULTS, ...JSON.parse(m[1]) }; }
  catch { return { ...META_DEFAULTS }; }
}

/**
 * Injects a `<!-- creidhne:meta {...} -->` annotation as the first child of the root element.
 * No-op if all values are defaults (keeps existing files clean).
 */
export function injectMeta(xml, meta, rootTag) {
  if (!meta || (!meta.isTest && !meta.isGM && !meta.givenViaScript && !meta.deprecated && !meta.specialty)) return xml;
  const json = JSON.stringify(meta);
  return xml.replace(new RegExp(`(<${rootTag}[^>]*>)`), `$1\n  <!-- creidhne:meta ${json} -->`);
}
