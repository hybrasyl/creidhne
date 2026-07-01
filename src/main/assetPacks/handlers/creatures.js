// content_type: 'creature_sprites' (brigid's canonical name; see
// brigid Brigid.Data/AssetPacks/AssetPackRegistry.cs + CreaturePack.cs)
//
// Replaces legacy MPF creature/NPC sprites. Brigid ships a directory-
// structured, directional frame layout: creature_{id:D5}/stand/n_001.png,
// e_001.png (engine flips N→W and E→S). This is a compound key
// (creatureId + direction + frame), NOT the flat schema used by
// ability_icons.
//
// When this lands, build a new handler factory (handlers/framePattern.js
// or similar) for the directory layout, plus per-pack metadata for
// direction pairs and auto-trim bounds. Don't shoehorn it into
// flatPattern — the entry-cache key needs to encode (creatureId, dir, frame)
// not just (subtype, id).

export default {
  contentType: 'creature_sprites',
  status: 'planned',
  subtypes: [],
  spec: 'brigid CreaturePack.cs (directory-structured directional frames)',
  parseEntry() {
    return null
  },
  keyFor() {
    return null
  }
}
