import React, { useMemo } from 'react'
import { Autocomplete, TextField, Box } from '@mui/material'
import { useRecoilValue } from 'recoil'
import { libraryIndexState } from '../../recoil/atoms'

// Sentinel: lets the user explicitly acknowledge "Custom" mode (vs. just
// leaving the dropdown blank). Picking it is a no-op on min/max.
const CUSTOM_OPTION = { name: 'Custom', minDmg: '', maxDmg: '', __custom: true }

/**
 * Composite picker over a min/max damage pair, with optional preset selection
 * from the index of weapon items.
 *
 * Source: libraryIndex.itemWeaponDamage (built by hybindex-ts when items
 * are scanned). Each entry has small + large damage values; in-game,
 * creature MinDmg/MaxDmg corresponds to the SMALL damage column (the
 * large column's runtime use isn't well-documented). The picker maps
 * smallMin/smallMax → creature minDmg/maxDmg on selection.
 *
 * Min/max damage are the only values serialized to XML — `weaponName` is
 * a UI hint persisted separately (e.g. as a `<!-- creidhne:meta -->`
 * comment) so the editor remembers which preset was chosen across reloads.
 *
 * Display rule:
 *   - If weaponName matches a list weapon AND its small damage equals
 *     the current min/max → show that weapon
 *   - If weaponName matches but min/max have diverged → show 'Custom'
 *   - If weaponName === 'Custom' or is set but unmatched → show 'Custom'
 *   - If weaponName is empty → derive from min/max match against the list
 */
export default function WeaponPicker({
  weaponName = '',
  minDmg,
  maxDmg,
  onWeaponNameChange,
  onMinDmgChange,
  onMaxDmgChange
}) {
  const libraryIndex = useRecoilValue(libraryIndexState)
  const itemWeaponDamage = libraryIndex.itemWeaponDamage || {}

  // Materialise itemWeaponDamage into a list of { name, minDmg, maxDmg }
  // using only the small-damage column. Sorted by name for predictable UX.
  const weapons = useMemo(
    () =>
      Object.entries(itemWeaponDamage)
        .map(([name, d]) => ({
          name,
          minDmg: String(d.smallMin ?? ''),
          maxDmg: String(d.smallMax ?? '')
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [itemWeaponDamage]
  )

  const options = useMemo(() => [...weapons, CUSTOM_OPTION], [weapons])

  const selected = useMemo(() => {
    if (weaponName) {
      const byName = weapons.find((w) => w.name === weaponName)
      if (byName) {
        const matches =
          String(byName.minDmg ?? '') === String(minDmg ?? '') &&
          String(byName.maxDmg ?? '') === String(maxDmg ?? '')
        return matches ? byName : CUSTOM_OPTION
      }
      return CUSTOM_OPTION
    }
    if (!minDmg && !maxDmg) return null
    const byDamage = weapons.find(
      (w) =>
        String(w.minDmg ?? '') === String(minDmg ?? '') &&
        String(w.maxDmg ?? '') === String(maxDmg ?? '')
    )
    return byDamage || CUSTOM_OPTION
  }, [weaponName, weapons, minDmg, maxDmg])

  const handleSelect = (_, val) => {
    if (!val) {
      onWeaponNameChange?.('')
      onMinDmgChange('')
      onMaxDmgChange('')
      return
    }
    if (val.__custom) {
      onWeaponNameChange?.(CUSTOM_OPTION.name)
      return
    }
    onWeaponNameChange?.(val.name)
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
