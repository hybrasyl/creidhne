export const ITEM_BODY_STYLES = ['', 'Transparent', 'Male', 'MaleBlack', 'MaleRed', 'Female'];

export const ITEM_COLORS = [
  '', 'None', 'Black', 'Red', 'Auburn', 'Butter', 'Aqua', 'Blue', 'Plum', 'Forest', 'Green',
  'Sienna', 'Brown', 'Charcoal', 'Navy', 'Acorn', 'White', 'Pink', 'Honeydew', 'Orange',
  'Platinum', 'Midnight', 'Orchid', 'Lavender', 'Fuschia', 'Cerise', 'Ocean', 'HotPink',
  'Seafoam', 'Amethyst', 'Peach', 'Sky', 'Lime', 'Jade', 'Honey', 'Cobalt', 'Cocoa', 'Wine',
  'Kelp', 'Wine2', 'Teal', 'Copper', 'Curry', 'Moss', 'Grass', 'Lapis', 'Maroon', 'TiNfOiL',
  'Aquamarine', 'Leaf', 'Purple', 'Scarlet', 'Lemon', 'Puce', 'Coral', 'Crimson', 'Gold',
  'Silver', 'Fire', 'Stormy', 'Cherry', 'Mint', 'Cerulean', 'Twilight', 'Quartz', 'Turquoise',
  'Peridot', 'Nebula', 'Bubblegum', 'Cyan', 'Sable', 'Mauve', 'Dusk',
];

export const ITEM_FLAGS = [
  'Bound', 'Depositable', 'Enchantable', 'Consecratable', 'Tailorable', 'Smithable',
  'Exchangeable', 'Vendorable', 'Perishable', 'UniqueInventory', 'MasterOnly',
  'UniqueEquipped', 'Identifiable', 'Undamageable', 'Consumable',
];

export const EQUIPMENT_SLOTS = [
  'None', 'Weapon', 'Armor', 'Shield', 'Helmet', 'Earring', 'Necklace',
  'LeftHand', 'RightHand', 'LeftArm', 'RightArm', 'Waist', 'Leg', 'Foot',
  'FirstAcc', 'Trousers', 'Coat', 'SecondAcc', 'ThirdAcc', 'Gauntlet', 'Ring',
];

export const WEAPON_TYPES = ['OneHand', 'TwoHand', 'Dagger', 'Staff', 'Claw', 'None'];

export const CLASS_TYPES = ['All', 'Peasant', 'Warrior', 'Rogue', 'Wizard', 'Priest', 'Monk'];

export const GENDERS = ['Neutral', 'Male', 'Female'];

export const ELEMENT_TYPES = [
  'None', 'Fire', 'Water', 'Wind', 'Earth', 'Light', 'Dark', 'Wood', 'Metal',
  'Undead', 'RandomTemuair', 'RandomExpanded', 'Necklace', 'Belt', 'Current',
];

export const ITEM_TAGS = [
  'Junk', 'Common', 'Reagent', 'Magic', 'Rare', 'Masterwork', 'Legendary', 'Artifact',
  'Religious', 'Social', 'Academic', 'Quest', 'Political', 'Currency', 'Peasantware',
  'Armor', 'Weapon', 'Contraption', 'Food', 'Tool', 'Adornment',
];

export const SLOT_RESTRICTION_TYPES = ['ItemRequired', 'ItemProhibited'];

export const PROC_EVENT_TYPES = ['OnUse', 'OnCast', 'OnHit', 'OnDeath', 'OnSpawn'];

export const ELEMENTAL_MODIFIER_TYPES = ['Augment', 'Resistance'];

