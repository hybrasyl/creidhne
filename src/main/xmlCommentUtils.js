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
