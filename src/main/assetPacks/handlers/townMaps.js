// content_type: 'town_maps' (brigid's canonical name; see brigid
// Brigid.Data/AssetPacks/AssetPackRegistry.GetTownMapPack + TownMapPack.cs,
// spec: Comhaigne docs/plans/hybrasyl.client/asset-pack-format.md#town_maps)
//
// Town-map packs override the client's T-key town-map popup — a single
// pre-composited `town_{mapId:D5}.png` per numeric map id, replacing the
// legacy five-layer national.dat composite. Distinct from `world_maps` (the
// server-driven overworld field map).
//
// This is a runtime client-UI surface, not Creidhne content: Creidhne edits
// world XML, it doesn't render the in-game T-key popup. Like world_maps
// (Taliesin/map-editor domain) and ui_sprite_overrides (runtime UI), we
// register the content_type as `out_of_scope` so loading a town_maps pack is
// a silent skip rather than a misleading "unknown content_type" warning.

export default {
  contentType: 'town_maps',
  status: 'out_of_scope',
  subtypes: [],
  spec: 'asset-pack-format.md#content-type-town_maps — runtime client UI (T-key town map)',
  parseEntry() {
    return null
  },
  keyFor() {
    return null
  }
}