// Each entry: key matches the XSD attribute name, label is display text,
// type is 'formula' (free text / number) or 'element' (ElementType dropdown)
export const STAT_MODIFIERS = [
  { key: 'BaseStr', label: 'Base Str', type: 'formula' },
  { key: 'BaseInt', label: 'Base Int', type: 'formula' },
  { key: 'BaseWis', label: 'Base Wis', type: 'formula' },
  { key: 'BaseCon', label: 'Base Con', type: 'formula' },
  { key: 'BaseDex', label: 'Base Dex', type: 'formula' },
  { key: 'BaseHp', label: 'Base HP', type: 'formula' },
  { key: 'BaseMp', label: 'Base MP', type: 'formula' },
  { key: 'CurrentHp', label: 'Current HP', type: 'formula' },
  { key: 'CurrentMp', label: 'Current MP', type: 'formula' },
  { key: 'CurrentGold', label: 'Current Gold', type: 'formula' },
  { key: 'CurrentXp', label: 'Current XP', type: 'formula' },
  { key: 'CurrentFaith', label: 'Current Faith', type: 'formula' },
  { key: 'BaseHit', label: 'Base Hit', type: 'formula' },
  { key: 'BaseDmg', label: 'Base Dmg', type: 'formula' },
  { key: 'BaseAc', label: 'Base AC', type: 'formula' },
  { key: 'BaseRegen', label: 'Base Regen', type: 'formula' },
  { key: 'BaseMr', label: 'Base MR', type: 'formula' },
  { key: 'BaseCrit', label: 'Base Crit', type: 'formula' },
  { key: 'BaseMagicCrit', label: 'Base Magic Crit', type: 'formula' },
  { key: 'BaseInboundDamageToMp', label: 'Base Inbound Dmg to MP', type: 'formula' },
  { key: 'BaseOffensiveElement', label: 'Base Offensive Element', type: 'element' },
  { key: 'BaseDefensiveElement', label: 'Base Defensive Element', type: 'element' },
  { key: 'BaseExtraFaith', label: 'Base Extra Faith', type: 'formula' },
  { key: 'OffensiveElementOverride', label: 'Offensive Element Override', type: 'element' },
  { key: 'DefensiveElementOverride', label: 'Defensive Element Override', type: 'element' },
  { key: 'BaseInboundDamageModifier', label: 'Base Inbound Dmg Modifier', type: 'formula' },
  { key: 'BaseOutboundDamageModifier', label: 'Base Outbound Dmg Modifier', type: 'formula' },
  { key: 'BaseInboundHealModifier', label: 'Base Inbound Heal Modifier', type: 'formula' },
  { key: 'BaseOutboundHealModifier', label: 'Base Outbound Heal Modifier', type: 'formula' },
  { key: 'DamageType', label: 'Damage Type', type: 'formula' },
  { key: 'BaseReflectMagical', label: 'Base Reflect Magical', type: 'formula' },
  { key: 'BaseReflectPhysical', label: 'Base Reflect Physical', type: 'formula' },
  { key: 'BaseExtraGold', label: 'Base Extra Gold', type: 'formula' },
  { key: 'BaseDodge', label: 'Base Dodge', type: 'formula' },
  { key: 'BaseMagicDodge', label: 'Base Magic Dodge', type: 'formula' },
  { key: 'BaseExtraXp', label: 'Base Extra XP', type: 'formula' },
  { key: 'BaseExtraItemFind', label: 'Base Extra Item Find', type: 'formula' },
  { key: 'BaseLifeSteal', label: 'Base Life Steal', type: 'formula' },
  { key: 'BaseManaSteal', label: 'Base Mana Steal', type: 'formula' },
  { key: 'BonusStr', label: 'Bonus Str', type: 'formula' },
  { key: 'BonusInt', label: 'Bonus Int', type: 'formula' },
  { key: 'BonusWis', label: 'Bonus Wis', type: 'formula' },
  { key: 'BonusCon', label: 'Bonus Con', type: 'formula' },
  { key: 'BonusDex', label: 'Bonus Dex', type: 'formula' },
  { key: 'BonusHp', label: 'Bonus HP', type: 'formula' },
  { key: 'BonusMp', label: 'Bonus MP', type: 'formula' },
  { key: 'BonusHit', label: 'Bonus Hit', type: 'formula' },
  { key: 'BonusDmg', label: 'Bonus Dmg', type: 'formula' },
  { key: 'BonusAc', label: 'Bonus AC', type: 'formula' },
  { key: 'BonusRegen', label: 'Bonus Regen', type: 'formula' },
  { key: 'BonusMr', label: 'Bonus MR', type: 'formula' },
  { key: 'BonusCrit', label: 'Bonus Crit', type: 'formula' },
  { key: 'BonusMagicCrit', label: 'Bonus Magic Crit', type: 'formula' },
  { key: 'BonusInboundDamageModifier', label: 'Bonus Inbound Dmg Modifier', type: 'formula' },
  { key: 'BonusOutboundDamageModifier', label: 'Bonus Outbound Dmg Modifier', type: 'formula' },
  { key: 'BonusInboundHealModifier', label: 'Bonus Inbound Heal Modifier', type: 'formula' },
  { key: 'BonusOutboundHealModifier', label: 'Bonus Outbound Heal Modifier', type: 'formula' },
  { key: 'BonusReflectMagical', label: 'Bonus Reflect Magical', type: 'formula' },
  { key: 'BonusReflectPhysical', label: 'Bonus Reflect Physical', type: 'formula' },
  { key: 'BonusExtraGold', label: 'Bonus Extra Gold', type: 'formula' },
  { key: 'BonusDodge', label: 'Bonus Dodge', type: 'formula' },
  { key: 'BonusMagicDodge', label: 'Bonus Magic Dodge', type: 'formula' },
  { key: 'BonusExtraXp', label: 'Bonus Extra XP', type: 'formula' },
  { key: 'BonusExtraItemFind', label: 'Bonus Extra Item Find', type: 'formula' },
  { key: 'BonusLifeSteal', label: 'Bonus Life Steal', type: 'formula' },
  { key: 'BonusManaSteal', label: 'Bonus Mana Steal', type: 'formula' },
  { key: 'BonusInboundDamageToMp', label: 'Bonus Inbound Dmg to MP', type: 'formula' },
  { key: 'BonusExtraFaith', label: 'Bonus Extra Faith', type: 'formula' },
  { key: 'Shield', label: 'Shield', type: 'formula' },
];

