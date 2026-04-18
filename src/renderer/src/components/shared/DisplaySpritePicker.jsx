import React, { useState } from 'react'
import { Box, TextField, IconButton, Tooltip, Typography } from '@mui/material'
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
 * previews side-by-side (items are generally consistent across gender),
 * plus the number field and a grid browse button scoped to the slot's
 * category letter.
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
      {mapped ? (
        <>
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
        </>
      ) : (
        <Box
          sx={{
            width: PREVIEW_SIZE * 2 + 16,
            height: PREVIEW_SIZE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'action.hover',
            px: 1
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            Pick a valid equipment slot
          </Typography>
        </Box>
      )}
      <TextField
        label="Display Sprite"
        size="small"
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(String(e.target.value).replace(/\D/g, ''))}
        inputProps={{ min: 0, max: 65535 }}
        sx={{ width: 140 }}
      />
      <Tooltip
        title={
          !clientPath
            ? 'Set Dark Ages client path in Settings to browse display sprites'
            : !mapped
              ? 'This equipment slot is not yet mapped to a khan category'
              : 'Browse display sprites for this slot'
        }
      >
        <span>
          <IconButton size="small" onClick={() => setOpen(true)} disabled={!clientPath || !mapped}>
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
  )
}
