// The hybrasyl/xml commit that `npm run fetch-xsd` downloads (HTOO-615).
//
// This is the one place that names it. GitHub leaves pre-releases out of
// `releases/latest`, so following that gave Creidhne v0.9.7 long after xml
// `main` had the element registry, traits and species. A pin is a full commit
// SHA: `/zipball/<ref>` takes a tag, a branch or a SHA, but only a SHA cannot
// move under the pin.
//
// When you move the pin, run `npm run fetch-xsd`, then
// `node scripts/extractSimpleTypes.js`, and commit the new
// src/renderer/src/assets/json/simpleTypes.json in the same commit.
//
// xsd/ is gitignored, so two checkouts can hold different schemas and nothing
// shows it. fetch-xsd writes the ref it downloaded into xsd/, and
// src/main/__tests__/xsdValidator.js fails the XSD tests when that ref is not
// this pin.

const fs = require('fs')
const path = require('path')

const XSD_REF = '77432ae11f4879b69c6b5a511ab172d309069374'
const REF_FILE = '.xml-ref'

/**
 * Why the XSDs in `xsdRoot` are not the pinned ones, or null when they are.
 *
 * @param {string} xsdRoot - the xsd/ directory
 * @param {string} [pinned] - the ref to expect; the pin by default
 * @returns {string | null}
 */
function xsdRefProblem(xsdRoot, pinned = XSD_REF) {
  if (!fs.existsSync(xsdRoot)) {
    return `No XSDs at ${xsdRoot}. Run \`npm run fetch-xsd\` once after cloning.`
  }
  let found
  try {
    found = fs.readFileSync(path.join(xsdRoot, REF_FILE), 'utf8').trim()
  } catch {
    return (
      `${xsdRoot} has no ${REF_FILE}, so it was fetched before the XSDs were pinned. ` +
      'Run `npm run fetch-xsd`.'
    )
  }
  if (found !== pinned) {
    return (
      `${xsdRoot} holds xml ${found}, but scripts/xsdRef.cjs pins ${pinned}. ` +
      'Run `npm run fetch-xsd`.'
    )
  }
  return null
}

module.exports = { XSD_REF, REF_FILE, xsdRefProblem }
