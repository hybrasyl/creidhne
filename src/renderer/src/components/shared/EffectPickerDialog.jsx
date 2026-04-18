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
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import { Grid } from 'react-window'
import { useRecoilValue } from 'recoil'
import { clientPathState } from '../../recoil/atoms'
import { useEffectIndex } from '../../data/effectData'
import EffectPreview from './EffectPreview'

const COLS = 6
const CELL_SIZE = 120
const IMAGE_SIZE = 88
const GRID_H = 500

function Cell({ columnIndex, rowIndex, style, ids, selectedId, onSelect, speed }) {
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
        <EffectPreview effectId={id} speed={speed} size={IMAGE_SIZE} playing />
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1 }}>
          {id}
        </Typography>
      </Box>
    </div>
  )
}

export default function EffectPickerDialog({ open, value, speed, onClose, onChange }) {
  const clientPath = useRecoilValue(clientPathState)
  const index = useEffectIndex()
  const [search, setSearch] = useState('')
  const gridRef = useRef(null)

  const filteredIds = useMemo(() => {
    if (!index) return []
    const q = search.trim()
    if (!q) return index.visibleIds
    return index.visibleIds.filter((id) => String(id).includes(q))
  }, [index, search])

  const selectedId = useMemo(() => {
    const n = Number(value)
    return Number.isFinite(n) && n >= 1 ? n : null
  }, [value])

  useEffect(() => {
    if (!open || selectedId == null || !gridRef.current || filteredIds.length === 0) return
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
    () => ({ ids: filteredIds, selectedId, onSelect: onChange, speed }),
    [filteredIds, selectedId, onChange, speed]
  )
  const rowCount = Math.ceil(filteredIds.length / COLS)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{ sx: { overflowX: 'hidden' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', py: 1.6 }}>
        Effects
        {index && (
          <Typography variant="caption" sx={{ ml: 1.5, color: 'text.secondary' }}>
            ({index.visibleIds.length.toLocaleString()} shown, {index.total.toLocaleString()} total)
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
        {!index && clientPath && (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={32} />
          </Box>
        )}
        {index && (
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
  )
}
