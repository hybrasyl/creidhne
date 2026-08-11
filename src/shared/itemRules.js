// The item report filter vocabulary (WP3).
//
// Ten logical fields over WP2's eight operators. A rule's `field` is a logical
// name rather than a record key, as it is for castables: `category` reads all six
// category fields, and `value` compares numerically on a string the XML stores as
// text.
//
// The booleans read derived record fields — `isEquipment`, `isWeapon`, `hasVendor`,
// `hasLootSet` — never a display string. `vendors` is an empty string both for an
// item nobody sells and for one whose vendor list failed to load, so a rule
// reading it could match nothing and still produce a report that looks valid.

import { EQUIPMENT_SLOTS, WEAPON_TYPES } from './itemVocabulary.js'

export const ITEM_FILTER_FIELDS = [
  {
    field: 'name',
    label: 'Name',
    kind: 'text',
    ops: ['contains'],
    read: (record) => record.name ?? ''
  },
  {
    field: 'slot',
    label: 'Slot',
    kind: 'enum',
    ops: ['is', 'isNot'],
    values: EQUIPMENT_SLOTS,
    read: (record) => record.slot ?? ''
  },
  {
    field: 'weaponType',
    label: 'Weapon type',
    kind: 'enum',
    ops: ['is', 'isNot'],
    values: WEAPON_TYPES,
    read: (record) => record.weaponType ?? ''
  },
  {
    field: 'isEquipment',
    label: 'Is equipment',
    kind: 'boolean',
    ops: ['is'],
    read: (record) => record.isEquipment === true
  },
  {
    field: 'isWeapon',
    label: 'Is a weapon',
    kind: 'boolean',
    ops: ['is'],
    read: (record) => record.isWeapon === true
  },
  {
    field: 'hasVendor',
    label: 'Has a vendor',
    kind: 'boolean',
    ops: ['is'],
    read: (record) => record.hasVendor === true
  },
  {
    field: 'hasLootSet',
    label: 'In a loot set',
    kind: 'boolean',
    ops: ['is'],
    read: (record) => record.hasLootSet === true
  },
  {
    field: 'shopTab',
    label: 'Shop tab',
    kind: 'text',
    ops: ['is', 'isNot', 'contains'],
    read: (record) => record.shopTab ?? ''
  },
  {
    field: 'category',
    label: 'Category',
    kind: 'text',
    ops: ['has', 'hasNot'],
    read: (record) =>
      [1, 2, 3, 4, 5, 6]
        .map((n) => record[`category${n}`])
        .filter(Boolean)
        .map((c) => String(c).toLowerCase())
  },
  {
    field: 'value',
    label: 'Value',
    kind: 'number',
    ops: ['atLeast', 'atMost', 'between'],
    // Blank is not zero. `Number('')` is 0, which would put an item with no stated
    // value inside every at-most range.
    read: (record) => numberOrNaN(record.value)
  },
  {
    field: 'levelMin',
    label: 'Level required',
    kind: 'number',
    ops: ['atLeast', 'atMost', 'between'],
    // An item with no level restriction has a blank `levelMin`, which must not
    // read as level 0 and match "at most 5".
    read: (record) => numberOrNaN(record.levelMin)
  }
]

function numberOrNaN(raw) {
  return raw === '' || raw == null ? NaN : Number(raw)
}
