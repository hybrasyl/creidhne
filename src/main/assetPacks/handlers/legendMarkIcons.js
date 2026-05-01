// content_type: 'legend_mark_icons'
// Spec: Comhaigne docs/plans/hybrasyl.client/asset-pack-format.md#legend_mark_icons
//
// Replaces legacy legends.epf frames (palette 3 of national.dat). Subtype
// 'legend' is exposed by listCoveredIds(). Note that legend mark icon IDs
// are 0-based on the wire (legend0000.png replaces EPF frame 0), unlike
// the 1-based ability/nation conventions — but that detail is purely
// semantic; the flat handler stores whatever id appears in the filename.

import { makeFlatPatternHandler } from './flatPattern.js'

export default makeFlatPatternHandler({
  contentType: 'legend_mark_icons',
  subtypes: ['legend'],
  padding: 4,
  spec: 'asset-pack-format.md#content-type-legend_mark_icons'
})
