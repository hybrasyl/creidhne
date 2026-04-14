import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, TextField, Box, Typography,
  IconButton, InputAdornment, CircularProgress,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { FixedSizeGrid } from 'react-window';
import { useRecoilValue } from 'recoil';
import { clientPathState } from '../../recoil/atoms';
import { useIconIndex, getAvailableIconPaletteNumbers, ICON_PALETTE_NUMBER } from '../../data/iconData';
import IconCanvas from './IconCanvas';

const COLS       = 10;
const CELL_SIZE  = 64;
const IMAGE_SIZE = 40; // icons are 31×31 native; 40 gives a little padding
const GRID_H     = 520;

function Cell({ columnIndex, rowIndex, style, data }) {
  const { ids, selectedId, onSelect, type, paletteNumber } = data;
  const index = rowIndex * COLS + columnIndex;
  if (index >= ids.length) return <div style={style} />;
  const id = ids[index];
  const selected = id === selectedId;

  return (
    <div style={style} onClick={() => onSelect(id)}>
      <Box sx={{
        width: CELL_SIZE, height: CELL_SIZE,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', gap: 0.25, borderRadius: 1, border: 2,
        borderColor: selected ? 'primary.main' : 'transparent',
        bgcolor: selected ? 'action.selected' : 'transparent',
        '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' },
      }}>
        <IconCanvas type={type} id={id} size={IMAGE_SIZE} paletteNumber={paletteNumber} />
        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1 }}>{id}</Typography>
      </Box>
    </div>
  );
}

export default function IconPickerDialog({ open, type, value, onClose, onChange }) {
  const index = useIconIndex(type);
  const clientPath = useRecoilValue(clientPathState);
  const [search, setSearch] = useState('');
  const [paletteNumbers, setPaletteNumbers] = useState(null);
  const [paletteNumber, setPaletteNumber] = useState(null); // null = use module default
  const gridRef = useRef(null);

  // Load available palette numbers for the picker once the dialog opens.
  useEffect(() => {
    if (!open || !clientPath) return undefined;
    let cancelled = false;
    getAvailableIconPaletteNumbers(clientPath)
      .then((nums) => {
        if (cancelled) return;
        setPaletteNumbers(nums);
        if (paletteNumber == null && nums.length) {
          // Default to the module's committed ICON_PALETTE_NUMBER if present, else first available.
          setPaletteNumber(nums.includes(ICON_PALETTE_NUMBER) ? ICON_PALETTE_NUMBER : nums[0]);
        }
      })
      .catch(() => { if (!cancelled) setPaletteNumbers([]); });
    return () => { cancelled = true; };
  }, [open, clientPath]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredIds = useMemo(() => {
    if (!index) return [];
    const q = search.trim();
    if (!q) return index.visibleIds;
    return index.visibleIds.filter((id) => String(id).includes(q));
  }, [index, search]);

  const selectedId = useMemo(() => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? n : null;
  }, [value]);

  useEffect(() => {
    if (!open || selectedId == null || !gridRef.current || filteredIds.length === 0) return;
    const idx = filteredIds.indexOf(selectedId);
    if (idx < 0) return;
    gridRef.current.scrollToItem({
      columnIndex: idx % COLS,
      rowIndex: Math.floor(idx / COLS),
      align: 'smart',
    });
  }, [open, selectedId, filteredIds]);

  const cellData = useMemo(
    () => ({ ids: filteredIds, selectedId, onSelect: onChange, type, paletteNumber }),
    [filteredIds, selectedId, onChange, type, paletteNumber]
  );
  const rowCount = Math.ceil(filteredIds.length / COLS);

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { overflowX: 'hidden' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', py: 1.6 }}>
        {type === 'spell' ? 'Spell Icons' : 'Skill Icons'}
        {index && (
          <Typography variant="caption" sx={{ ml: 1.5, color: 'text.secondary' }}>
            ({index.visibleIds.length.toLocaleString()} shown, {index.total.toLocaleString()} total)
          </Typography>
        )}
        {paletteNumbers && paletteNumbers.length > 0 && (
          <FormControl size="small" sx={{ ml: 2, minWidth: 110 }}>
            <InputLabel>Palette</InputLabel>
            <Select
              label="Palette"
              value={paletteNumber ?? ''}
              onChange={(e) => setPaletteNumber(Number(e.target.value))}
            >
              {paletteNumbers.map((n) => (
                <MenuItem key={n} value={n}>
                  gui{String(n).padStart(2, '0')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <IconButton size="small" onClick={onClose} sx={{ ml: 'auto' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 1, pt: '8px !important', overflowX: 'hidden', width: COLS * CELL_SIZE + 33 }}>
        <TextField
          size="small" fullWidth placeholder="Filter by number..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        {!index && (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={32} />
          </Box>
        )}
        {index && (
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
  );
}
