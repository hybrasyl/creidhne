// content_type: 'ui_sprite_overrides'
// Spec: Comhaigne docs/plans/hybrasyl.client/asset-pack-format.md#ui_sprite_overrides
//
// This is a *valid* Comhaigne content type — it covers per-frame overrides
// for arbitrary EPF/SPF files inside setoa.dat (buttons, dialog frames,
// chat panel backgrounds, scroll arrows, etc.). The hybrasyl.client uses
// it to ship modern UI replacements.
//
// Creidhne is a content editor, not a runtime UI surface — it doesn't
// render in-game buttons or chat panels — so consuming these packs would
// add load time without any editor benefit. We register the content_type
// as `out_of_scope` so:
//
//   1. Loading a ui_sprite_overrides pack is silent (no "unknown
//      content_type" warning that would mislead users into thinking
//      their pack is broken).
//   2. The intent is documented here, not buried in an exclusion list.
//
// If a future Creidhne feature needs UI sprite previews (e.g. previewing
// custom dialog frames in a theme editor), promote this to status:
// 'implemented' with a folder-pattern handler (the schema is
// `{filename.ext}/{frame:D4}.png` per the format spec, NOT flat).

export default {
  contentType: 'ui_sprite_overrides',
  status: 'out_of_scope',
  subtypes: [],
  spec: 'asset-pack-format.md#content-type-ui_sprite_overrides',
  parseEntry() {
    return null
  },
  keyFor() {
    return null
  }
}
