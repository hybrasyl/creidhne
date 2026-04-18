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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import { Grid } from 'react-window'
import { useRecoilValue, useRecoilState } from 'recoil'
import {
  clientPathState,
  packCoverageState,
  nationCrestPickerModeState
} from '../../recoil/atoms'
import {
  useNationCrestIndex,
  getAvailableCrestPalettes,
  DEFAULT_CREST_PALETTE
} from '../../data/nationCrestData'
import NationCrestCanvas from './NationCrestCanvas'

const COLS = 5
const CELL_SIZE = 136
const IMAGE_SIZE = 112
const GRID_H = 520

function Cell({
  columnIndex,
  rowIndex,
  style,
  ids,
  selectedId,
  onSelect,
  paletteOverride,
  preferPack
}) {
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
        <NationCrestCanvas
          flagNum={id}
          size={IMAGE_SIZE}
          paletteOverride={paletteOverride}
          preferPack={preferPack}
        />
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1 }}>
          {id}
        </Typography>
      </Box>
    </div>
  )
}

export default function NationCrestPickerDialog({ open, value, onClose, onChange }) {
  const clientPath = useRecoilValue(clientPathState)
  const index = useNationCrestIndex()
  const packCoverage = useRecoilValue(packCoverageState)
  const [mode, setMode] = useRecoilState(nationCrestPickerModeState)
  const [search, setSearch] = useState('')
  const [palettes, setPalettes] = useState(null)
  const [paletteKey, setPaletteKey] = useState(null) // 'pattern|number' string
  const gridRef = useRef(null)

  const packHasType = (packCoverage.nation?.length ?? 0) > 0
  const effectiveMode = packHasType ? mode : 'vanilla'
  const preferPack = effectiveMode === 'hybrasyl'

  useEffect(() => {
    if (!open || !clientPath) return undefined
    let cancelled = false
    getAvailableCrestPalettes(clientPath)
      .then((list) => {
        if (cancelled) return
        setPalettes(list)
        if (paletteKey == null && list.length) {
          const def = list.find(
            (p) =>
              p.pattern === DEFAULT_CREST_PALETTE.pattern &&
              p.number === DEFAULT_CREST_PALETTE.number
          )
          setPaletteKey((def || list[0]).label)
        }
      })
      .catch(() => {
        if (!cancelled) setPalettes([])
      })
    return () => {
      cancelled = true
    }
  }, [open, clientPath]) // eslint-disable-line react-hooks/exhaustive-deps

  const paletteOverride = useMemo(() => {
    if (!palettes || !paletteKey) return undefined
    const p = palettes.find((e) => e.label === paletteKey)
    return p ? { pattern: p.pattern, number: p.number } : undefined
  }, [palettes, paletteKey])

  const filteredIds = useMemo(() => {
    if (!index) return []
    let baseIds = index.visibleIds
    if (preferPack && packHasType) {
      const merged = new Set(index.visibleIds)
      for (const id of packCoverage.nation || []) merged.add(id)
      baseIds = Array.from(merged).sort((a, b) => a - b)
    }
    const q = search.trim()
    if (!q) return baseIds
    return baseIds.filter((id) => String(id).includes(q))
  }, [index, search, preferPack, packHasType, packCoverage])

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
    () => ({ ids: filteredIds, selectedId, onSelect: onChange, paletteOverride, preferPack }),
    [filteredIds, selectedId, onChange, paletteOverride, preferPack]
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
        Nation Flags
        {index && (
          <Typography variant="caption" sx={{ ml: 1.5, color: 'text.secondary' }}>
            ({filteredIds.length} of {index.total} frames)
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
        {palettes && palettes.length > 0 && (
          <FormControl size="small" sx={{ ml: 2, minWidth: 140 }}>
            <InputLabel>Palette</InputLabel>
            <Select
              label="Palette"
              value={paletteKey ?? ''}
              onChange={(e) => setPaletteKey(e.target.value)}
            >
              {palettes.map((p) => (
                <MenuItem key={p.label} value={p.label}>
                  {p.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
        {!index && (
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
  );
}
