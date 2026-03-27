import React from 'react';
import {
  Box, Typography, Card, CardContent, CardActionArea, Grid, Chip, Divider, Alert,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import BuildIcon from '@mui/icons-material/Build';
import { useRecoilValue, useRecoilState } from 'recoil';
import { activeLibraryState, libraryIndexState, currentPageState } from '../recoil/atoms';

const INDEX_TYPES = [
  { key: 'items',                label: 'Items',           page: 'items' },
  { key: 'castables',            label: 'Castables',       page: 'castables' },
  { key: 'statuses',             label: 'Statuses',        page: 'statuses' },
  { key: 'creatures',            label: 'Creatures',       page: 'creatures' },
  { key: 'maps',                 label: 'Maps',            page: null },
  { key: 'npcs',                 label: 'NPCs',            page: 'npcs' },
  { key: 'nations',              label: 'Nations',         page: null },
  { key: 'spawngroups',          label: 'Spawn Groups',    page: 'spawngroups' },
  { key: 'lootsets',             label: 'Loot Sets',       page: 'loot' },
  { key: 'recipes',              label: 'Recipes',         page: 'recipes' },
  { key: 'variantgroups',        label: 'Variant Groups',  page: 'variants' },
  { key: 'creaturebehaviorsets', label: 'Behavior Sets',   page: 'behaviors' },
  { key: 'worldmaps',            label: 'World Maps',      page: null },
  { key: 'elementtables',        label: 'Element Tables',  page: 'elements' },
  { key: 'localizations',        label: 'Localizations',   page: 'strings' },
  { key: 'serverconfigs',        label: 'Server Configs',  page: null },
  { key: 'scripts',              label: 'Scripts',         page: null },
];

function StatCard({ label, count, page, onNavigate }) {
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

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      {page ? (
        <CardActionArea onClick={() => onNavigate(page)} sx={{ height: '100%' }}>
          {content}
        </CardActionArea>
      ) : content}
    </Card>
  );
}

function DashboardPage() {
  const activeLibrary = useRecoilValue(activeLibraryState);
  const libraryIndex = useRecoilValue(libraryIndexState);
  const [, setCurrentPage] = useRecoilState(currentPageState);

  const hasIndex = !!libraryIndex.builtAt;
  const builtAt = hasIndex ? new Date(libraryIndex.builtAt) : null;

  return (
    <Box sx={{ p: 3, maxWidth: 960 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Dashboard
      </Typography>

      <Divider sx={{ mb: 3 }} />

      {/* Active Library */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 3 }}>
        <FolderOpenIcon color="action" sx={{ mt: 0.25 }} />
        <Box>
          <Typography variant="overline" color="text.secondary" lineHeight={1}>
            Active Library
          </Typography>
          {activeLibrary ? (
            <Typography variant="body1" sx={{ wordBreak: 'break-all', mt: 0.25 }}>
              {activeLibrary}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              No library selected — go to Settings to add and activate one.
            </Typography>
          )}
        </Box>
      </Box>

      {activeLibrary && !hasIndex && (
        <Alert severity="info" icon={<BuildIcon />} sx={{ mb: 3 }}>
          No index found for this library. Go to <strong>Settings</strong> and click <strong>Build Index</strong> to enable autocomplete and see counts here.
        </Alert>
      )}

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
          </Box>

          <Grid container spacing={1.5}>
            {INDEX_TYPES.map(({ key, label, page }) => {
              const arr = libraryIndex[key];
              if (!arr) return null;
              return (
                <Grid item xs={6} sm={4} md={3} key={key}>
                  <StatCard label={label} count={arr.length} page={page} onNavigate={setCurrentPage} />
                </Grid>
              );
            })}
          </Grid>
        </>
      )}
    </Box>
  );
}

export default DashboardPage;
