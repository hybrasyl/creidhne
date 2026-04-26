import React, { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  Divider,
  Stack,
  CircularProgress,
  Button,
  Tooltip
} from '@mui/material'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import BuildIcon from '@mui/icons-material/Build'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useRecoilValue, useRecoilState } from 'recoil'
import {
  activeLibraryState,
  libraryIndexState,
  currentPageState,
  taliesinPathState
} from '../recoil/atoms'
import { useLibraryIndexHydration } from '../hooks/useLibraryIndexHydration'

const INDEX_TYPES = [
  { key: 'items', label: 'Items', page: 'items' },
  { key: 'castables', label: 'Castables', page: 'castables' },
  { key: 'statuses', label: 'Statuses', page: 'statuses' },
  { key: 'creatures', label: 'Creatures', page: 'creatures' },
  { key: 'npcs', label: 'NPCs', page: 'npcs' },
  { key: 'nations', label: 'Nations', page: 'nations' },
  { key: 'spawngroups', label: 'Spawn Groups', page: 'spawngroups' },
  { key: 'lootsets', label: 'Loot Sets', page: 'loot' },
  { key: 'recipes', label: 'Recipes', page: 'recipes' },
  { key: 'variantgroups', label: 'Variant Groups', page: 'variants' },
  { key: 'creaturebehaviorsets', label: 'Behavior Sets', page: 'behaviors' },
  { key: 'elementtables', label: 'Element Tables', page: 'elements' },
  { key: 'localizations', label: 'Localizations', page: 'strings' },
  { key: 'serverconfigs', label: 'Server Configs', page: 'serverconfig' },
  { key: 'scripts', label: 'Scripts', page: null, tooltip: 'Coming Soon!' },
  { key: 'maps', label: 'Maps', page: null, launch: 'taliesin' },
  { key: 'worldmaps', label: 'World Maps', page: null, launch: 'taliesin' }
]

function getFolderName(fullPath) {
  const parts = fullPath.replace(/\\/g, '/').split('/').filter(Boolean)
  const worldIdx = parts.findIndex((p) => p.toLowerCase() === 'world')
  if (worldIdx > 0) return parts[worldIdx - 1]
  return parts.pop() ?? fullPath
}

// Per-entity count card (lower grid). Click navigates to the editor or
// launches the companion app via the optional onLaunch handler.
function StatCard({ label, count, page, tooltip, onNavigate, onLaunch }) {
  const interactive = !!page || !!onLaunch
  const content = (
    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
      <Typography
        variant="h5"
        color={interactive ? 'primary.light' : 'text.primary'}
        sx={{ fontWeight: 'bold' }}
      >
        {count.toLocaleString()}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
    </CardContent>
  )

  const card = (
    <Card variant="outlined" sx={{ height: '100%' }}>
      {page ? (
        <CardActionArea onClick={() => onNavigate(page)} sx={{ height: '100%' }}>
          {content}
        </CardActionArea>
      ) : onLaunch ? (
        <CardActionArea onClick={onLaunch} sx={{ height: '100%' }}>
          {content}
        </CardActionArea>
      ) : (
        content
      )}
    </Card>
  )

  return tooltip ? (
    <Tooltip title={tooltip} placement="top">
      {card}
    </Tooltip>
  ) : (
    card
  )
}

// Top-row status card. Shows an icon + label header, then either the
// configured value (primary + secondary) or a "Not configured" empty
// state. If `footer` is set the whole-card CardActionArea is suppressed
// so the footer's inner control can receive clicks.
function StatusCard({ icon, label, primary, secondary, emptyHint, onClick, footer }) {
  const body = (
    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
        <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
        <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1 }}>
          {label}
        </Typography>
      </Stack>
      {primary ? (
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 'medium', lineHeight: 1.25 }}>
            {primary}
          </Typography>
          {secondary && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                wordBreak: 'break-all',
                display: 'block',
                mt: 0.25
              }}
            >
              {secondary}
            </Typography>
          )}
        </>
      ) : (
        <>
          <Typography
            variant="subtitle1"
            sx={{ fontStyle: 'italic', color: 'text.secondary', lineHeight: 1.25 }}
          >
            Not configured
          </Typography>
          {emptyHint && (
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}
            >
              {emptyHint}
            </Typography>
          )}
        </>
      )}
      {footer && <Box sx={{ mt: 1.25 }}>{footer}</Box>}
    </CardContent>
  )

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      {onClick && !footer ? (
        <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
          {body}
        </CardActionArea>
      ) : (
        body
      )}
    </Card>
  )
}

