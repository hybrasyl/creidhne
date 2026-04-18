import React, { useState } from 'react'
import { Box, TextField, IconButton, Tooltip } from '@mui/material'
import GridViewIcon from '@mui/icons-material/GridView'
import HelpIcon from '@mui/icons-material/Help'
import { useRecoilValue } from 'recoil'
import { clientPathState } from '../../recoil/atoms'
import ItemSpriteCanvas from './ItemSpriteCanvas'
import ItemSpritePickerDialog from './ItemSpritePickerDialog'

const PREVIEW_SIZE = 48

export default function ItemSpritePicker({
  value,
  onChange,
  label = 'Sprite',
  required = false,
  max = 65535,
  helpTooltip
}) {
  const [open, setOpen] = useState(false)
  const clientPath = useRecoilValue(clientPathState)

  const handleSelect = (id) => {
    onChange(String(id))
    setOpen(false)
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: PREVIEW_SIZE,
          height: PREVIEW_SIZE,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'action.hover'
        }}
      >
        <ItemSpriteCanvas value={value} size={PREVIEW_SIZE} />
      </Box>
      <TextField
        label={label}
        size="small"
        type="number"
        required={required}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ min: 0, max }}
        sx={{ width: 120 }}
      />
      <Tooltip
        title={
          clientPath
            ? 'Browse item sprites'
            : 'Set Dark Ages client path in Settings to browse sprites'
        }
      >
        <span>
          <IconButton size="small" onClick={() => setOpen(true)} disabled={!clientPath}>
            <GridViewIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      {helpTooltip && (
        <Tooltip title={helpTooltip} placement="top">
          <IconButton size="small" sx={{ color: 'text.secondary' }}>
            <HelpIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <ItemSpritePickerDialog
        open={open}
        value={value}
        onClose={() => setOpen(false)}
        onChange={handleSelect}
      />
    </Box>
  )
}
