// One canonical, flat, presentation-ready record per item (WP3).
//
// The castable equivalent of this is castableRecord.js, and the shape is
// deliberately the same: a flat object, one derivation written once, and a
// `CASTABLE_COLUMNS`-style catalogue the report builder's picker reads.
//
// Electron-free on purpose. The renderer needs the derivations and the catalogue
// for its live preview, and the disk access lives in src/main/reportRun.js.
//
// `ctx` carries the two things the item XML cannot say, both already in the world
// index: `itemVendors` (which NPCs sell it) and `itemLootSets` (which loot sets
// contain it). That is the same arrangement as the castable record's
// `castableTrainers`, and it is why items needed no new hybindex field.

import { ITEM_STATS } from './itemStats.js'

/** Not a slot: the value the schema uses for "this is not equipment". */
export const NO_SLOT = 'None'

const text = (v) => (v == null ? '' : String(v))
const list = (arr) => (Array.isArray(arr) ? arr.filter(Boolean).join(', ') : '')

/**
 * The NPCs that sell this item, and the loot sets that contain it, from the world
 * index. Keyed by lowercased item name, as the castable trainer lookup is.
 *
 * One lookup each, used by both the display column and the boolean a rule
 * filters on. A rule must not test the display string: an empty string and "no
 * vendor" would be the same value, and a filter that matched nothing would still
 * produce a report that looks valid.
 */
export function deriveVendors(name, ctx = {}) {
  return ctx.itemVendors?.[String(name || '').toLowerCase()] || []
}

export function deriveLootSets(name, ctx = {}) {
  return ctx.itemLootSets?.[String(name || '').toLowerCase()] || []
}

/** Equipment is anything with a slot other than `None`. */
export function isEquipment(slot) {
  const s = text(slot)
  return s !== '' && s !== NO_SLOT
}

/**
 * A weapon is equipment with a weapon type. Decided once here rather than in a
 * rule, so a report and the builder's preview cannot disagree about it.
 */
export function isWeapon(weaponType) {
  const t = text(weaponType)
  return t !== '' && t !== NO_SLOT
}

/** Builds the canonical record. `ctx` carries the index lookups. */
export function itemToRecord(item, ctx = {}) {
  const props = item.properties || {}
  const appearance = props.appearance || {}
  const physical = props.physical || {}
  const equipment = props.equipment || {}
  const damage = props.damage || {}
  const vendor = props.vendor || {}
  const use = props.use || {}
  const restrictions = props.restrictions || {}
  const cats = (props.categories || []).map((c) => c?.name ?? '')

  const vendors = deriveVendors(item.name, ctx)
  const lootSets = deriveLootSets(item.name, ctx)

  // The stat modifiers arrive as `{ key, value }` rows, so a report column reads
  // from a map rather than searching the array once per column.
  const statValues = new Map((props.statModifiers?.rows || []).map((r) => [r.key, r.value]))
  const stats = Object.fromEntries(
    ITEM_STATS.map((s) => [`stat${s.key}`, text(statValues.get(s.key))])
  )

  return {
    // Identity
    name: text(item.name),
    unidentifiedName: text(item.unidentifiedName),
    comment: text(item.comment),
    includeInMetafile: item.includeInMetafile !== false,
    tags: list(props.tags),
    flags: list(props.flags),

    // Appearance
    sprite: text(appearance.sprite),
    equipSprite: text(appearance.equipSprite),
    displaySprite: text(appearance.displaySprite),
    bodyStyle: text(appearance.bodyStyle),
    color: text(appearance.color),
    hideBoots: appearance.hideBoots === true,

    // Physical
    value: text(physical.value),
    weight: text(physical.weight),
    durability: text(physical.durability),
    stackMax: text(props.stackable?.max),

    // Equipment
    slot: text(equipment.slot),
    weaponType: text(equipment.weaponType),
    isEquipment: isEquipment(equipment.slot),
    isWeapon: isWeapon(equipment.weaponType),

    // Damage
    smallMin: text(damage.smallMin),
    smallMax: text(damage.smallMax),
    largeMin: text(damage.largeMin),
    largeMax: text(damage.largeMax),
    hasDamage: !!props.damage,

    // Vendor and loot, from the index
    shopTab: text(vendor.shopTab),
    vendorDescription: text(vendor.description),
    vendors: vendors.join(', '),
    hasVendor: vendors.length > 0,
    lootSets: lootSets.join(', '),
    hasLootSet: lootSets.length > 0,

    // Restrictions
    levelMin: text(restrictions.level?.min),
    levelMax: text(restrictions.level?.max),
    abMin: text(restrictions.ab?.min),
    abMax: text(restrictions.ab?.max),
    class: text(restrictions.class),
    gender: text(restrictions.gender),
    castables: list(restrictions.castables),

    // Categories, flattened to six as the castable record does
    category1: cats[0] ?? '',
    category2: cats[1] ?? '',
    category3: cats[2] ?? '',
    category4: cats[3] ?? '',
    category5: cats[4] ?? '',
    category6: cats[5] ?? '',

    // Use
    useScript: text(use.script),
    useEffectId: text(use.effect?.id),
    useSoundId: text(use.sound?.id),
    teleportMap: text(use.teleport?.map),

    ...stats
  }
}

