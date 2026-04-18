import React from 'react'
import { Autocomplete, TextField } from '@mui/material'
import { useRecoilValue } from 'recoil'
import { libraryIndexState } from '../../recoil/atoms'

function stripPath(s) {
  return s.replace(/.*[\\/]/, '').replace(/\.lua$/i, '')
}

// Drop-in script autocomplete that strips directory and .lua extension from both
// option display and stored value. Supports freeSolo with warning highlight for
// unknown scripts.
function ScriptAutocomplete({
  label,
  value,
  onChange,
  freeSolo = false,
  sx,
  fullWidth,
  size = 'small'
}) {
  const libraryIndex = useRecoilValue(libraryIndexState)
  const options = (libraryIndex.scripts || []).map(stripPath)
  const isUnknown = freeSolo && !!value && !options.includes(value)

  return (
    <Autocomplete
      freeSolo={freeSolo}
      options={options}
      value={freeSolo ? value || '' : value || null}
      onInputChange={
        freeSolo
          ? (_, val, reason) => {
              if (reason === 'input') onChange(val)
            }
          : undefined
      }
      onChange={(_, val) => onChange(val ?? '')}
      size={size}
      sx={sx}
      fullWidth={fullWidth}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          color={isUnknown ? 'warning' : 'primary'}
          focused={isUnknown || undefined}
        />
      )}
    />
  )
}

export default ScriptAutocomplete
