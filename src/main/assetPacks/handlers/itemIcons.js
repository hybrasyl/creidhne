// content_type: 'item_icons'
// Spec: docs/plans/hybrasyl.client/item-asset-pack-scoping.md (Phase 1)
//       Comhaigne docs/plans/hybrasyl.client/asset-pack-format.md (future-types entry)
//
// Replaces legacy item###.epf sheets in legend.dat. Filename schema is
// flat: item{id:D5}.png (5-digit zero-padded, 1-based item ID matching
// the renamed Unity-rip filenames). Subtype 'item' is exposed by
// listCoveredIds(); the renderer-side ItemSpriteCanvas wiring (pack-first
// lookup + RGB find-and-replace dye for the Phase 1 PNG path) is a
// separate concern handled in the renderer data layer.
//
// Multi-pack registration: the loader already iterates state.packs in
// priority order, so the four phase-1 chunked packs (items_001-005,
// items_006-010, items_011-041, items_042-061) coexist naturally — each
// resolveAsset('item', id) call walks every active pack and returns the
// first hit. No extra registry plumbing required.

import { makeFlatPatternHandler } from './flatPattern.js'

export default makeFlatPatternHandler({
  contentType: 'item_icons',
  subtypes: ['item'],
  padding: 5,
  spec: 'item-asset-pack-scoping.md'
})
