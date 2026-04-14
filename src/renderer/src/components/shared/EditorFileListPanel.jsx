import React, { useState } from 'react';
import {
  Box, List, ListItem, ListItemButton, ListItemText, Typography, Divider,
  Button, Tooltip, TextField, InputAdornment, IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ArchiveIcon from '@mui/icons-material/Archive';

function stripXml(filename) {
  return filename.replace(/\.xml$/i, '');
}

function displayNameFor(file, namesByFilename) {
  return namesByFilename?.[file.name] ?? stripXml(file.name);
}

function matchesFilter(file, query, namesByFilename) {
  if (!query) return true;
  const q = query.toLowerCase();
  if (stripXml(file.name).toLowerCase().includes(q)) return true;
  const name = namesByFilename?.[file.name];
  return !!(name && name.toLowerCase().includes(q));
}

/**
 * Shared file list panel for editor pages. Displays active + (optional) archived
 * files, filterable by either bare filename or the inner <Name>/Locale recorded
 * in the library index under `<type>NamesByFilename`.
 */
export default function EditorFileListPanel({
  title,
  entityLabel,
  files,
  archivedFiles,
  selectedFile,
  onSelect,
  onNew,
  showArchived,
  onToggleArchived,
  namesByFilename,
  width = 240,
}) {
  const [search, setSearch] = useState('');

  const filteredActive   = files.filter((f) => matchesFilter(f, search, namesByFilename));
  const filteredArchived = (archivedFiles || []).filter((f) => matchesFilter(f, search, namesByFilename));

  const noun       = (title || '').toLowerCase();
  const newTooltip = `New ${entityLabel || title || 'file'}`;

  const renderItem = (file, { archived = false } = {}) => {
    const displayName = displayNameFor(file, namesByFilename);
    const filenameBare = stripXml(file.name);
    const showSubtitle = displayName !== filenameBare;
    return (
      <ListItem key={file.path} disablePadding>
        <ListItemButton
          selected={selectedFile?.path === file.path}
          onClick={() => onSelect(file)}
        >
          <ListItemText
            primary={displayName}
            secondary={showSubtitle ? filenameBare : null}
            primaryTypographyProps={{ noWrap: true, variant: 'body2', color: archived ? 'text.secondary' : undefined }}
            secondaryTypographyProps={{ noWrap: true, variant: 'caption' }}
          />
        </ListItemButton>
      </ListItem>
    );
  };

  return (
    <Box
      sx={{
        width,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={showArchived ? 'Hide Archived' : 'Show Archived'}>
            <IconButton size="small" onClick={onToggleArchived} color={showArchived ? 'primary' : 'default'}>
              <ArchiveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={newTooltip}>
            <Button size="small" startIcon={<AddIcon />} onClick={onNew}>
              New
            </Button>
          </Tooltip>
        </Box>
      </Box>
      <Box sx={{ px: 1, pb: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Filter..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {files.length === 0 && !showArchived ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No {noun} found. Check that a library is set in Settings.
          </Typography>
        ) : filteredActive.length === 0 && (!showArchived || filteredArchived.length === 0) ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No matches.
          </Typography>
        ) : (
          <>
            <List dense disablePadding>
              {filteredActive.map((f) => renderItem(f))}
            </List>

            {showArchived && filteredArchived.length > 0 && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, py: 0.5, display: 'block' }}>
                  Archived
                </Typography>
                <List dense disablePadding>
                  {filteredArchived.map((f) => renderItem(f, { archived: true }))}
                </List>
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
