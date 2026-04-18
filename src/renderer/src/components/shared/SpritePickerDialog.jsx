import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Box,
  Typography,
  IconButton,
  InputAdornment
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import { FixedSizeGrid } from 'react-window'
import spriteMeta, { spriteUrl, keyFromSprite, frameDisplay } from '../../data/creatureSpriteData'

const COLS = 6
const CELL_SIZE = 144
const IMAGE_SIZE = 96
const GRID_H = 480

// ── Single grid cell ──────────────────────────────────────────────────────────

function SpriteCell({ columnIndex, rowIndex, style, data }) {
  const { entries, selectedKey, onSelect } = data
  const index = rowIndex * COLS + columnIndex
  if (index >= entries.length) return <div style={style} />

  const [key, meta] = entries[index]
  const [animIdx, setAnimIdx] = useState(null)
  const timerRef = useRef(null)

  // Reset animation when cell is recycled to a different sprite
  useEffect(() => {
    clearInterval(timerRef.current)
    setAnimIdx(null)
  }, [key])

  // Cleanup on unmount
  useEffect(() => () => clearInterval(timerRef.current), [])

  const handleMouseEnter = () => {
    if (!meta.use?.length) return
    setAnimIdx(0)
    let i = 0
    timerRef.current = setInterval(() => {
      i = (i + 1) % meta.use.length
      setAnimIdx(i)
    }, 200)
  }

  const handleMouseLeave = () => {
    clearInterval(timerRef.current)
    setAnimIdx(null)
  }

  const frameNum = animIdx !== null && meta.use?.length ? meta.use[animIdx] : (meta.still ?? 1)
  const { clipW, clipH, imgStyle } = frameDisplay(meta, frameNum, IMAGE_SIZE)

  return (
    <div
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelect(key)}
    >
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
          borderColor: key === selectedKey ? 'primary.main' : 'transparent',
          bgcolor: key === selectedKey ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: key === selectedKey ? 'action.selected' : 'action.hover' }
        }}
      >
        <Box
          sx={{
            width: IMAGE_SIZE,
            height: IMAGE_SIZE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Box sx={{ width: clipW, height: clipH, overflow: 'hidden', flexShrink: 0 }}>
            <img src={spriteUrl(key)} alt={key} draggable={false} style={imgStyle} />
          </Box>
        </Box>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', lineHeight: 1 }}>
          {parseInt(key.replace('monster', ''), 10)}
        </Typography>
      </Box>
    </div>
  )
}

// ── Dialog ────────────────────────────────────────────────────────────────────

export default function SpritePickerDialog({ open, value, onClose, onChange }) {
  const [search, setSearch] = useState('')
  const gridRef = useRef(null)

  const allEntries = useMemo(() => Object.entries(spriteMeta), [])

  const filtered = useMemo(() => {
    const q = search.trim()
    if (!q) return allEntries
    return allEntries.filter(([key]) => {
      const num = String(parseInt(key.replace('monster', ''), 10))
      return num.includes(q)
    })
  }, [allEntries, search])

  const selectedKey = useMemo(() => keyFromSprite(value), [value])

  // Scroll to selected item when dialog opens
  useEffect(() => {
    if (!open || !selectedKey || !gridRef.current) return
    const idx = filtered.findIndex(([k]) => k === selectedKey)
    if (idx < 0) return
    gridRef.current.scrollToItem({
      columnIndex: idx % COLS,
      rowIndex: Math.floor(idx / COLS),
      align: 'smart'
    })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const cellData = useMemo(
    () => ({ entries: filtered, selectedKey, onSelect: onChange }),
    [filtered, selectedKey, onChange]
  )
  const rowCount = Math.ceil(filtered.length / COLS)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{ sx: { overflowX: 'hidden' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', py: 1.6 }}>
        Creature Sprites
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
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <FixedSizeGrid
          ref={gridRef}
          columnCount={COLS}
          rowCount={rowCount}
          columnWidth={CELL_SIZE}
          rowHeight={CELL_SIZE}
          width={COLS * CELL_SIZE + 17}
          height={GRID_H}
          itemData={cellData}
        >
          {SpriteCell}
        </FixedSizeGrid>
      </DialogContent>
    </Dialog>
  )
}
