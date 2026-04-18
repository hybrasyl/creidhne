import React, { useState } from 'react'
import { Box, TextField, IconButton, Tooltip } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import ListIcon from '@mui/icons-material/List'
import HelpIcon from '@mui/icons-material/Help'
import { useRecoilValue } from 'recoil'
import { clientPathState } from '../../recoil/atoms'
import { playSound, stopSound, useCurrentlyPlayingSound } from '../../data/soundData'
import SoundPickerDialog from './SoundPickerDialog'

export default function SoundPicker({
  value,
  onChange,
  label = 'Sound',
  required = false,
  width = 140,
  helpTooltip
}) {
  const [open, setOpen] = useState(false)
  const clientPath = useRecoilValue(clientPathState)
  const playingId = useCurrentlyPlayingSound()

  const numericId = Number(value)
  const isValid = Number.isFinite(numericId) && numericId >= 0
  const isPlaying = isValid && playingId === numericId

  const handlePlayToggle = () => {
    if (!clientPath || !isValid) return
    if (isPlaying) stopSound()
    else playSound(clientPath, numericId)
  }

  const handleSelect = (id) => {
    onChange(String(id))
    setOpen(false)
  }

  const playTooltip = !clientPath
    ? 'Set Dark Ages client path in Settings to preview sounds'
    : !isValid
      ? 'Enter a sound id to preview'
      : isPlaying
        ? 'Stop'
        : 'Play'

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <TextField
        label={label}
        size="small"
        type="number"
        required={required}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        sx={{ width }}
        slotProps={{
          htmlInput: { min: 0 }
        }}
      />
      <Tooltip title={playTooltip}>
        <span>
          <IconButton size="small" onClick={handlePlayToggle} disabled={!clientPath || !isValid}>
            {isPlaying ? <StopIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip
        title={
          clientPath ? 'Browse sounds' : 'Set Dark Ages client path in Settings to browse sounds'
        }
      >
        <span>
          <IconButton size="small" onClick={() => setOpen(true)} disabled={!clientPath}>
            <ListIcon fontSize="small" />
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
      <SoundPickerDialog
        open={open}
        value={value}
        onClose={() => setOpen(false)}
        onChange={handleSelect}
      />
    </Box>
  );
}
