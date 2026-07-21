import { Autocomplete, TextField } from '@mui/material'
import { normalizeFolder } from '../../utils/fileTree'

/**
 * Where a file gets saved, within its type directory.
 *
 * Props:
 *   value    — folder path relative to the type directory; '' is the type root
 *   options  — folders already in use in this section (see `folderOptions`)
 *   onChange — (folder: string) => void
 *   warn     — mark the field when saving would relocate the file
 *
 * `freeSolo` is the whole point: folders are not a data model, a subfolder
 * exists only because files sit in it, so typing a new one IS how you create
 * one. Nothing has to mkdir here — the main-process write creates the parent.
 */
function FolderSelect({ value, options, onChange, warn }) {
  return (
    <Autocomplete
      freeSolo
      size="small"
      options={options}
      value={value}
      onChange={(_, v) => onChange(normalizeFolder(v ?? ''))}
      onInputChange={(_, v, reason) => {
        // Normalizing every keystroke would eat the separator the moment it is
        // typed, so only clean up on blur and on selection.
        if (reason === 'input') onChange(v)
        else if (reason === 'clear') onChange('')
      }}
      onBlur={() => onChange(normalizeFolder(value))}
      sx={{ flex: 1 }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Folder"
          placeholder="(root)"
          // MUI v9 hands renderInput a `slotProps` (not the v5-era InputProps /
          // inputProps), and it carries the classes Autocomplete styles itself
          // through. Replacing the object instead of merging into it drops
          // `.MuiAutocomplete-input` from the inner input, which then keeps the
          // default 8.5px vertical padding while the root still gets
          // Autocomplete's — 12px taller than the Filename field beside it.
          slotProps={{
            ...params.slotProps,
            htmlInput: { ...params.slotProps?.htmlInput, spellCheck: false }
          }}
          sx={
            warn
              ? {
                  '& .MuiOutlinedInput-root fieldset': { borderColor: 'warning.main' },
                  '& .MuiInputLabel-root:not(.Mui-focused)': { color: 'warning.main' }
                }
              : undefined
          }
        />
      )}
    />
  )
}

export default FolderSelect
