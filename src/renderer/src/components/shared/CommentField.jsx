import React from 'react'
import { TextField } from '@mui/material'

export default function CommentField({ value, onChange, ...props }) {
  return (
    <TextField
      label="Comment"
      size="small"
      multiline
      minRows={2}
      value={value || ''}
      onChange={onChange}
      {...props}
      slotProps={{
        htmlInput: { maxLength: 500 }
      }} />
  );
}
