import React, { useState } from 'react'
import { Box, TextField, IconButton, Tooltip } from '@mui/material'
import GridViewIcon from '@mui/icons-material/GridView'
import HelpIcon from '@mui/icons-material/Help'
import { useRecoilValue } from 'recoil'
import { clientPathState } from '../../recoil/atoms'
import NpcPortraitCanvas from './NpcPortraitCanvas'
import NpcPortraitPickerDialog from './NpcPortraitPickerDialog'

const PREVIEW_SIZE = 72

/**
 * Picker for NPC portrait SPF filenames.
 *
 * Props:
 *   value       — string (e.g. "mage.spf") or empty
 *   onChange    — called with the selected filename (raw string)
 *   label       — TextField label (default "Portrait")
 *   helpTooltip — optional help icon
 */
export default function NpcPortraitPicker({ value, onChange, label = 'Portrait', helpTooltip }) {
  const [open, setOpen] = useState(false)
  const clientPath = useRecoilValue(clientPathState)

  const handleSelect = (filename) => {
    onChange(filename)
    setOpen(false)
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <NpcPortraitCanvas filename={value} size={PREVIEW_SIZE} />
      <TextField
        label={label}
        size="small"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ maxLength: 255 }}
        sx={{ width: 180 }}
      />
      <Tooltip
        title={
          clientPath
            ? 'Browse NPC portraits'
            : 'Set Dark Ages client path in Settings to browse portraits'
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
      <NpcPortraitPickerDialog
        open={open}
        value={value}
        onClose={() => setOpen(false)}
        onChange={handleSelect}
      />
    </Box>
  )
}
