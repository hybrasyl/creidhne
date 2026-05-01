// content_type: 'ability_icons'
// Spec: Comhaigne docs/plans/hybrasyl.client/asset-pack-format.md#ability_icons
//
// Replaces legacy skill001.epf and spell001.epf icons. Subtypes 'skill' and
// 'spell' are exposed by listCoveredIds() and used by IconCanvas (renderer).

import { makeFlatPatternHandler } from './flatPattern.js'

export default makeFlatPatternHandler({
  contentType: 'ability_icons',
  subtypes: ['skill', 'spell'],
  padding: 4,
  spec: 'asset-pack-format.md#content-type-ability_icons'
})
