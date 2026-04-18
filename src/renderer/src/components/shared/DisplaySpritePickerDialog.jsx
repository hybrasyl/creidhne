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
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import { FixedSizeGrid } from 'react-window'
import { useRecoilValue } from 'recoil'
import { clientPathState } from '../../recoil/atoms'
import { getAvailableDisplaySprites, CATEGORY_DEFAULTS } from '../../data/khanData'
import DisplaySpriteCanvas from './DisplaySpriteCanvas'

const POSES = ['01', '02', '03', 'b', 'c', 'd', 'e', 'f']
const FRAME_RANGE = Array.from({ length: 16 }, (_, i) => i)
const DIALOG_GLOBAL_DEFAULT = { pose: '03', frameIdx: 5 }

const COLS = 6
const CELL_SIZE = 132
const IMAGE_SIZE = 96
const GRID_H = 520

function Cell({ columnIndex, rowIndex, style, data }) {
  const { ids, selectedId, onSelect, category, gender, pose, frameIdx } = data
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
          gap: 0.25,
          borderRadius: 1,
          border: 2,
          borderColor: selected ? 'primary.main' : 'transparent',
          bgcolor: selected ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' }
        }}
      >
        <DisplaySpriteCanvas
          category={category}
          gender={gender}
          displaySprite={id}
          size={IMAGE_SIZE}
          pose={pose}
          frameIdx={frameIdx}
        />
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1 }}>
          {id}
        </Typography>
      </Box>
    </div>
  )
}

export default function DisplaySpritePickerDialog({ open, category, value, onClose, onChange }) {
  const clientPath = useRecoilValue(clientPathState)
  const [search, setSearch] = useState('')
  const [ids, setIds] = useState(null) // null = loading
  const [gender, setGender] = useState('M')
  // Per-category defaults seed the pose/frame controls; user can tweak on the
  // fly to discover the right "clean still" for a category. For multi-category
  // slots (e.g. Coat → [E, F]) use the first category's defaults.
  const firstCategory = Array.isArray(category) ? category[0] : category
  const catDefaults =
    CATEGORY_DEFAULTS[String(firstCategory || '').toUpperCase()] || DIALOG_GLOBAL_DEFAULT
  const [pose, setPose] = useState(catDefaults.pose)
  const [frameIdx, setFrameIdx] = useState(catDefaults.frameIdx)
  // Reset pose/frame whenever the category changes (dialog reopened for a
  // different slot).
  useEffect(() => {
    setPose(catDefaults.pose)
    setFrameIdx(catDefaults.frameIdx)
  }, [category]) // eslint-disable-line react-hooks/exhaustive-deps
  const gridRef = useRef(null)

  // Load available IDs for (category, gender). The union across genders is
  // usually identical, so we fetch per gender and cache in the data module.
  useEffect(() => {
    if (!open || !clientPath || !category) return undefined
    let cancelled = false
    setIds(null)
    getAvailableDisplaySprites(clientPath, category, gender)
      .then((list) => {
        if (!cancelled) setIds(list)
      })
      .catch(() => {
        if (!cancelled) setIds([])
      })
    return () => {
      cancelled = true
    }
  }, [open, clientPath, category, gender])

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
    if (!open || selectedId == null || !gridRef.current || filteredIds.length === 0) return
    const idx = filteredIds.indexOf(selectedId)
    if (idx < 0) return
    gridRef.current.scrollToItem({
      columnIndex: idx % COLS,
      rowIndex: Math.floor(idx / COLS),
      align: 'smart'
    })
  }, [open, selectedId, filteredIds])

  const cellData = useMemo(
    () => ({ ids: filteredIds, selectedId, onSelect: onChange, category, gender, pose, frameIdx }),
    [filteredIds, selectedId, onChange, category, gender, pose, frameIdx]
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
        Display Sprites
        {category && (
          <Typography variant="caption" sx={{ ml: 1.5, color: 'text.secondary' }}>
            (category {Array.isArray(category) ? category.join('+') : category}
            {ids ? `, ${ids.length.toLocaleString()} ids` : ''})
          </Typography>
        )}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={gender}
          onChange={(_, v) => v && setGender(v)}
          sx={{ ml: 2 }}
        >
          <ToggleButton value="M">Male</ToggleButton>
          <ToggleButton value="W">Female</ToggleButton>
        </ToggleButtonGroup>
        <FormControl size="small" sx={{ ml: 1.5, minWidth: 88 }}>
          <InputLabel>Pose</InputLabel>
          <Select label="Pose" value={pose} onChange={(e) => setPose(e.target.value)}>
            {POSES.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ ml: 1, minWidth: 92 }}>
          <InputLabel>Frame</InputLabel>
          <Select
            label="Frame"
            value={frameIdx}
            onChange={(e) => setFrameIdx(Number(e.target.value))}
          >
            {FRAME_RANGE.map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
        {!ids && (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={32} />
          </Box>
        )}
        {ids && (
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
            {Cell}
          </FixedSizeGrid>
        )}
      </DialogContent>
    </Dialog>
  )
}
