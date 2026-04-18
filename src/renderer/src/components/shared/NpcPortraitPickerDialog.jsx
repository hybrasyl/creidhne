import React, { useState, useEffect, useMemo, useRef } from 'react'
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
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import { Grid } from 'react-window'
import { useNpcPortraitIndex } from '../../data/npcPortraitData'
import NpcPortraitCanvas from './NpcPortraitCanvas'

const COLS = 5
const CELL_SIZE = 140
const IMAGE_SIZE = 96
const GRID_H = 520

function Cell({ columnIndex, rowIndex, style, names, selectedName, onSelect }) {
  const index = rowIndex * COLS + columnIndex
  if (index >= names.length) return <div style={style} />
  const name = names[index]
  const selected = name === selectedName

  return (
    <div style={style} onClick={() => onSelect(name)}>
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
        <NpcPortraitCanvas filename={name} size={IMAGE_SIZE} />
        <Typography
          sx={{
            fontSize: '0.72rem',
            color: 'text.secondary',
            lineHeight: 1,
            textAlign: 'center',
            px: 0.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: '100%'
          }}
        >
          {name}
        </Typography>
      </Box>
    </div>
  )
}

export default function NpcPortraitPickerDialog({ open, value, onClose, onChange }) {
  const names = useNpcPortraitIndex()
  const [search, setSearch] = useState('')
  const gridRef = useRef(null)

  const filteredNames = useMemo(() => {
    if (!names) return []
    const q = search.trim().toLowerCase()
    if (!q) return names
    return names.filter((n) => n.toLowerCase().includes(q))
  }, [names, search])

  useEffect(() => {
    if (!open || !value || !gridRef.current || filteredNames.length === 0) return
    const idx = filteredNames.indexOf(value)
    if (idx < 0) return
    gridRef.current.scrollToCell({
      columnIndex: idx % COLS,
      rowIndex: Math.floor(idx / COLS),
      columnAlign: 'smart',
      rowAlign: 'smart'
    })
  }, [open, value, filteredNames])

  const cellData = useMemo(
    () => ({ names: filteredNames, selectedName: value, onSelect: onChange }),
    [filteredNames, value, onChange]
  )
  const rowCount = Math.ceil(filteredNames.length / COLS)

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
        NPC Portraits
        {names && (
          <Typography variant="caption" sx={{ ml: 1.5, color: 'text.secondary' }}>
            ({names.length.toLocaleString()} total)
          </Typography>
        )}
        <IconButton size="small" onClick={onClose} sx={{ ml: 'auto' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{ p: 1, pt: '8px !important', overflowX: 'hidden', width: COLS * CELL_SIZE + 33 }}
      >
        <TextField
          size="small"
          fullWidth
          placeholder="Filter by name..."
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
        {!names && (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={32} />
          </Box>
        )}
        {names && (
          <Grid
            gridRef={gridRef}
            columnCount={COLS}
            rowCount={rowCount}
            columnWidth={CELL_SIZE}
            rowHeight={CELL_SIZE}
            style={{ width: COLS * CELL_SIZE + 17, height: GRID_H }}
            cellComponent={Cell}
            cellProps={cellData}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
