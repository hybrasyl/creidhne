import React from 'react';
import { Autocomplete, TextField, IconButton, Tooltip, InputAdornment } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useRecoilValue } from 'recoil';
import { libraryIndexState, activeLibraryState } from '../../recoil/atoms';

function stripPath(s) {
  return s.replace(/.*[\\/]/, '').replace(/\.lua$/i, '');
}

/**
 * Drop-in script autocomplete. Strips directory and .lua extension from both
 * option display and stored value. Supports freeSolo with warning highlight
 * for unknown scripts.
 *
 * When `subfolder` is provided (e.g. "castables", "reactors", "items"), the
 * component renders a small "Open" button inside the input that calls
 * `electronAPI.openScript(activeLibrary, `${subfolder}/${value}`)` — opening
 * the script in the OS default editor for .lua (usually VS Code).
 */
function ScriptAutocomplete({
  label, value, onChange, freeSolo = false, sx, fullWidth, size = 'small', subfolder,
}) {
  const libraryIndex = useRecoilValue(libraryIndexState);
  const activeLibrary = useRecoilValue(activeLibraryState);
  const options = (libraryIndex.scripts || []).map(stripPath);
  const isUnknown = freeSolo && !!value && !options.includes(value);

  const canOpen = !!(subfolder && value && activeLibrary);
  const handleOpen = async () => {
    if (!canOpen) return;
    await window.electronAPI.openScript(activeLibrary, `${subfolder}/${value}`);
  };

  const endAdornment = subfolder ? (
    <InputAdornment position="end">
      <Tooltip title={canOpen ? `Open ${subfolder}/${value}.lua in default editor` : 'Pick a script + active library to enable'}>
        <span>
          <IconButton size="small" onClick={handleOpen} disabled={!canOpen} edge="end">
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </InputAdornment>
  ) : null;

  return (
    <Autocomplete
      freeSolo={freeSolo}
      options={options}
      value={freeSolo ? (value || '') : (value || null)}
      onInputChange={freeSolo ? ((_, val, reason) => { if (reason === 'input') onChange(val); }) : undefined}
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
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {params.InputProps.endAdornment}
                {endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}

export default ScriptAutocomplete;
