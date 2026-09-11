import { Autocomplete, TextField } from '@mui/material'
import { useStoreValue, libraryIndexState } from '../../store/appStore'

/**
 * A `<Name>` picked from one section of the world index.
 *
 * Props:
 *   section  — the index key that holds the names ('maps', 'statuses', …)
 *   label    — field label
 *   value    — the current name; '' when unset
 *   onChange — (name: string) => void
 *   sx       — forwarded to the Autocomplete
 *
 * `freeSolo` because the index is a cache: a name that is not in it yet is
 * still a valid value, and the server keys on the text, not on the list.
 */
function IndexNamePicker({ section, label, value, onChange, sx }) {
  const libraryIndex = useStoreValue(libraryIndexState)
  const options = libraryIndex[section] || []
  return (
    <Autocomplete
      freeSolo
      size="small"
      options={options}
      value={value || ''}
      onInputChange={(_, val, reason) => {
        if (reason === 'input') onChange(val)
      }}
      onChange={(_, val) => onChange(val ?? '')}
      sx={sx}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  )
}

export default IndexNamePicker
