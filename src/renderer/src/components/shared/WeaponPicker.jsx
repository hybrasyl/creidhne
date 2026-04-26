import React, { useMemo } from 'react'
import { Autocomplete, TextField, Box } from '@mui/material'
import { useRecoilValue } from 'recoil'
import { libraryIndexState } from '../../recoil/atoms'

// Sentinel option: lets the user explicitly acknowledge they're going custom
// (vs. just leaving the dropdown blank). Picking it is a no-op on min/max.
const CUSTOM_OPTION = { name: 'Custom', minDmg: '', maxDmg: '', __custom: true }

/**
 * Composite picker over a min/max damage pair, with optional preset selection
 * from the user's `weapons` constants list.
 *
 * The dropdown is a UI hint only — only `minDmg` and `maxDmg` get persisted.
 * Selecting a weapon prepopulates min/max; editing min/max directly causes
 * the dropdown to fall back to 'Custom' (no match in the list).
 */
export default function WeaponPicker({ minDmg, maxDmg, onMinDmgChange, onMaxDmgChange }) {
  const libraryIndex = useRecoilValue(libraryIndexState)
  const weapons = libraryIndex.weapons || []

  const options = useMemo(() => [...weapons, CUSTOM_OPTION], [weapons])

  // Derive selection from the current damage pair: match a weapon entry
  // exactly, else 'Custom' once anything's been entered, else nothing.
  const selected = useMemo(() => {
    if (!minDmg && !maxDmg) return null
    const match = weapons.find(
      (w) =>
        String(w.minDmg ?? '') === String(minDmg ?? '') &&
        String(w.maxDmg ?? '') === String(maxDmg ?? '')
    )
    return match || CUSTOM_OPTION
  }, [weapons, minDmg, maxDmg])

  const handleSelect = (_, val) => {
    if (!val) {
      onMinDmgChange('')
      onMaxDmgChange('')
      return
    }
    if (val.__custom) return
    onMinDmgChange(val.minDmg ?? '')
    onMaxDmgChange(val.maxDmg ?? '')
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      <Autocomplete
        options={options}
        value={selected}
        onChange={handleSelect}
        getOptionLabel={(opt) => opt?.name || ''}
        isOptionEqualToValue={(a, b) => a.name === b.name}
        size="small"
        sx={{ minWidth: 180 }}
        renderInput={(params) => <TextField {...params} label="Weapon" />}
      />
      <TextField
        label="Min Damage"
        size="small"
        sx={{ width: 120 }}
        value={minDmg}
        onChange={(e) => onMinDmgChange(e.target.value)}
        slotProps={{
          htmlInput: { maxLength: 32 }
        }}
      />
      <TextField
        label="Max Damage"
        size="small"
        sx={{ width: 120 }}
        value={maxDmg}
        onChange={(e) => onMaxDmgChange(e.target.value)}
        slotProps={{
          htmlInput: { maxLength: 32 }
        }}
      />
    </Box>
  )
}
