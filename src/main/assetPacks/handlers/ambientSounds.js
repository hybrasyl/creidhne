// content_type: 'ambient_sounds' (Brigid's ambience pack, BRIG-16; see
// the content-type table in asset-pack-format.md, in the document repo).
//
// Ambience is a property of a map, like background music (see music.js), so it
// is chosen and previewed in Taliesin. Creidhne's XML editors name sound
// effects only (sounds.js). An ambience pack is therefore a silent skip, not an
// "unknown content_type" warning.

export default {
  contentType: 'ambient_sounds',
  status: 'out_of_scope',
  subtypes: [],
  spec: 'asset-pack-format.md content-type table: per-map ambience, handled by Taliesin',
  parseEntry() {
    return null
  },
  keyFor() {
    return null
  }
}
