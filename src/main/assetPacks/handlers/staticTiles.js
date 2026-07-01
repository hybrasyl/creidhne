// content_type: 'static_tiles' (brigid's canonical name; see
// brigid Brigid.Data/AssetPacks/AssetPackRegistry.cs + StaticTilePack.cs)
//
// Replaces legacy floor (EPF) and wall (HPF) map tiles. Map tiles are
// Taliesin's domain (the map editor), NOT Creidhne's — Creidhne is a data
// editor with no tile-picker surface. We register the content_type as
// `out_of_scope` (same rationale as ui_sprite_overrides) so loading a
// static_tiles pack is a silent skip, not a misleading "unknown content_type"
// warning.

export default {
  contentType: 'static_tiles',
  status: 'out_of_scope',
  subtypes: [],
  spec: 'brigid StaticTilePack.cs — handled by Taliesin (map editor)',
  parseEntry() {
    return null
  },
  keyFor() {
    return null
  }
}
