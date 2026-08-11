import { ITEM_STATS } from '@shared/itemStats.js'

export const ITEM_BODY_STYLES = ['', 'Transparent', 'Male', 'MaleBlack', 'MaleRed', 'Female']

export const ITEM_COLORS = [
  '',
  'None',
  'Black',
  'Red',
  'Auburn',
  'Butter',
  'Aqua',
  'Blue',
  'Plum',
  'Forest',
  'Green',
  'Sienna',
  'Brown',
  'Charcoal',
  'Navy',
  'Acorn',
  'White',
  'Pink',
  'Honeydew',
  'Orange',
  'Platinum',
  'Midnight',
  'Orchid',
  'Lavender',
  'Fuschia',
  'Cerise',
  'Ocean',
  'HotPink',
  'Seafoam',
  'Amethyst',
  'Peach',
  'Sky',
  'Lime',
  'Jade',
  'Honey',
  'Cobalt',
  'Cocoa',
  'Wine',
  'Kelp',
  'Wine2',
  'Teal',
  'Copper',
  'Curry',
  'Moss',
  'Grass',
  'Lapis',
  'Maroon',
  'TiNfOiL',
  'Aquamarine',
  'Leaf',
  'Purple',
  'Scarlet',
  'Lemon',
  'Puce',
  'Coral',
  'Crimson',
  'Gold',
  'Silver',
  'Fire',
  'Stormy',
  'Cherry',
  'Mint',
  'Cerulean',
  'Twilight',
  'Quartz',
  'Turquoise',
  'Peridot',
  'Nebula',
  'Bubblegum',
  'Cyan',
  'Sable',
  'Mauve',
  'Dusk'
]

export const ITEM_FLAGS = [
  'Bound',
  'Depositable',
  'Enchantable',
  'Consecratable',
  'Tailorable',
  'Smithable',
  'Exchangeable',
  'Vendorable',
  'Perishable',
  'UniqueInventory',
  'MasterOnly',
  'UniqueEquipped',
  'Identifiable',
  'Undamageable',
  'Consumable'
]

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

export const CLASS_TYPES = ['All', 'Peasant', 'Warrior', 'Rogue', 'Wizard', 'Priest', 'Monk']

export const GENDERS = ['Neutral', 'Male', 'Female']

export const ELEMENT_TYPES = [
  'None',
  'Fire',
  'Water',
  'Wind',
  'Earth',
  'Light',
  'Dark',
  'Wood',
  'Metal',
  'Undead',
  'RandomTemuair',
  'RandomExpanded',
  'Necklace',
  'Belt',
  'Current'
]

export const ITEM_TAGS = [
  'Junk',
  'Common',
  'Reagent',
  'Magic',
  'Rare',
  'Masterwork',
  'Legendary',
  'Artifact',
  'Religious',
  'Social',
  'Academic',
  'Quest',
  'Political',
  'Currency',
  'Peasantware',
  'Armor',
  'Weapon',
  'Contraption',
  'Food',
  'Tool',
  'Adornment'
]

export const SLOT_RESTRICTION_TYPES = ['ItemRequired', 'ItemProhibited']

export const PROC_EVENT_TYPES = ['OnUse', 'OnCast', 'OnHit', 'OnDeath', 'OnSpawn']

export const ELEMENTAL_MODIFIER_TYPES = ['Augment', 'Resistance']

// Each entry: key matches the XSD attribute name, label is display text,
// type is 'formula' (free text / number) or 'element' (ElementType dropdown)
// The editor's stat-modifier fields, from the ONE list in src/shared/itemStats.js
// (WP3). This was a 69-entry literal here and an identical Set in
// src/main/itemXml.js. Re-exported under its established name so every consumer
// in the item editor is unchanged.
export const STAT_MODIFIERS = ITEM_STATS

const SLOT_PREFIX_MAP = {
  Weapon: 'weapon',
  Armor: 'armor',
  Shield: 'shield',
  Helmet: 'helm',
  Earring: 'earring',
  Necklace: 'necklace',
  LeftHand: 'ring',
  RightHand: 'ring',
  LeftArm: 'gauntlet',
  RightArm: 'gauntlet',
  Waist: 'belt',
  Leg: 'greaves',
  Foot: 'boots',
  FirstAcc: 'accessory',
  Trousers: 'vanityarmor',
  Coat: 'vanityhelm',
  SecondAcc: 'tool',
  ThirdAcc: 'accessory',
  Gauntlet: 'gauntlet',
  Ring: 'ring'
}

export function deriveItemPrefix(equipSlot, vendorTab) {
  const slot = equipSlot && equipSlot !== 'None' ? equipSlot : ''
  const vnd = vendorTab || ''
  if (vnd === '1Test') return '1test'
  if (slot && SLOT_PREFIX_MAP[slot]) return SLOT_PREFIX_MAP[slot]
  if (!slot && vnd) return vnd.toLowerCase().replace(/ /g, '-')
  return 'item'
}

export function computeItemFilename(itemName, equipSlot, vendorTab) {
  const prefix = deriveItemPrefix(equipSlot, vendorTab)
  const safeName = (itemName || '').toLowerCase().replace(/ /g, '-').replace(/'/g, '')
  if (!safeName) return ''
  return prefix + '_' + safeName + '.xml'
}

export const DEFAULT_ITEM = {
  name: '',
  unidentifiedName: '',
  comment: '',
  includeInMetafile: true,
  properties: {
    tags: [],
    appearance: {
      sprite: '',
      equipSprite: '',
      displaySprite: '',
      bodyStyle: '',
      color: '',
      hideBoots: false
    },
    stackable: { max: 1 },
    physical: { value: 1, weight: 1, durability: 1 },
    categories: [],
    equipment: null,
    statModifiers: {
      rows: [],
      elementalModifiers: []
    },
    flags: [],
    variants: { names: [], groups: [] },
    vendor: { shopTab: '', description: '' },
    damage: null,
    use: null, // when enabled: { script, teleport, effect, sound, statuses: { add: [], remove: [] } }
    restrictions: {
      level: { min: '', max: '' },
      ab: null,
      class: '',
      gender: 'Neutral',
      castables: [],
      slotRestrictions: []
    },
    motions: [],
    castModifiers: [],
    procs: []
  }
}
