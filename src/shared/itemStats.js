// The one list of item stat-modifier keys (WP3).
//
// It existed TWICE before this: as a Set in src/main/itemXml.js, deciding which
// XML attributes count as stats, and as `{ key, label, type }` in
// src/renderer/src/data/itemConstants.js, driving the item editor's fields.
// Measured at the time: 69 keys each, identical, in the same order — two copies
// kept in step by luck. A report needs the same list a third time, and needs the
// labels, so the list moved here and both earlier consumers now read it.
//
// The drift this closes is silent. If the parser's set lost a key the editor
// still offered, the attribute would land in `unknownStatKeys`, which only the
// diagnostics panel reads: the value would disappear from a saved item and
// nothing would say so.
//
// `type` is the editor's field kind — 'formula' takes a number or an NCalc
// expression, 'element' takes an element name. A report renders either as text.

export const ITEM_STATS = [
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
  { key: 'Shield', label: 'Shield', type: 'formula' }
]

/** Just the keys, in order — what the XML parser needs. */
export const ITEM_STAT_KEYS = ITEM_STATS.map((s) => s.key)

const LABELS = new Map(ITEM_STATS.map((s) => [s.key, s.label]))

/** The editor's label for a stat key, or the key itself. */
export function itemStatLabel(key) {
  return LABELS.get(key) ?? key
}
