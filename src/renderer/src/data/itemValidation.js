import {
  ITEM_FLAGS,
  ITEM_TAGS,
  ITEM_BODY_STYLES,
  ITEM_COLORS,
  EQUIPMENT_SLOTS,
  GENDERS,
  CLASS_TYPES
} from './itemConstants'

const VALID_FLAGS = new Set(ITEM_FLAGS)
const VALID_TAGS = new Set(ITEM_TAGS)
const VALID_BODY_STYLES = new Set(ITEM_BODY_STYLES)
const VALID_COLORS = new Set(ITEM_COLORS)
const VALID_SLOTS = new Set(EQUIPMENT_SLOTS)
const VALID_GENDERS = new Set(GENDERS)
// CLASS_TYPES includes 'All'; individual XML class tokens are all except 'All'
const VALID_CLASSES = new Set(CLASS_TYPES.filter((c) => c !== 'All'))

export function validateItem(item) {
  const warnings = []
  const p = item?.properties
  if (!p) return warnings

  // Unknown stat modifier keys from parse phase
  const unknownStatKeys = item._diagnostics?.unknownStatKeys ?? []
  if (unknownStatKeys.length > 0) {
    warnings.push(`Unknown StatModifier attributes: ${unknownStatKeys.join(', ')}`)
  }

  // Flags
  const unknownFlags = (p.flags ?? []).filter((f) => !VALID_FLAGS.has(f))
  if (unknownFlags.length > 0) {
    warnings.push(`Unknown flags: ${unknownFlags.join(', ')}`)
  }

  // Tags
  const unknownTags = (p.tags ?? []).filter((t) => !VALID_TAGS.has(t))
  if (unknownTags.length > 0) {
    warnings.push(`Unknown tags: ${unknownTags.join(', ')}`)
  }

  // Appearance
  const app = p.appearance
  if (app) {
    if (app.bodyStyle && !VALID_BODY_STYLES.has(app.bodyStyle)) {
      warnings.push(`Unknown body style: "${app.bodyStyle}"`)
    }
    if (app.color && !VALID_COLORS.has(app.color)) {
      warnings.push(`Unknown color: "${app.color}"`)
    }
  }

  // Equipment slot
  const equip = p.equipment
  if (equip?.slot && !VALID_SLOTS.has(equip.slot)) {
    warnings.push(`Unknown equipment slot: "${equip.slot}"`)
  }

  // Restrictions
  const r = p.restrictions
  if (r) {
    if (r.gender && !VALID_GENDERS.has(r.gender)) {
      warnings.push(`Unknown gender restriction: "${r.gender}"`)
    }
    if (r.class && r.class !== 'All') {
      const tokens = r.class.split(' ').filter(Boolean)
      const unknownClasses = tokens.filter((c) => !VALID_CLASSES.has(c))
      if (unknownClasses.length > 0) {
        warnings.push(`Unknown class restriction values: ${unknownClasses.join(', ')}`)
      }
    }
  }

  return warnings
}
