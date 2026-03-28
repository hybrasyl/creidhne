import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, CardActionArea, Grid, Chip, Divider, Alert,
  IconButton, Tooltip, CircularProgress, Button,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import BuildIcon from '@mui/icons-material/Build';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import HistoryIcon from '@mui/icons-material/History';
import { useRecoilValue, useRecoilState } from 'recoil';
import { activeLibraryState, libraryIndexState, currentPageState, recentPagesState } from '../recoil/atoms';

const INDEX_TYPES = [
  { key: 'items',                label: 'Items',           page: 'items' },
  { key: 'castables',            label: 'Castables',       page: 'castables' },
  { key: 'statuses',             label: 'Statuses',        page: 'statuses' },
  { key: 'creatures',            label: 'Creatures',       page: 'creatures' },
  { key: 'npcs',                 label: 'NPCs',            page: 'npcs' },
  { key: 'nations',              label: 'Nations',         page: 'nations' },
  { key: 'spawngroups',          label: 'Spawn Groups',    page: 'spawngroups' },
  { key: 'lootsets',             label: 'Loot Sets',       page: 'loot' },
  { key: 'recipes',              label: 'Recipes',         page: 'recipes' },
  { key: 'variantgroups',        label: 'Variant Groups',  page: 'variants' },
  { key: 'creaturebehaviorsets', label: 'Behavior Sets',   page: 'behaviors' },
  { key: 'elementtables',        label: 'Element Tables',  page: 'elements' },
  { key: 'localizations',        label: 'Localizations',   page: 'strings' },
  { key: 'serverconfigs',        label: 'Server Configs',  page: null },
  { key: 'scripts',              label: 'Scripts',         page: null },
  { key: 'maps',                 label: 'Maps',            page: null, tooltip: 'Managed by Taliesin' },
  { key: 'worldmaps',            label: 'World Maps',      page: null, tooltip: 'Managed by Taliesin' },
];

const PAGE_LABELS = {
  castables: 'Castables', items: 'Items', statuses: 'Statuses', npcs: 'NPCs',
  creatures: 'Creatures', behaviors: 'Behavior Sets', nations: 'Nations',
  spawngroups: 'Spawn Groups', loot: 'Loot Sets', variants: 'Variants',
  elements: 'Elements', recipes: 'Recipes', strings: 'Strings',
  worldmap: 'World Map', maps: 'Maps', serverconfig: 'Server Config',
  formulas: 'Formulas', helpers: 'Lua Helpers', constants: 'Constants',
  settings: 'Settings',
};

function getFolderName(fullPath) {
  const parts = fullPath.replace(/\\/g, '/').split('/').filter(Boolean);
  const worldIdx = parts.findIndex((p) => p.toLowerCase() === 'world');
  if (worldIdx > 0) return parts[worldIdx - 1];
  return parts.pop() ?? fullPath;
}

function StatCard({ label, count, page, tooltip, onNavigate }) {
  const content = (
    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
      <Typography variant="h5" fontWeight="bold" color={page ? 'primary' : 'text.primary'}>
        {count.toLocaleString()}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </CardContent>
  );

  const card = (
    <Card variant="outlined" sx={{ height: '100%' }}>
      {page ? (
        <CardActionArea onClick={() => onNavigate(page)} sx={{ height: '100%' }}>
          {content}
        </CardActionArea>
      ) : content}
    </Card>
  );

  return tooltip ? <Tooltip title={tooltip} placement="top">{card}</Tooltip> : card;
}

function DashboardPage() {
  const activeLibrary = useRecoilValue(activeLibraryState);
  const [libraryIndex, setLibraryIndex] = useRecoilState(libraryIndexState);
  const [, setCurrentPage] = useRecoilState(currentPageState);
  const recentPages = useRecoilValue(recentPagesState);
  const [rebuilding, setRebuilding] = useState(false);

  const hasIndex = !!libraryIndex.builtAt;
  const builtAt = hasIndex ? new Date(libraryIndex.builtAt) : null;
  const folderName = activeLibrary ? getFolderName(activeLibrary) : null;

  const handleRebuildIndex = async () => {
    setRebuilding(true);
    try {
      await window.electronAPI.buildIndex(activeLibrary);
      const index = await window.electronAPI.loadIndex(activeLibrary);
      setLibraryIndex(index || {});
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Dashboard
      </Typography>

      <Divider sx={{ mb: 3 }} />

      {/* Active Library */}
      {activeLibrary ? (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 3 }}>
          <FolderOpenIcon color="action" sx={{ mt: 0.25 }} />
          <Box>
            <Typography variant="overline" color="text.secondary" lineHeight={1}>
              Active Library
            </Typography>
            <Typography variant="subtitle1" fontWeight="medium" sx={{ mt: 0.25 }}>
              {folderName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
              {activeLibrary}
            </Typography>
          </Box>
        </Box>
      ) : (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardActionArea onClick={() => setCurrentPage('settings')} sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <FolderOpenIcon color="action" fontSize="large" />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" fontWeight="medium">No library selected</Typography>
                <Typography variant="body2" color="text.secondary">
                  Click to open Settings and add a library
                </Typography>
              </Box>
              <SettingsIcon color="action" />
            </Box>
          </CardActionArea>
        </Card>
      )}

      {/* No index alert */}
      {activeLibrary && !hasIndex && (
        <Alert
          severity="info"
          icon={<BuildIcon />}
          sx={{ mb: 3 }}
          action={
            <Button size="small" onClick={handleRebuildIndex} disabled={rebuilding}>
              {rebuilding ? <CircularProgress size={16} /> : 'Build Index'}
            </Button>
          }
        >
          No index found — build one to enable autocomplete and see counts here.
        </Alert>
      )}

      {/* Index stats */}
      {hasIndex && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography variant="overline" color="text.secondary">
              Index
            </Typography>
            <Chip
              label={`Built ${builtAt.toLocaleDateString()} ${builtAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              size="small"
              color="success"
              variant="outlined"
            />
            <Tooltip title={rebuilding ? 'Building…' : 'Rebuild index'}>
              <span>
                <IconButton size="small" onClick={handleRebuildIndex} disabled={rebuilding}>
                  {rebuilding ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          <Grid container spacing={1.5} sx={{ mb: 3 }}>
            {INDEX_TYPES.map(({ key, label, page, tooltip }) => {
              const arr = libraryIndex[key];
              if (!arr) return null;
              return (
                <Grid item xs={6} sm={4} md={3} lg={2} key={key}>
                  <StatCard label={label} count={arr.length} page={page} tooltip={tooltip} onNavigate={setCurrentPage} />
                </Grid>
              );
            })}
          </Grid>
        </>
      )}

      {/* Recently visited */}
      {recentPages.length > 0 && (
        <>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <HistoryIcon fontSize="small" color="action" />
            <Typography variant="overline" color="text.secondary">
              Recently Visited
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {recentPages.map((page) => (
              <Chip
                key={page}
                label={PAGE_LABELS[page] ?? page}
                onClick={() => setCurrentPage(page)}
                clickable
                variant="outlined"
              />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}

export default DashboardPage;
