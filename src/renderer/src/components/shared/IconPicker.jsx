import React, { useState } from 'react'
import { Box, TextField, IconButton, Tooltip } from '@mui/material'
import GridViewIcon from '@mui/icons-material/GridView'
import HelpIcon from '@mui/icons-material/Help'
import { useRecoilValue } from 'recoil'
import { clientPathState } from '../../recoil/atoms'
import { DualIconView } from './DualIconView'
import IconPickerDialog from './IconPickerDialog'

const PREVIEW_SIZE = 48

/**
 * Spell or skill icon picker. A single `type` prop drives which pool we show:
 *   - CastableEditor passes `type={typeFromBook(data.book)}`
 *   - StatusEditor passes `type="spell"` (statuses always use spell icons)
 *
 * Props:
 *   type        — 'spell' | 'skill'
 *   value       — numeric icon id (string or number)
 *   onChange    — called with the raw id value
 *   label       — TextField label (default "Icon")
 *   helpTooltip — optional help icon
 */
export default function IconPicker({ type, value, onChange, label = 'Icon', helpTooltip }) {
  const [open, setOpen] = useState(false)
  const clientPath = useRecoilValue(clientPathState)

  const handleSelect = (id) => {
    onChange(String(id))
    setOpen(false)
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <DualIconView type={type} id={value} size={PREVIEW_SIZE} />
      <TextField
        label={label}
        size="small"
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(String(e.target.value).replace(/\D/g, ''))}
        sx={{ width: 110 }}
        slotProps={{
          htmlInput: { min: 0 }
        }}
      />
      <Tooltip
        title={
          clientPath
            ? `Browse ${type} icons`
            : 'Set Dark Ages client path in Settings to browse icons'
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
      <IconPickerDialog
        open={open}
        type={type}
        value={value}
        onClose={() => setOpen(false)}
        onChange={handleSelect}
      />
    </Box>
  );
}
