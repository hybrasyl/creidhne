// Item vocabularies both processes need (WP3).
//
// `EQUIPMENT_SLOTS` and `WEAPON_TYPES` were literals in
// src/renderer/src/data/itemConstants.js, where the item editor's selects read
// them. The item report's Slot and Weapon type rules need the same value lists,
// and src/shared cannot import from the renderer — so they moved here and
// itemConstants.js re-exports them under their established names.
//
// This is the same move ITEM_STATS made, for the same reason: a second copy of a
// value list drifts, and a rule offering a value the editor cannot produce fails
// as an empty report rather than as an error.

export const EQUIPMENT_SLOTS = [
  'None',
  'Weapon',
  'Armor',
  'Shield',
  'Helmet',
  'Earring',
  'Necklace',
  'LeftHand',
  'RightHand',
  'LeftArm',
  'RightArm',
  'Waist',
  'Leg',
  'Foot',
  'FirstAcc',
  'Trousers',
  'Coat',
  'SecondAcc',
  'ThirdAcc',
  'Gauntlet',
  'Ring'
]

export const WEAPON_TYPES = ['OneHand', 'TwoHand', 'Dagger', 'Staff', 'Claw', 'None']
