import React from 'react';
import {
  Box, TextField, FormControlLabel, Checkbox, Autocomplete, Chip, Typography, Paper,
} from '@mui/material';
import { ITEM_TAGS } from '../../../data/itemConstants';

function BasicTab({ data, onChange }) {
  const set = (field) => (e) => onChange({ ...data, [field]: e.target.value });
  const setCheck = (field) => (e) => onChange({ ...data, [field]: e.target.checked });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Identity</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Name"
            required
            value={data.name}
            onChange={set('name')}
            inputProps={{ maxLength: 255 }}
            size="small"
          />
          <TextField
            label="Unidentified Name"
            value={data.unidentifiedName}
            onChange={set('unidentifiedName')}
            inputProps={{ maxLength: 255 }}
            size="small"
          />
          <TextField
            label="Comment"
            value={data.comment}
            onChange={set('comment')}
            multiline
            minRows={2}
            inputProps={{ maxLength: 65534 }}
            size="small"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={data.includeInMetafile}
                onChange={setCheck('includeInMetafile')}
                size="small"
              />
            }
            label="Include in Metafile"
          />
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Tags</Typography>
        <Autocomplete
          multiple
          options={ITEM_TAGS}
          value={data.tags}
          onChange={(_, newVal) => onChange({ ...data, tags: newVal })}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip key={option} label={option} size="small" {...getTagProps({ index })} />
            ))
          }
          renderInput={(params) => (
            <TextField {...params} size="small" placeholder="Add tag..." />
          )}
        />
      </Paper>
    </Box>
  );
}

export default BasicTab;
