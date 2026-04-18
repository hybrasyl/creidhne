import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Chip,
  CircularProgress
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useRecoilValue } from 'recoil'
import { activeLibraryState } from '../../recoil/atoms'

const CATEGORY_COLORS = {
  damage: 'error',
  heal: 'success',
  conversion: 'secondary',
  shield: 'primary',
  stat: 'info',
  cast_cost: 'warning',
  general: 'default'
}

/**
 * Formula picker dialog.
 *
 * Props:
 *   open        — bool
 *   onClose     — () => void
 *   onSelect    — ({ name, formula }) => void
 *   category    — optional filter (e.g. 'damage') — pre-filters but user can clear
 */
function FormulaPickerDialog({ open, onClose, onSelect, category }) {
  const activeLibrary = useRecoilValue(activeLibraryState)
  const [formulas, setFormulas] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [catFilter, setCatFilter] = useState(category || '')

  useEffect(() => {
    if (!open || !activeLibrary) return
    setLoading(true)
    setSearch('')
    setSelected(null)
    setCatFilter(category || '')
    window.electronAPI
      .loadFormulas(activeLibrary)
      .then((data) => setFormulas(data.formulas || []))
      .finally(() => setLoading(false))
  }, [open, activeLibrary, category])

  const filtered = formulas.filter((f) => {
    const matchCat = !catFilter || f.category === catFilter
    const matchSearch = !search.trim() || f.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const handleConfirm = () => {
    if (selected) onSelect(selected)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Pick Formula</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Filter by name..."
            sx={{ flex: 1 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />
          <TextField
            size="small"
            select
            label="Category"
            sx={{ width: 130 }}
            value={catFilter}
            onChange={(e) => {
              setCatFilter(e.target.value)
              setSelected(null)
            }}
            SelectProps={{ native: false, displayEmpty: true }}
            InputLabelProps={{ shrink: true }}
          >
            <option value="">All</option>
            {['damage', 'heal', 'conversion', 'shield', 'stat', 'cast_cost', 'general'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </TextField>
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No formulas found.
          </Typography>
        ) : (
          <List dense sx={{ maxHeight: 320, overflow: 'auto' }}>
            {filtered.map((f) => (
              <ListItemButton
                key={f.id}
                selected={selected?.id === f.id}
                onClick={() => setSelected(f)}
                onDoubleClick={() => {
                  setSelected(f)
                  onSelect(f)
                  onClose()
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">{f.name}</Typography>
                      <Chip
                        label={f.category || 'damage'}
                        size="small"
                        color={CATEGORY_COLORS[f.category] || 'default'}
                        sx={{ height: 16, fontSize: '0.65rem' }}
                      />
                    </Box>
                  }
                  secondary={
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
                    >
                      {f.formula}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!selected} onClick={handleConfirm}>
          Select
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default FormulaPickerDialog
