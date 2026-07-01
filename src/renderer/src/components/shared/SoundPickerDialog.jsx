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
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material'
import { List } from 'react-window'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import { useRecoilValue, useRecoilState } from 'recoil'
import { clientPathState, packCoverageState, soundPickerModeState } from '../../recoil/atoms'
import {
  useSoundIndex,
  playSound,
  playPackSound,
  stopSound,
  useCurrentlyPlayingSound
} from '../../data/soundData'

const ROW_HEIGHT = 40
const LIST_HEIGHT = 480
const LIST_WIDTH = 320

function Row({ index, style, ids, selectedId, onSelect, clientPath, playingId, preferPack }) {
  const id = ids[index]
  const selected = id === selectedId
  const isPlaying = playingId === id

  const togglePlay = (e) => {
    e.stopPropagation()
    if (isPlaying) stopSound()
    else if (preferPack) playPackSound(clientPath, id)
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
  const packCoverage = useRecoilValue(packCoverageState)
  const [mode, setMode] = useRecoilState(soundPickerModeState)
  const [search, setSearch] = useState('')
  const listRef = useRef(null)

  const packHasType = (packCoverage.sfx?.length ?? 0) > 0
  const effectiveMode = packHasType ? mode : 'vanilla'
  const preferPack = effectiveMode === 'hybrasyl'

  // Base list: vanilla legend.dat sound ids, plus (in Hybrasyl mode) any
  // pack-only sound ids the vanilla archive doesn't have.
  const allIds = useMemo(() => {
    const base = ids || []
    if (!preferPack || !packHasType) return base
    const merged = new Set(base)
    for (const id of packCoverage.sfx || []) merged.add(id)
    return Array.from(merged).sort((a, b) => a - b)
  }, [ids, preferPack, packHasType, packCoverage])

  const filteredIds = useMemo(() => {
    const q = search.trim()
    if (!q) return allIds
    return allIds.filter((id) => String(id).includes(q))
  }, [allIds, search])

  const selectedId = useMemo(() => {
    const n = Number(value)
    return Number.isFinite(n) && n >= 0 ? n : null
  }, [value])

  useEffect(() => {
    if (!open || selectedId == null || !listRef.current || filteredIds.length === 0) return
    const idx = filteredIds.indexOf(selectedId)
    if (idx < 0) return
    listRef.current.scrollToRow({ index: idx, align: 'smart' })
  }, [open, selectedId, filteredIds])

  // Stop any playback when the dialog closes.
  useEffect(() => {
    if (!open) stopSound()
  }, [open])

  const itemData = useMemo(
    () => ({ ids: filteredIds, selectedId, onSelect: onChange, clientPath, playingId, preferPack }),
    [filteredIds, selectedId, onChange, clientPath, playingId, preferPack]
  )

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', py: 1.6 }}>
        Sounds
        {ids && (
          <Typography variant="caption" sx={{ ml: 1.5, color: 'text.secondary' }}>
            ({allIds.length.toLocaleString()} total)
          </Typography>
        )}
        {packHasType && (
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            onChange={(_, v) => v && setMode(v)}
            sx={{ ml: 2 }}
          >
            <ToggleButton value="vanilla">Vanilla</ToggleButton>
            <ToggleButton value="hybrasyl">Hybrasyl</ToggleButton>
          </ToggleButtonGroup>
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
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }
          }}
        />
        {!ids && (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={32} />
          </Box>
        )}
        {ids && (
          <List
            listRef={listRef}
            style={{ width: LIST_WIDTH, height: LIST_HEIGHT }}
            rowCount={filteredIds.length}
            rowHeight={ROW_HEIGHT}
            rowComponent={Row}
            rowProps={itemData}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
