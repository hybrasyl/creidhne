import { useState } from 'react'
import { Box, TextField, IconButton, Tooltip } from '@mui/material'
import GridViewIcon from '@mui/icons-material/GridView'
import HelpIcon from '@mui/icons-material/Help'
import { useStoreValue, clientPathState, packCoverageState } from '../../store/appStore'
import ItemSpriteCanvas from './ItemSpriteCanvas'
import ItemSpritePickerDialog from './ItemSpritePickerDialog'
import { ITEM_SPRITE_MAX } from '@shared/itemIcons.js'

const PREVIEW_SIZE = 48

export default function ItemSpritePicker({
  value,
  onChange,
  label = 'Sprite',
  required = false,
  // The server sends `sprite + 0x8000` as a u16, so 32767 is the largest id
  // that reaches the client, though the XSD allows 65535 (HTOO-695).
  max = ITEM_SPRITE_MAX,
  helpTooltip,
  color = ''
}) {
  const [open, setOpen] = useState(false)
  const clientPath = useStoreValue(clientPathState)
  // A pack's item icons can be picked with no client path (HTOO-695).
  const packHasItems = (useStoreValue(packCoverageState).item?.length ?? 0) > 0
  const canBrowse = Boolean(clientPath) || packHasItems

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
        <ItemSpriteCanvas value={value} size={PREVIEW_SIZE} color={color} />
      </Box>
      <TextField
        label={label}
        size="small"
        type="number"
        required={required}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        sx={{ width: 120 }}
        slotProps={{
          htmlInput: { min: 0, max }
        }}
      />
      <Tooltip
        title={
          canBrowse
            ? 'Browse item sprites'
            : 'Set Dark Ages client path in Settings to browse sprites'
        }
      >
        <span>
          <IconButton size="small" onClick={() => setOpen(true)} disabled={!canBrowse}>
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
