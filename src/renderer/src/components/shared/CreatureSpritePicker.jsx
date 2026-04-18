import React, { useState } from 'react'
import { Box, TextField, IconButton, Tooltip } from '@mui/material'
import GridViewIcon from '@mui/icons-material/GridView'
import spriteMeta, { keyFromSprite, spriteUrl, frameDisplay } from '../../data/creatureSpriteData'
import SpritePickerDialog from './SpritePickerDialog'

const PREVIEW_SIZE = 48

export default function CreatureSpritePicker({ value, onChange }) {
  const [open, setOpen] = useState(false)

  const key = keyFromSprite(value)
  const meta = key ? spriteMeta[key] : null

  const frame = meta ? frameDisplay(meta, meta.still, PREVIEW_SIZE) : null

  const handleSelect = (selectedKey) => {
    onChange(String(parseInt(selectedKey.replace('monster', ''), 10)))
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
        {frame && (
          <Box sx={{ width: frame.clipW, height: frame.clipH, overflow: 'hidden', flexShrink: 0 }}>
            <img src={spriteUrl(key)} alt={key} draggable={false} style={frame.imgStyle} />
          </Box>
        )}
      </Box>
      <TextField
        label="Sprite"
        size="small"
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ min: 1, max: 9999 }}
        sx={{ width: 100 }}
      />
      <Tooltip title="Browse sprites">
        <IconButton size="small" onClick={() => setOpen(true)}>
          <GridViewIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <SpritePickerDialog
        open={open}
        value={value}
        onClose={() => setOpen(false)}
        onChange={handleSelect}
      />
    </Box>
  )
}
