import React, { useState, useEffect, useRef, useMemo } from 'react'
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
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import { Grid } from 'react-window'
import { useRecoilValue, useRecoilState } from 'recoil'
import { clientPathState, packCoverageState, creaturePickerModeState } from '../../recoil/atoms'
import { getCreatureSpriteIndex } from '../../data/creatureSpriteData'
import CreatureSpriteCanvas from './CreatureSpriteCanvas'

const COLS = 6
const CELL_SIZE = 144
const IMAGE_SIZE = 96
const GRID_H = 480

// ── Single grid cell ──────────────────────────────────────────────────────────

function SpriteCell({ columnIndex, rowIndex, style, ids, selectedId, onSelect, preferPack }) {
  const index = rowIndex * COLS + columnIndex
  if (index >= ids.length) return <div style={style} />
  const id = ids[index]
  const selected = id === selectedId

  return (
    <div style={style} onClick={() => onSelect(id)}>
      <Box
        sx={{
          width: CELL_SIZE,
          height: CELL_SIZE,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          gap: 0.5,
          borderRadius: 1,
          border: 2,
          borderColor: selected ? 'primary.main' : 'transparent',
          bgcolor: selected ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' }
        }}
      >
        <CreatureSpriteCanvas value={id} size={IMAGE_SIZE} animate={!preferPack} preferPack={preferPack} />
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', lineHeight: 1 }}>
          {id}
        </Typography>
      </Box>
    </div>
  )
}

// ── Dialog ────────────────────────────────────────────────────────────────────

export default function SpritePickerDialog({ open, value, onClose, onChange }) {
  const clientPath = useRecoilValue(clientPathState)
  const packCoverage = useRecoilValue(packCoverageState)
  const [mode, setMode] = useRecoilState(creaturePickerModeState)
  const [search, setSearch] = useState('')
  const [index, setIndex] = useState(null) // null = loading, { ids } = ready
  const [loadError, setLoadError] = useState(null)
  const gridRef = useRef(null)

  const packHasType = (packCoverage.creature?.length ?? 0) > 0
  const effectiveMode = packHasType ? mode : 'vanilla'
  const preferPack = effectiveMode === 'hybrasyl'

  // Load index when dialog opens (cached internally so re-open is instant).
  useEffect(() => {
    if (!open || !clientPath) return
    let cancelled = false
    setIndex(null)
    setLoadError(null)
    getCreatureSpriteIndex(clientPath)
      .then((result) => {
        if (!cancelled) setIndex(result)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || String(err))
      })
    return () => {
      cancelled = true
    }
  }, [open, clientPath])

  // Base list: vanilla hades.dat creature ids, plus (in Hybrasyl mode) any
  // pack-only creature ids the vanilla archive doesn't have.
  const allIds = useMemo(() => {
    const base = index?.ids || []
    if (!preferPack || !packHasType) return base
    const merged = new Set(base)
    for (const id of packCoverage.creature || []) merged.add(id)
    return Array.from(merged).sort((a, b) => a - b)
  }, [index, preferPack, packHasType, packCoverage])

  const filteredIds = useMemo(() => {
    if (!index) return []
    const q = search.trim()
    if (!q) return allIds
    return allIds.filter((id) => String(id).includes(q))
  }, [index, allIds, search])

  const selectedId = useMemo(() => {
    const n = Number(value)
    return Number.isFinite(n) && n >= 1 ? n : null
  }, [value])

  // Scroll to selected item when dialog opens
  useEffect(() => {
    if (!open || !selectedId || !gridRef.current || filteredIds.length === 0) return
    const idx = filteredIds.indexOf(selectedId)
    if (idx < 0) return
    gridRef.current.scrollToCell({
      columnIndex: idx % COLS,
      rowIndex: Math.floor(idx / COLS),
      columnAlign: 'smart',
      rowAlign: 'smart'
    })
  }, [open, selectedId, filteredIds])

  const cellData = useMemo(
    () => ({ ids: filteredIds, selectedId, onSelect: onChange, preferPack }),
    [filteredIds, selectedId, onChange, preferPack]
  )
  const rowCount = Math.ceil(filteredIds.length / COLS)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      slotProps={{
        paper: { sx: { overflowX: 'hidden' } }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', py: 1.6 }}>
        Creature Sprites
        {index && (
          <Typography variant="caption" sx={{ ml: 1.5, color: 'text.secondary' }}>
            ({allIds.length.toLocaleString()} shown)
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
      <DialogContent sx={{ p: 1, pt: '8px !important', overflowX: 'hidden' }}>
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
        {!clientPath && (
          <Box sx={{ p: 2, color: 'text.secondary' }}>
            <Typography variant="body2">
              Set the Dark Ages client path in Settings to browse creature sprites.
            </Typography>
          </Box>
        )}
        {clientPath && loadError && (
          <Box sx={{ p: 2, color: 'error.main' }}>
            <Typography variant="body2">Failed to load creature sprites: {loadError}</Typography>
          </Box>
        )}
        {clientPath && !loadError && !index && (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={32} />
          </Box>
        )}
        {clientPath && !loadError && index && (
          <Grid
            gridRef={gridRef}
            columnCount={COLS}
            rowCount={rowCount}
            columnWidth={CELL_SIZE}
            rowHeight={CELL_SIZE}
            style={{ width: COLS * CELL_SIZE + 17, height: GRID_H }}
            cellComponent={SpriteCell}
            cellProps={cellData}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
