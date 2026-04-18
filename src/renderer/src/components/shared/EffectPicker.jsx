import React, { useState } from 'react'
import { Box, TextField, IconButton, Tooltip } from '@mui/material'
import GridViewIcon from '@mui/icons-material/GridView'
import HelpIcon from '@mui/icons-material/Help'
import { useRecoilValue } from 'recoil'
import { clientPathState } from '../../recoil/atoms'
import EffectPreview from './EffectPreview'
import EffectPickerDialog from './EffectPickerDialog'

const PREVIEW_SIZE = 48

/**
 * Combined effect picker — one component bundles the effect id, speed, and
 * an animated preview (auto-playing, speed-controlled).
 *
 * Props:
 *   effectId, speed                 — current values (strings or numbers)
 *   onEffectIdChange, onSpeedChange — called with raw value strings
 *   label                           — label for the id field (default "Effect ID")
 *   speedLabel                      — label for the speed field (default "Speed")
 *   helpTooltip                     — optional help icon tooltip
 *   showSpeed                       — set false for single-field mode (e.g. coma effect)
 */
export default function EffectPicker({
  effectId,
  speed,
  onEffectIdChange,
  onSpeedChange,
  label = 'Effect ID',
  speedLabel = 'Speed',
  helpTooltip,
  showSpeed = true,
  idWidth = 110,
  speedWidth = 90
}) {
  const [open, setOpen] = useState(false)
  const clientPath = useRecoilValue(clientPathState)

  const numericId = Number(effectId)
  const isValid = Number.isFinite(numericId) && numericId >= 1

  const handleSelect = (id) => {
    onEffectIdChange(String(id))
    setOpen(false)
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <EffectPreview effectId={effectId} speed={speed} size={PREVIEW_SIZE} playing={isValid} />
      <TextField
        label={label}
        size="small"
        type="number"
        value={effectId ?? ''}
        onChange={(e) => onEffectIdChange(String(e.target.value).replace(/\D/g, ''))}
        inputProps={{ min: 0 }}
        sx={{ width: idWidth }}
      />
      {showSpeed && (
        <TextField
          label={speedLabel}
          size="small"
          type="number"
          value={speed ?? ''}
          onChange={(e) => onSpeedChange(String(e.target.value).replace(/\D/g, ''))}
          inputProps={{ min: 0 }}
          sx={{ width: speedWidth }}
        />
      )}
      <Tooltip
        title={
          clientPath ? 'Browse effects' : 'Set Dark Ages client path in Settings to browse effects'
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
      <EffectPickerDialog
        open={open}
        value={effectId}
        speed={speed}
        onClose={() => setOpen(false)}
        onChange={handleSelect}
      />
    </Box>
  )
}
