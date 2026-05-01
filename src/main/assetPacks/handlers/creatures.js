// content_type: 'creatures'
// Spec: Comhaigne docs/plans/hybrasyl.client/asset-pack-format.md#future-content-types (planned)
//
// Will replace legacy MPF creature/NPC sprites. Per the future-types table
// in the format spec, creature packs ship multi-frame animations (walk,
// standing, attack) — meaning the filename schema is compound (id + frame
// or id + animation tag), NOT the flat schema used by ability_icons.
//
// When this lands, build a new handler factory (handlers/framePattern.js
// or similar) for the {id}/{frame:D4}.png shape, plus per-pack metadata
// for animation tags and anchor points. Don't shoehorn it into
// flatPattern — the entry-cache key needs to encode (creatureId, frame)
// not just (subtype, id).

export default {
  contentType: 'creatures',
  status: 'planned',
  subtypes: [],
  spec: 'asset-pack-format.md#future-content-types',
  parseEntry() {
    return null
  },
  keyFor() {
    return null
  }
}