const SLOT_PREFIX_MAP = {
  Weapon: 'weapon', Armor: 'armor', Shield: 'shield', Helmet: 'helm',
  Earring: 'earring', Necklace: 'necklace', LeftHand: 'ring', RightHand: 'ring',
  LeftArm: 'gauntlet', RightArm: 'gauntlet', Waist: 'belt', Leg: 'greaves',
  Foot: 'boots', FirstAcc: 'accessory', Trousers: 'vanityarmor', Coat: 'vanityhelm',
  SecondAcc: 'tool', ThirdAcc: 'accessory', Gauntlet: 'gauntlet', Ring: 'ring',
};

export function deriveItemPrefix(equipSlot, vendorTab) {
  const slot = equipSlot && equipSlot !== 'None' ? equipSlot : '';
  const vnd = vendorTab || '';
  if (vnd === '1Test') return '1test';
  if (slot && SLOT_PREFIX_MAP[slot]) return SLOT_PREFIX_MAP[slot];
  if (!slot && vnd) return vnd.toLowerCase().replace(/ /g, '-');
  return 'item';
}

export function computeItemFilename(itemName, equipSlot, vendorTab) {
  const prefix = deriveItemPrefix(equipSlot, vendorTab);
  const safeName = (itemName || '')
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/'/g, '');
  if (!safeName) return '';
  return prefix + '_' + safeName + '.xml';
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
      hideBoots: false,
    },
    stackable: { max: 1 },
    physical: { value: 1, weight: 1, durability: 1 },
    categories: [],
    equipment: null,
    statModifiers: {
      rows: [],
      elementalModifiers: [],
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
      slotRestrictions: [],
    },
    motions: [],
    castModifiers: [],
    procs: [],
  },
};
