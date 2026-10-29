import { Autocomplete, TextField } from '@mui/material'
import { useElementOptions } from '../../hooks/useElementOptions'
import { elementWarning, selectorWarnings, splitSelectors } from '@shared/elementOptions'

/**
 * The two element inputs (HTOO-581). Both take their options from the active
 * element table and accept a value the table does not define, so a file that
 * names one opens and saves unchanged; the helper text says what is wrong.
 */

/**
 * One element key: a stat or elemental modifier, a damage element, an
 * immunity. Empty means "not set", and the server then uses the default
 * element.
 */
export function ElementField({ value, onChange, label = 'Element', sx }) {
  const options = useElementOptions()
  const warning = elementWarning(value, options)
  return (
    <Autocomplete
      freeSolo
      options={options.keys}
      value={value ?? ''}
      onInputChange={(_, val, reason) => {
        if (reason === 'input' || reason === 'clear') onChange(val)
      }}
      onChange={(_, val) => onChange(val ?? '')}
      size="small"
      sx={sx}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          helperText={warning ?? undefined}
          slotProps={{
            ...params.slotProps,
            formHelperText: { sx: { color: 'warning.main' } }
          }}
        />
      )}
    />
  )
}

/**
 * A selector list: castable `Elements`, spawn `Damage` and `Defense`
 * `Elements`. Each selector is an element key, `Random:<Group>`, or
 * `Current`, `Belt` or `Necklace`. The value is the space-separated text that
 * the file holds.
 */
export function ElementSelectorField({ value, onChange, label = 'Elements', sx }) {
  const options = useElementOptions()
  const selected = splitSelectors(value)
  const warnings = selectorWarnings(value, options)
  return (
    <Autocomplete
      multiple
      freeSolo
      options={options.selectors}
      value={selected}
      onChange={(_, vals) => onChange(vals.flatMap(splitSelectors).join(' '))}
      size="small"
      sx={sx}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          helperText={warnings.length ? warnings.join(' ') : undefined}
          slotProps={{
            ...params.slotProps,
            formHelperText: { sx: { color: 'warning.main' } }
          }}
        />
      )}
    />
  )
}
