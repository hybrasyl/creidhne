import React, { useEffect, useRef, useState } from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'

const FADE_DELAY_MS = 800

const TYPE_LABELS = {
  castables: 'castables',
  creatures: 'creatures',
  creaturebehaviorsets: 'behavior sets',
  elementtables: 'element tables',
  items: 'items',
  localizations: 'localizations',
  lootsets: 'loot sets',
  maps: 'maps',
  nations: 'nations',
  npcs: 'NPCs',
  recipes: 'recipes',
  serverconfigs: 'server configs',
  spawngroups: 'spawn groups',
  statuses: 'statuses',
  variantgroups: 'variant groups',
  worldmaps: 'world maps'
}

/**
 * Compact top-left status pill pinned below the AppBar. Shows during index
 * builds (triggered by initial library load, manual rebuild, or post-save
 * partial); hides itself after the 'done' phase.
 */
export default function IndexBuildProgress() {
  const [progress, setProgress] = useState(null)
  const hideTimerRef = useRef(null)

  useEffect(() => {
    const unsubscribe = window.electronAPI.onIndexBuildProgress((event) => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
      if (event.phase === 'done') {
        hideTimerRef.current = setTimeout(() => setProgress(null), FADE_DELAY_MS)
      }
      setProgress(event)
    })
    return () => {
      unsubscribe()
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  if (!progress) return null

  const { phase, type, current, total } = progress
  const label =
    phase === 'done'
      ? 'Index complete'
      : phase === 'cross-ref'
        ? 'Building cross-references…'
        : type
          ? `Scanning ${TYPE_LABELS[type] ?? type}${current && total ? ` (${current}/${total})` : '…'}`
          : 'Building index…'

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 10,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        px: 1.25,
        py: 0.5,
        borderRadius: 1,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        boxShadow: 2,
        pointerEvents: 'none',
        maxWidth: 320
      }}
    >
      <CircularProgress size={14} thickness={5} />
      <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
    </Box>
  )
}
