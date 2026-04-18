import React from 'react'
import { Autocomplete, TextField, createFilterOptions } from '@mui/material'
import { useRecoilState, useRecoilValue } from 'recoil'
import { activeLibraryState, libraryIndexState } from '../../recoil/atoms'

const filter = createFilterOptions()

/**
 * Drop-in replacement for TextField on fields backed by a constants index key.
 *
 * indexKey: 'itemCategories' | 'castableCategories' | 'statusCategories' | 'cookieNames'
 *           | 'npcJobs' | 'vendorTabs'
 * onChange: (value: string) => void          — single mode (default)
 * onChange: (value: string[]) => void        — multiple mode
 * multiple: boolean — when true, value/onChange work with string arrays
 */
function ConstantAutocomplete({
  indexKey,
  label,
  value,
  onChange,
  size = 'small',
  sx,
  inputProps,
  multiple = false,
  ...rest
}) {
  const activeLibrary = useRecoilValue(activeLibraryState)
  const [libraryIndex, setLibraryIndex] = useRecoilState(libraryIndexState)

  const options = libraryIndex[indexKey] || []

  const persistNew = async (val) => {
    if (activeLibrary) {
      await window.electronAPI.addConstantValue(activeLibrary, indexKey, val)
      setLibraryIndex((prev) => ({
        ...prev,
        [indexKey]: [...new Set([...(prev[indexKey] || []), val])].sort()
      }))
    }
  }

  const filterOptions = (opts, params) => {
    const filtered = filter(opts, params)
    const trimmed = params.inputValue.trim()
    if (trimmed && !opts.some((o) => o.toLowerCase() === trimmed.toLowerCase())) {
      filtered.push({ label: `Create "${trimmed}"`, inputValue: trimmed })
    }
    return filtered
  }

  if (multiple) {
    const currentValue = value || []
    return (
      <Autocomplete
        multiple
        freeSolo
        size={size}
        sx={sx}
        options={options}
        value={currentValue}
        onChange={async (_, newVal) => {
          // Resolve any {inputValue} objects (create selections) in the array
          const resolved = []
          for (const item of newVal) {
            if (typeof item === 'object' && item.inputValue) {
              await persistNew(item.inputValue)
              resolved.push(item.inputValue)
            } else if (typeof item === 'string') {
              const trimmed = item.trim()
              if (trimmed && !options.some((o) => o.toLowerCase() === trimmed.toLowerCase())) {
                await persistNew(trimmed)
              }
              if (trimmed) resolved.push(trimmed)
            }
          }
          onChange(resolved)
        }}
        filterOptions={filterOptions}
        getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
        isOptionEqualToValue={(opt, val) => opt === val}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            slotProps={{
              ...params.slotProps,
              htmlInput: { ...params.slotProps.htmlInput, ...inputProps }
            }}
          />
        )}
        {...rest}
      />
    );
  }

  return (
    <Autocomplete
      freeSolo
      size={size}
      sx={sx}
      options={options}
      value={value || ''}
      onInputChange={(_, val, reason) => {
        if (reason === 'input') onChange(val)
      }}
      onChange={(_, val) => {
        if (val === null) onChange('')
        else if (typeof val === 'object' && val.inputValue) {
          persistNew(val.inputValue)
          onChange(val.inputValue)
        } else {
          const trimmed = (val || '').trim()
          if (trimmed && !options.some((o) => o.toLowerCase() === trimmed.toLowerCase())) {
            persistNew(trimmed)
          }
          onChange(trimmed)
        }
      }}
      filterOptions={filterOptions}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.inputValue)}
      renderOption={(props, option) => (
        <li {...props}>{typeof option === 'string' ? option : option.label}</li>
      )}
      isOptionEqualToValue={(opt, val) => opt === val}
      renderInput={(params) => (
        <TextField {...params} label={label} slotProps={{
          ...params.slotProps,
          htmlInput: { ...params.slotProps.htmlInput, ...inputProps }
        }} />
      )}
      {...rest}
    />
  );
}

export default ConstantAutocomplete