function DashboardPage() {
  const activeLibrary = useRecoilValue(activeLibraryState)
  const libraryIndex = useRecoilValue(libraryIndexState)
  const [, setCurrentPage] = useRecoilState(currentPageState)
  const taliesinPath = useRecoilValue(taliesinPathState)
  const [rebuilding, setRebuilding] = useState(false)
  const hydrateLibraryIndex = useLibraryIndexHydration()

  const hasIndex = !!libraryIndex.builtAt
  const builtAt = hasIndex ? new Date(libraryIndex.builtAt) : null
  const folderName = activeLibrary ? getFolderName(activeLibrary) : null

  const handleRebuildIndex = async () => {
    setRebuilding(true)
    try {
      await window.electronAPI.buildIndex(activeLibrary)
      await hydrateLibraryIndex(activeLibrary)
    } finally {
      setRebuilding(false)
    }
  }

  const handleLaunchTaliesin = async () => {
    if (!taliesinPath) return
    await window.electronAPI.launchCompanion(taliesinPath)
  }

  const indexFooter = activeLibrary ? (
    <Stack direction="row" spacing={1} alignItems="center">
      <Button
        size="small"
        variant="outlined"
        startIcon={
          rebuilding ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon fontSize="small" />
        }
        onClick={handleRebuildIndex}
        disabled={rebuilding}
      >
        {hasIndex ? 'Rebuild' : 'Build Index'}
      </Button>
    </Stack>
  ) : null

  return (
    <Box sx={{ height: '100%', overflow: 'auto', px: 0.5 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
        Dashboard
      </Typography>
      <Divider sx={{ mb: 3 }} />

      {/* Top row — status cards */}
      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <StatusCard
            icon={<FolderOpenIcon fontSize="small" />}
            label="Active Library"
            primary={folderName}
            secondary={activeLibrary}
            emptyHint="Click to open Settings and add a library"
            onClick={!activeLibrary ? () => setCurrentPage('settings') : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <StatusCard
            icon={<BuildIcon fontSize="small" />}
            label="Index"
            primary={
              hasIndex
                ? `Built ${builtAt.toLocaleDateString()} ${builtAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : null
            }
            emptyHint={
              activeLibrary
                ? 'Build an index to enable autocomplete and see counts here.'
                : 'Configure a library first.'
            }
            footer={indexFooter}
          />
        </Grid>
      </Grid>

      {/* Per-entity counts */}
      {hasIndex && (
        <Grid container spacing={1.5}>
          {INDEX_TYPES.map(({ key, label, page, tooltip, launch }) => {
            const arr = libraryIndex[key]
            if (!arr) return null
            let cardTooltip = tooltip
            let onLaunch
            if (launch === 'taliesin') {
              if (taliesinPath) {
                onLaunch = handleLaunchTaliesin
                cardTooltip = 'Open in Taliesin'
              } else {
                cardTooltip = 'Set Taliesin path in Settings to enable'
              }
            }
            return (
              <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={key}>
                <StatCard
                  label={label}
                  count={arr.length}
                  page={page}
                  tooltip={cardTooltip}
                  onNavigate={setCurrentPage}
                  onLaunch={onLaunch}
                />
              </Grid>
            )
          })}
        </Grid>
      )}
    </Box>
  )
}

export default DashboardPage
