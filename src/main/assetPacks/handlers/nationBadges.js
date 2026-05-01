// content_type: 'nation_badges'
// Spec: Comhaigne docs/plans/hybrasyl.client/asset-pack-format.md#nation_badges
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
