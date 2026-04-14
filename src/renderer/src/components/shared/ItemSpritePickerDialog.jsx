import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent,
  TextField, Box, Typography, IconButton, InputAdornment, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { FixedSizeGrid } from 'react-window';
import { useRecoilValue } from 'recoil';
import { clientPathState } from '../../recoil/atoms';
import { getItemSpriteIndex } from '../../data/itemSpriteData';
import ItemSpriteCanvas from './ItemSpriteCanvas';

const COLS       = 8;
const CELL_SIZE  = 96;
const IMAGE_SIZE = 64;
const GRID_H     = 480;

// ── Single grid cell ──────────────────────────────────────────────────────────

function SpriteCell({ columnIndex, rowIndex, style, data }) {
  const { ids, selectedId, onSelect } = data;
  const index = rowIndex * COLS + columnIndex;
  if (index >= ids.length) return <div style={style} />;
  const id = ids[index];
  const selected = id === selectedId;

  return (
    <div style={style} onClick={() => onSelect(id)}>
      <Box
        sx={{
          width: CELL_SIZE, height: CELL_SIZE,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', gap: 0.25, borderRadius: 1, border: 2,
          borderColor: selected ? 'primary.main' : 'transparent',
          bgcolor: selected ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' },
        }}
      >
        <ItemSpriteCanvas value={id} size={IMAGE_SIZE} />
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1 }}>
          {id}
        </Typography>
      </Box>
    </div>
  );
}

// ── Dialog ────────────────────────────────────────────────────────────────────

export default function ItemSpritePickerDialog({ open, value, onClose, onChange }) {
  const clientPath = useRecoilValue(clientPathState);
  const [search, setSearch] = useState('');
  const [index, setIndex] = useState(null); // null = loading, { total, visibleIds } = ready
  const [loadError, setLoadError] = useState(null);
  const gridRef = useRef(null);

  // Load index when dialog opens (cached internally so re-open is instant).
  useEffect(() => {
    if (!open || !clientPath) return;
    let cancelled = false;
    setIndex(null);
    setLoadError(null);
    getItemSpriteIndex(clientPath)
      .then((result) => { if (!cancelled) setIndex(result); })
      .catch((err) => { if (!cancelled) setLoadError(err.message || String(err)); });
    return () => { cancelled = true; };
  }, [open, clientPath]);

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

  // Scroll to selected on open
  useEffect(() => {
    if (!open || !selectedId || !gridRef.current || filteredIds.length === 0) return;
    const idx = filteredIds.indexOf(selectedId);
    if (idx < 0) return;
    gridRef.current.scrollToItem({
      columnIndex: idx % COLS,
      rowIndex: Math.floor(idx / COLS),
      align: 'smart',
    });
  }, [open, selectedId, filteredIds]);

  const cellData = useMemo(
    () => ({ ids: filteredIds, selectedId, onSelect: onChange }),
    [filteredIds, selectedId, onChange]
  );
  const rowCount = Math.ceil(filteredIds.length / COLS);

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { overflowX: 'hidden' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', py: 1.6 }}>
        Item Sprites
        {index && (
          <Typography variant="caption" sx={{ ml: 1.5, color: 'text.secondary' }}>
            ({index.visibleIds.length.toLocaleString()} shown, {index.total.toLocaleString()} total)
          </Typography>
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
        {loadError && (
          <Box sx={{ p: 2, color: 'error.main' }}>
            <Typography variant="body2">Failed to load item sprites: {loadError}</Typography>
          </Box>
        )}
        {!loadError && !index && (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={32} />
          </Box>
        )}
        {!loadError && index && (
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
        )}
      </DialogContent>
    </Dialog>
  );
}
