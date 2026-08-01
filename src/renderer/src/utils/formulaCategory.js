// Category presentation for formulas, kept as plain functions so it is testable
// in the node test project (the renderer has no jsdom tier) and so the chip in
// the file list and the chip in the picker dialog can never drift apart again.

const CATEGORY_COLORS = {
  damage: 'error',
  heal: 'success',
  conversion: 'secondary',
  shield: 'primary',
  stat: 'info',
  cast_cost: 'warning',
  general: 'default'
}

/**
 * The text on a formula's category chip. A formula with no category reads as
 * 'damage' — most uncategorized formulas are damage formulas from before the
 * field existed.
 */
export function formulaCategoryLabel(category) {
  return category || 'damage'
}

/**
 * The MUI palette color for a formula's category chip.
 *
 * Note the asymmetry with formulaCategoryLabel: an absent category is labelled
 * 'damage' but colored 'default' (grey), not 'error'. This reproduces the
 * picker dialog's long-standing behavior exactly — see FormulaPickerDialog
 * before this module existed. It is preserved deliberately so extracting the
 * chip changes nothing on screen; whether the two should agree is a design
 * question, not a refactoring one.
 */
export function formulaCategoryColor(category) {
  return CATEGORY_COLORS[category] || 'default'
}

/** The categories that have a color of their own. Exported for tests. */
export function knownFormulaCategories() {
  return Object.keys(CATEGORY_COLORS)
}
