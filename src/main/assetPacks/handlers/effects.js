// content_type: 'effects'
// Spec: Comhaigne docs/plans/hybrasyl.client/asset-pack-format.md#future-content-types (planned)
//
// Will replace legacy EFA spell/combat effect frames. Like creatures, this
// is a multi-frame schema with per-pack metadata (frame timings, blend
// mode, anchor) — the filename layout is expected to mirror the
// ui_sprite_overrides shape: {effectId}/{frame:D4}.png. Build a separate
// frame-pattern factory when this lands; do not extend flatPattern.

export default {
  contentType: 'effects',
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
