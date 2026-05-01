// content_type: 'display_sprites' (Creidhne-defined; not yet in Comhaigne)
//
// Will replace legacy khan{m|w}{ad,eh,im,ns,tz}.dat worn-equipment sprites
// (per-gender, per-letter-range archives covering Armor, Weapon, Shield,
// Coat, Helmet, etc. — see src/renderer/src/data/khanData.js).
//
// Open questions to resolve in a Comhaigne scoping pass before
// implementing:
//   1. Filename schema. The legacy entry layout is
//      {gender}{category}{id:D3}{pose}.epf with poses '01'..'03' and
//      'b'..'f'. A pack equivalent might be
//      {gender}{category}{id:D4}_{pose}.png. Multi-pose means this is
//      NOT a flat schema — each (gender, category, id) maps to several
//      pose PNGs.
//   2. Dye behavior. Display sprites use the same canonical-purple
//      ramp at palette indices 98-103 as items, so the runtime
//      find-and-replace pass from item-asset-pack-scoping.md applies
//      here too. Helmet (Hairstyle) sprites are dyed by HairColor
//      rather than item Color in legacy — see the helmet gate in
//      DisplaySpritePicker.jsx.
//   3. content_type discriminator name. 'display_sprites' is the
//      working title; Comhaigne may prefer 'equipment_sprites' or
//      'worn_sprites' — defer to whatever the format spec lands on.

export default {
  contentType: 'display_sprites',
  status: 'planned',
  subtypes: [],
  spec: 'TBD: needs Comhaigne scoping pass',
  parseEntry() {
    return null
  },
  keyFor() {
    return null
  }
}
