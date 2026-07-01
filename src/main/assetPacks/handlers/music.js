// content_type: 'music' (brigid's canonical name; see
// brigid Brigid.Data/AssetPacks/AssetPackRegistry.cs + MusicPack.cs)
//
// Replaces legacy loose {DataPath}/music/{id}.mus background tracks. In Dark
// Ages, background music is a per-MAP property — it is selected and previewed
// in the map editor (Taliesin), not in Creidhne. Creidhne's XML editors
// reference sound EFFECTS (see handlers/sounds.js), never background music, so
// there is no music picker or field to attach a `music` pack to.
//
// We therefore register the content_type as `out_of_scope` (same rationale as
// world_maps / static_tiles, which are likewise map-editor concerns): loading
// a music pack is a silent skip, not a misleading "unknown content_type" or
// "not yet implemented" warning.

export default {
  contentType: 'music',
  status: 'out_of_scope',
  subtypes: [],
  spec: 'brigid MusicPack.cs — per-map property, handled by Taliesin',
  parseEntry() {
    return null
  },
  keyFor() {
    return null
  }
}
