// content_type: 'item_icons'
// Spec: Comhaigne docs/plans/hybrasyl.client/asset-pack-format.md#item_icons (planned)
//      docs/plans/hybrasyl.client/item-asset-pack-scoping.md (full Phase 1 design)
//
// Replaces legacy item###.epf sheets in legend.dat. The scoping doc fixes
// the filename schema as flat (item{id:D5}.png) so the eventual handler
// can be a one-liner via makeFlatPatternHandler({ contentType, subtypes: ['item'], padding: 5 }).
//
// Two reasons the handler is still a stub:
//   1. Item packs are multi-pack per content type (one .datf per sheet
//      range), and the registry today registers a single handler per
//      content_type. The loader needs a small extension to track multiple
//      packs of one type before items can be wired up.
//   2. The dye pipeline (manifest `covers.item_icons.no_dye` opt-out + the
//      runtime find-and-replace pass) lives outside the flat-handler
//      contract and needs its own integration with the renderer's
//      ItemSpriteCanvas / dye preview path that landed in commit 44e6a4d.

export default {
  contentType: 'item_icons',
  status: 'planned',
  subtypes: [],
  spec: 'item-asset-pack-scoping.md',
  parseEntry() {
    return null
  },
  keyFor() {
    return null
  }
}
