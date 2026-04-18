import React from 'react'
import { Box, Typography } from '@mui/material'
import { useRecoilValue } from 'recoil'
import { packCoverageState } from '../../recoil/atoms'
import IconCanvas from './IconCanvas'
import NationCrestCanvas from './NationCrestCanvas'
import { useIconIndex } from '../../data/iconData'
import { useNationCrestIndex } from '../../data/nationCrestData'

// Labeled vanilla/hybrasyl pair for the conflict (both-present) case.
function LabeledPair({ vanillaCanvas, hybrasylCanvas }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
        {vanillaCanvas}
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
          Vanilla
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
        {hybrasylCanvas}
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
          Hybrasyl
        </Typography>
      </Box>
    </Box>
  )
}

/**
 * Side-by-side vanilla + Hybrasyl render when BOTH sources cover the given id.
 * Single render when only one covers it. Keeps the editor display honest about
 * what the player actually sees after pack overrides resolve.
 *
 * Props:
 *   type          — 'spell' | 'skill' (ability icon)
 *   id            — numeric id (1-based)
 *   size          — edge in px (default 48)
 *   paletteNumber — optional palette override for the vanilla EPF render
 */
export function DualIconView({ type, id, size = 48, paletteNumber }) {
  const coverage = useRecoilValue(packCoverageState)
  const vanillaIndex = useIconIndex(type)

  const numId = Number(id)
  if (!Number.isFinite(numId) || numId < 1) {
    return <IconCanvas type={type} id={id} size={size} paletteNumber={paletteNumber} />
  }

  const vanillaIds = vanillaIndex?.visibleIds || []
  const packIds = coverage[type] || []
  const vanillaHas = vanillaIds.includes(numId)
  const packHas = packIds.includes(numId)

  if (vanillaHas && packHas) {
    return (
      <LabeledPair
        vanillaCanvas={
          <IconCanvas
            type={type}
            id={id}
            size={size}
            paletteNumber={paletteNumber}
            preferPack={false}
          />
        }
        hybrasylCanvas={
          <IconCanvas
            type={type}
            id={id}
            size={size}
            paletteNumber={paletteNumber}
            preferPack={true}
          />
        }
      />
    )
  }
  return (
    <IconCanvas
      type={type}
      id={id}
      size={size}
      paletteNumber={paletteNumber}
      preferPack={packHas}
    />
  )
}

/**
 * Sister component for nation crests. Same conflict-only-side-by-side rule.
 *
 * Props:
 *   flagNum         — 1-based flag number
 *   size            — edge in px (default 80)
 *   paletteOverride — optional { pattern, number } for the vanilla EPF render
 */
export function DualNationCrestView({ flagNum, size = 80, paletteOverride }) {
  const coverage = useRecoilValue(packCoverageState)
  const vanillaIndex = useNationCrestIndex()

  const numId = Number(flagNum)
  if (!Number.isFinite(numId) || numId < 1) {
    return <NationCrestCanvas flagNum={flagNum} size={size} paletteOverride={paletteOverride} />
  }

  const vanillaIds = vanillaIndex?.visibleIds || []
  const packIds = coverage.nation || []
  const vanillaHas = vanillaIds.includes(numId)
  const packHas = packIds.includes(numId)

  if (vanillaHas && packHas) {
    return (
      <LabeledPair
        vanillaCanvas={
          <NationCrestCanvas
            flagNum={flagNum}
            size={size}
            paletteOverride={paletteOverride}
            preferPack={false}
          />
        }
        hybrasylCanvas={
          <NationCrestCanvas
            flagNum={flagNum}
            size={size}
            paletteOverride={paletteOverride}
            preferPack={true}
          />
        }
      />
    )
  }
  return (
    <NationCrestCanvas
      flagNum={flagNum}
      size={size}
      paletteOverride={paletteOverride}
      preferPack={packHas}
    />
  )
}
