import React from 'react';
import { Autocomplete, TextField, createFilterOptions } from '@mui/material';
import { useRecoilState, useRecoilValue } from 'recoil';
import { activeLibraryState, libraryIndexState } from '../../recoil/atoms';

const filter = createFilterOptions();

/**
 * Drop-in replacement for TextField on fields backed by a constants index key.
 *
 * indexKey: 'itemCategories' | 'castableCategories' | 'statusCategories' | 'cookieNames'
 * onChange: (value: string) => void   ← receives a plain string, not an event
 */
function ConstantAutocomplete({ indexKey, label, value, onChange, size = 'small', sx, inputProps, ...rest }) {
  const activeLibrary = useRecoilValue(activeLibraryState);
  const [libraryIndex, setLibraryIndex] = useRecoilState(libraryIndexState);

  const options = libraryIndex[indexKey] || [];

  const handleCreate = async (val) => {
    if (activeLibrary) {
      const updated = await window.electronAPI.addConstantValue(activeLibrary, indexKey, val);
      if (updated) setLibraryIndex(updated);
    }
    onChange(val);
  };

  return (
    <Autocomplete
      freeSolo
      size={size}
      sx={sx}
      options={options}
      value={value || ''}
      onInputChange={(_, val, reason) => {
        if (reason === 'input') onChange(val);
      }}
      onChange={(_, val) => {
        if (val === null) onChange('');
        else if (typeof val === 'object' && val.inputValue) handleCreate(val.inputValue);
        else onChange(val ?? '');
      }}
      filterOptions={(opts, params) => {
        const filtered = filter(opts, params);
        const { inputValue } = params;
        const trimmed = inputValue.trim();
        if (trimmed && !opts.some(o => o.toLowerCase() === trimmed.toLowerCase())) {
          filtered.push({ label: `Create "${trimmed}"`, inputValue: trimmed });
        }
        return filtered;
      }}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
      isOptionEqualToValue={(opt, val) => opt === val}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          inputProps={{ ...params.inputProps, ...inputProps }}
        />
      )}
      {...rest}
    />
  );
}

export default ConstantAutocomplete;
