// content_type: 'nation_badges'
// Spec: asset-pack-format.md (document repo), nation_badges
//
// Replaces legacy _nui_nat.spf frames. Subtype 'nation' is consumed by
// NationCrestCanvas (renderer).

import { makeFlatPatternHandler } from './flatPattern.js'

export default makeFlatPatternHandler({
  contentType: 'nation_badges',
  subtypes: ['nation'],
  padding: 4,
  spec: 'asset-pack-format.md#content-type-nation_badges'
})
