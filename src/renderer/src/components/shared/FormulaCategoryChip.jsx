import { Chip } from '@mui/material'
import { formulaCategoryLabel, formulaCategoryColor } from '../../utils/formulaCategory'

/**
 * The colored category chip for a formula.
 *
 * Both places that show one — the formula picker dialog and the Formulas file
 * list — render this component, so the size and shape stay in step. The color
 * map is deliberately not exported: sharing the colors but not the chip is how
 * the two drifted the first time.
 *
 * Props:
 *   category — the formula's category string; absent is allowed
 */
function FormulaCategoryChip({ category }) {
  return (
    <Chip
      label={formulaCategoryLabel(category)}
      size="small"
      color={formulaCategoryColor(category)}
      sx={{ height: 16, fontSize: '0.65rem' }}
    />
  )
}

export default FormulaCategoryChip