/**
 * Every flat field an item report can select, with a label and a grouping.
 *
 * The stat columns are generated from `ITEM_STATS` rather than written out, so the
 * catalogue cannot fall behind the record — a test asserts the two stay in step,
 * exactly as the castable catalogue's does.
 */
export const ITEM_COLUMNS = [
  { key: 'name', label: 'Name', group: 'Identity' },
  { key: 'unidentifiedName', label: 'Unidentified name', group: 'Identity' },
  { key: 'comment', label: 'Comment', group: 'Identity' },
  { key: 'includeInMetafile', label: 'In metafile', group: 'Identity' },
  { key: 'tags', label: 'Tags', group: 'Identity' },
  { key: 'flags', label: 'Flags', group: 'Identity' },

  { key: 'sprite', label: 'Sprite', group: 'Appearance' },
  { key: 'equipSprite', label: 'Equip sprite', group: 'Appearance' },
  { key: 'displaySprite', label: 'Display sprite', group: 'Appearance' },
  { key: 'bodyStyle', label: 'Body style', group: 'Appearance' },
  { key: 'color', label: 'Colour', group: 'Appearance' },
  { key: 'hideBoots', label: 'Hides boots', group: 'Appearance' },

  { key: 'value', label: 'Value', group: 'Physical' },
  { key: 'weight', label: 'Weight', group: 'Physical' },
  { key: 'durability', label: 'Durability', group: 'Physical' },
  { key: 'stackMax', label: 'Stack max', group: 'Physical' },

  { key: 'slot', label: 'Slot', group: 'Equipment' },
  { key: 'weaponType', label: 'Weapon type', group: 'Equipment' },
  { key: 'isEquipment', label: 'Is equipment', group: 'Equipment' },
  { key: 'isWeapon', label: 'Is a weapon', group: 'Equipment' },

  { key: 'smallMin', label: 'Small damage min', group: 'Damage' },
  { key: 'smallMax', label: 'Small damage max', group: 'Damage' },
  { key: 'largeMin', label: 'Large damage min', group: 'Damage' },
  { key: 'largeMax', label: 'Large damage max', group: 'Damage' },
  { key: 'hasDamage', label: 'Has damage', group: 'Damage' },

  { key: 'shopTab', label: 'Shop tab', group: 'Vendor' },
  { key: 'vendorDescription', label: 'Vendor description', group: 'Vendor' },
  { key: 'vendors', label: 'Sold by', group: 'Vendor' },
  { key: 'hasVendor', label: 'Has a vendor', group: 'Vendor' },
  { key: 'lootSets', label: 'Loot sets', group: 'Loot' },
  { key: 'hasLootSet', label: 'In a loot set', group: 'Loot' },

  { key: 'levelMin', label: 'Level min', group: 'Restrictions' },
  { key: 'levelMax', label: 'Level max', group: 'Restrictions' },
  { key: 'abMin', label: 'Ab min', group: 'Restrictions' },
  { key: 'abMax', label: 'Ab max', group: 'Restrictions' },
  { key: 'class', label: 'Class', group: 'Restrictions' },
  { key: 'gender', label: 'Gender', group: 'Restrictions' },
  { key: 'castables', label: 'Castables granted', group: 'Restrictions' },

  { key: 'category1', label: 'Category 1', group: 'Categories' },
  { key: 'category2', label: 'Category 2', group: 'Categories' },
  { key: 'category3', label: 'Category 3', group: 'Categories' },
  { key: 'category4', label: 'Category 4', group: 'Categories' },
  { key: 'category5', label: 'Category 5', group: 'Categories' },
  { key: 'category6', label: 'Category 6', group: 'Categories' },

  { key: 'useScript', label: 'Use script', group: 'Use' },
  { key: 'useEffectId', label: 'Use effect id', group: 'Use' },
  { key: 'useSoundId', label: 'Use sound id', group: 'Use' },
  { key: 'teleportMap', label: 'Teleport map', group: 'Use' },

  ...ITEM_STATS.map((s) => ({ key: `stat${s.key}`, label: s.label, group: 'Stats' }))
]
