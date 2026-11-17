// content_type: 'ui_theme' (Brigid's theme pack; see asset-pack-format.md in
// the document repo, and brigid Brigid.Data/AssetPacks/AssetPackRegistry.cs).
//
// A theme pack holds the art of the client's own windows and controls: frames,
// buttons, tabs, scroll bars, fonts. Nothing in world data names a theme part,
// so Creidhne has no field or picker to show one in. A theme pack is therefore
// a silent skip, not an "unknown content_type" warning.

export default {
  contentType: 'ui_theme',
  status: 'out_of_scope',
  subtypes: [],
  spec: 'asset-pack-format.md#ui_theme: client UI art, no world-data field',
  parseEntry() {
    return null
  },
  keyFor() {
    return null
  }
}
