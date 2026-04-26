import React, { useState } from 'react'
import { Box, TextField, IconButton, Tooltip } from '@mui/material'
import GridViewIcon from '@mui/icons-material/GridView'
import HelpIcon from '@mui/icons-material/Help'
import { useRecoilValue } from 'recoil'
import { clientPathState } from '../../recoil/atoms'
import { categoriesFor } from '../../data/khanData'
import DisplaySpriteCanvas from './DisplaySpriteCanvas'
import DisplaySpritePickerDialog from './DisplaySpritePickerDialog'

const PREVIEW_SIZE = 72

/**
 * Composite picker for an item's displaySprite field. Shows male + female
 * previews side-by-side, plus the number field and a grid browse button
 * scoped to the slot's category letter.
 *
 * Caller is expected to gate rendering on `categoriesFor(slot).length > 0`
 * — this component assumes the slot has a valid khan category mapping.
 *
 * Props:
 *   slot            — equipment slot name (e.g. 'Armor'); determines category
 *   value           — current displaySprite id (string or number)
 *   onChange        — called with the new id (raw value)
 *   helpTooltip     — optional help icon
 */
export default function DisplaySpritePicker({ slot, value, onChange, helpTooltip }) {
  const [open, setOpen] = useState(false)
  const clientPath = useRecoilValue(clientPathState)

  const categories = categoriesFor(slot)
  const category = categories.length ? categories : null
  const mapped = Boolean(category)

  const handleSelect = (id) => {
    onChange(String(id))
    setOpen(false)
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <DisplaySpriteCanvas
        category={category}
        gender="M"
        displaySprite={value}
        size={PREVIEW_SIZE}
        label="Male"
      />
      <DisplaySpriteCanvas
        category={category}
        gender="W"
        displaySprite={value}
        size={PREVIEW_SIZE}
        label="Female"
      />
      <TextField
        label="Display Sprite"
        size="small"
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(String(e.target.value).replace(/\D/g, ''))}
        sx={{ width: 140 }}
        slotProps={{
          htmlInput: { min: 0, max: 65535 }
        }}
      />
      <Tooltip
        title={
          !clientPath
            ? 'Set Dark Ages client path in Settings to browse display sprites'
            : 'Browse display sprites for this slot'
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
      <DisplaySpritePickerDialog
        open={open}
        category={category}
        value={value}
        onClose={() => setOpen(false)}
        onChange={handleSelect}
      />
    </Box>
  );
}
