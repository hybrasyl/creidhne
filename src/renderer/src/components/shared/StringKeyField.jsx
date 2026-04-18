import React from 'react'
import { Box, Autocomplete, TextField, Typography } from '@mui/material'
import { useRecoilValue } from 'recoil'
import { libraryIndexState } from '../../recoil/atoms'

const STRING_CUSTOM = { key: '__custom__', message: '', category: '' }

/**
 * String key picker + message preview/edit field.
 *
 * Props:
 *   text            — the stored message text (what gets written to XML)
 *   stringKey       — the key tracking which option was picked; '' = custom mode
 *   onChange        — ({ text, key }) => void
 *   disabled        — bool
 *   pickerLabel     — label for the Autocomplete (defaults to 'String')
 *   externalOptions — optional Array<{ key, message, category }> to use instead of npcStringKeys
 *   warning         — optional string shown as helper text on the message field in custom mode
 *
 * Behaviour:
 *   - Custom option selected (or stringKey=''): shows an editable Message TextField.
 *   - Known key selected: shows a disabled Preview TextField with the resolved message.
 *   - Selecting a key sets text to the resolved message and records the key in metadata.
 *   - Switching back to Custom keeps the current text but clears the key.
 */
function StringKeyField({
  text,
  stringKey,
  onChange,
  disabled = false,
  pickerLabel = 'String',
  externalOptions,
  warning
}) {
  const npcStringKeys = useRecoilValue(libraryIndexState).npcStringKeys || []
  const entries = externalOptions ?? npcStringKeys
  const options = [STRING_CUSTOM, ...entries]
  const isCustom = !stringKey
  const selectedOption = isCustom
    ? STRING_CUSTOM
    : (entries.find((s) => s.key === stringKey) ?? STRING_CUSTOM)
  const preview = isCustom ? '' : (entries.find((s) => s.key === stringKey)?.message ?? '')

  const handleChange = (_, val) => {
    if (!val || val.key === '__custom__') onChange({ text, key: '' })
    else onChange({ text: val.message, key: val.key })
  }

  return (
    <>
      <Autocomplete
        options={options}
        groupBy={(opt) => (opt.key === '__custom__' ? undefined : opt.category)}
        getOptionLabel={(opt) => (opt.key === '__custom__' ? 'Custom' : opt.key)}
        value={selectedOption}
        onChange={handleChange}
        isOptionEqualToValue={(a, b) => a.key === b.key}
        disabled={disabled}
        size="small"
        sx={{ width: 220, flexShrink: 0 }}
        renderInput={(params) => <TextField {...params} label={pickerLabel} />}
        renderOption={(props, opt) => (
          <li {...props} key={opt.key}>
            {opt.key === '__custom__' ? (
              <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                Custom
              </Typography>
            ) : (
              <Box>
                <Typography variant="body2">{opt.key}</Typography>
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>
                  {opt.message}
                </Typography>
              </Box>
            )}
          </li>
        )}
      />
      {isCustom ? (
        <TextField
          label="Message"
          size="small"
          value={text}
          onChange={(e) => onChange({ text: e.target.value, key: '' })}
          disabled={disabled}
          sx={{ flex: 1 }}
          helperText={warning}
          slotProps={{
            formHelperText: { sx: { color: 'warning.main', mx: 0 } }
          }}
        />
      ) : (
        <TextField label="Preview" size="small" value={preview} disabled sx={{ flex: 1 }} />
      )}
    </>
  );
}

export default StringKeyField
