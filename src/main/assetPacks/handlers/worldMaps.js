// content_type: 'world_maps' (brigid's canonical name; see
// brigid Brigid.Data/AssetPacks/AssetPackRegistry.cs + WorldMapPack.cs)
//
// Replaces legacy overworld field backgrounds ({field}.epf + .pal from
// setoa.dat). Overworld/world maps are Taliesin's domain (the map editor),
// NOT Creidhne's. We register the content_type as `out_of_scope` (same
// rationale as ui_sprite_overrides / static_tiles) so loading a world_maps
// pack is a silent skip rather than a misleading "unknown content_type"
// warning.

export default {
  contentType: 'world_maps',
  status: 'out_of_scope',
  subtypes: [],
  spec: 'brigid WorldMapPack.cs — handled by Taliesin (map editor)',
  parseEntry() {
    return null
  },
  keyFor() {
    return null
  }
}
