import React, { useCallback, useRef, useState } from 'react';
import { FixedSizeList } from 'react-window';
import {
  Box, List, ListItem, ListItemButton, ListItemText, Typography, Divider,
  Button, Tooltip, TextField, InputAdornment, IconButton, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ArchiveIcon from '@mui/icons-material/Archive';

const ITEM_HEIGHT = 52;

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

// Measures the bounding rect of a box and re-measures on resize so the virtual
// list can be sized against real pixels (react-window needs explicit numbers).
// Uses a callback ref so measurement kicks in whenever the element mounts —
// including late mounts after a `loading` state flips the list area on.
function useAutoSize() {
  const observerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const refCallback = useCallback((el) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    observerRef.current = ro;
  }, []);
  return [refCallback, size];
}

// Row renderer for react-window. Receives index + precomputed style (absolute
// positioning from the virtual list) + itemData populated by the parent.
function VirtualRow({ index, style, data }) {
  const { items, selectedFile, onSelect, namesByFilename, archived } = data;
  const file = items[index];
  const displayName = displayNameFor(file, namesByFilename);
  const filenameBare = stripXml(file.name);
  const showSubtitle = displayName !== filenameBare;
  return (
    <ListItem key={file.path} disablePadding style={style}>
      <ListItemButton
        selected={selectedFile?.path === file.path}
        onClick={() => onSelect(file)}
        sx={{ height: ITEM_HEIGHT }}
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
}

/**
 * Shared file list panel for editor pages. Displays active + (optional) archived
 * files, filterable by either bare filename or the inner <Name>/Locale recorded
 * in the library index under `<type>NamesByFilename`.
 *
 * Active list is virtualized (react-window) to handle 2000+ items without
 * rendering every row into the DOM. Archived list uses native rendering since
 * it's typically small and stacked below with a bounded height.
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
  loading = false,
  width = 240,
}) {
  const [search, setSearch] = useState('');
  const [listRef, listSize] = useAutoSize();

  const filteredActive   = files.filter((f) => matchesFilter(f, search, namesByFilename));
  const filteredArchived = (archivedFiles || []).filter((f) => matchesFilter(f, search, namesByFilename));

  const noun       = (title || '').toLowerCase();
  const newTooltip = `New ${entityLabel || title || 'file'}`;

  const showLoader       = loading && files.length === 0;
  const showEmptyLibrary = !loading && files.length === 0 && !showArchived;
  const showNoMatches    = !loading && filteredActive.length === 0 && (!showArchived || filteredArchived.length === 0) && files.length > 0;
  const showLists        = !showLoader && !showEmptyLibrary && !showNoMatches;

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

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {showLoader && (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {showEmptyLibrary && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No {noun} found. Check that a library is set in Settings.
          </Typography>
        )}

        {showNoMatches && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No matches.
          </Typography>
        )}

        {showLists && (
          <>
            <Box ref={listRef} sx={{ flex: 1, minHeight: 0 }}>
              {listSize.height > 0 && filteredActive.length > 0 && (
                <FixedSizeList
                  height={listSize.height}
                  width={listSize.width || width}
                  itemCount={filteredActive.length}
                  itemSize={ITEM_HEIGHT}
                  itemData={{
                    items: filteredActive,
                    selectedFile,
                    onSelect,
                    namesByFilename,
                    archived: false,
                  }}
                >
                  {VirtualRow}
                </FixedSizeList>
              )}
              {filteredActive.length === 0 && showArchived && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, py: 1 }}>
                  No active matches.
                </Typography>
              )}
            </Box>

            {showArchived && filteredArchived.length > 0 && (
              <Box sx={{ borderTop: 1, borderColor: 'divider', maxHeight: '40%', overflow: 'auto', flexShrink: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, py: 0.5, display: 'block' }}>
                  Archived
                </Typography>
                <List dense disablePadding>
                  {filteredArchived.map((file) => {
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
                            primaryTypographyProps={{ noWrap: true, variant: 'body2', color: 'text.secondary' }}
                            secondaryTypographyProps={{ noWrap: true, variant: 'caption' }}
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
