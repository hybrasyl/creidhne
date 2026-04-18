import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Box,
  Typography,
  IconButton,
  InputAdornment,
  CircularProgress
} from '@mui/material'
import { FixedSizeList } from 'react-window'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import { useRecoilValue } from 'recoil'
import { clientPathState } from '../../recoil/atoms'
import { useSoundIndex, playSound, stopSound, useCurrentlyPlayingSound } from '../../data/soundData'

const ROW_HEIGHT = 40
const LIST_HEIGHT = 480
const LIST_WIDTH = 320

function Row({ index, style, data }) {
  const { ids, selectedId, onSelect, clientPath, playingId } = data
  const id = ids[index]
  const selected = id === selectedId
  const isPlaying = playingId === id

  const togglePlay = (e) => {
    e.stopPropagation()
    if (isPlaying) stopSound()
    else playSound(clientPath, id)
  }

  return (
    <div style={style} onClick={() => onSelect(id)}>
      <Box
        sx={{
          height: ROW_HEIGHT,
          px: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          borderRadius: 1,
          border: 2,
          borderColor: selected ? 'primary.main' : 'transparent',
          bgcolor: selected ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' }
        }}
      >
        <Typography sx={{ flex: 1, fontFamily: 'monospace' }}>{id}</Typography>
        <IconButton size="small" onClick={togglePlay}>
          {isPlaying ? <StopIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </IconButton>
      </Box>
    </div>
  )
}

export default function SoundPickerDialog({ open, value, onClose, onChange }) {
  const clientPath = useRecoilValue(clientPathState)
  const ids = useSoundIndex()
  const playingId = useCurrentlyPlayingSound()
  const [search, setSearch] = useState('')
  const listRef = useRef(null)

  const filteredIds = useMemo(() => {
    if (!ids) return []
    const q = search.trim()
    if (!q) return ids
    return ids.filter((id) => String(id).includes(q))
  }, [ids, search])

  const selectedId = useMemo(() => {
    const n = Number(value)
    return Number.isFinite(n) && n >= 0 ? n : null
  }, [value])

  useEffect(() => {
    if (!open || selectedId == null || !listRef.current || filteredIds.length === 0) return
    const idx = filteredIds.indexOf(selectedId)
    if (idx < 0) return
    listRef.current.scrollToItem(idx, 'smart')
  }, [open, selectedId, filteredIds])

  // Stop any playback when the dialog closes.
  useEffect(() => {
    if (!open) stopSound()
  }, [open])

  const itemData = useMemo(
    () => ({ ids: filteredIds, selectedId, onSelect: onChange, clientPath, playingId }),
    [filteredIds, selectedId, onChange, clientPath, playingId]
  )

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', py: 1.6 }}>
        Sounds
        {ids && (
          <Typography variant="caption" sx={{ ml: 1.5, color: 'text.secondary' }}>
            ({ids.length.toLocaleString()} total)
          </Typography>
        )}
        <IconButton size="small" onClick={onClose} sx={{ ml: 'auto' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 1, pt: '8px !important', width: LIST_WIDTH + 16 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Filter by number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        {!ids && (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={32} />
          </Box>
        )}
        {ids && (
          <FixedSizeList
            ref={listRef}
            width={LIST_WIDTH}
            height={LIST_HEIGHT}
            itemCount={filteredIds.length}
            itemSize={ROW_HEIGHT}
            itemData={itemData}
          >
            {Row}
          </FixedSizeList>
        )}
      </DialogContent>
    </Dialog>
  )
}
