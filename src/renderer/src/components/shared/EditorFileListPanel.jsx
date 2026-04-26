import { useCallback, useMemo, useRef, useState } from 'react'
import { List as VirtualList } from 'react-window'
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Divider,
  Tooltip,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import ArchiveIcon from '@mui/icons-material/Archive'
import UnarchiveIcon from '@mui/icons-material/Unarchive'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

const ITEM_HEIGHT = 52

function stripXml(filename) {
  return filename.replace(/\.xml$/i, '')
}

function displayNameFor(file, namesByFilename) {
  return namesByFilename?.[file.name] ?? stripXml(file.name)
}

function matchesFilter(file, query, namesByFilename) {
  if (!query) return true
  const q = query.toLowerCase()
  if (stripXml(file.name).toLowerCase().includes(q)) return true
  const name = namesByFilename?.[file.name]
  return !!(name && name.toLowerCase().includes(q))
}

// Measures the bounding rect of a box and re-measures on resize so the virtual
// list can be sized against real pixels (react-window needs explicit numbers).
// Uses a callback ref so measurement kicks in whenever the element mounts —
// including late mounts after a `loading` state flips the list area on.
function useAutoSize() {
  const observerRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const refCallback = useCallback((el) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (!el) return
    const rect = el.getBoundingClientRect()
    setSize({ width: rect.width, height: rect.height })
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    ro.observe(el)
    observerRef.current = ro
  }, [])
  return [refCallback, size]
}

// Row renderer for react-window. Receives index + precomputed style (absolute
// positioning from the virtual list) + itemData populated by the parent.
function VirtualRow({
  index,
  style,
  items,
  selectedFile,
  selectedPaths,
  onRowClick,
  onRowContextMenu,
  namesByFilename,
  archived
}) {
  const file = items[index]
  const displayName = displayNameFor(file, namesByFilename)
  const filenameBare = stripXml(file.name)
  const showSubtitle = displayName !== filenameBare
  const isMultiSelected = selectedPaths.has(file.path)
  const isPrimary = selectedFile?.path === file.path
  return (
    <ListItem key={file.path} disablePadding style={style}>
      <ListItemButton
        selected={isPrimary || isMultiSelected}
        onClick={(e) => onRowClick(e, file)}
        onContextMenu={(e) => onRowContextMenu(e, file)}
        sx={{ height: ITEM_HEIGHT }}
      >
        <ListItemText
          primary={displayName}
          secondary={showSubtitle ? filenameBare : null}
          slotProps={{
            primary: {
              noWrap: true,
              variant: 'body2',
              color: archived ? 'text.secondary' : undefined
            },
            secondary: { noWrap: true, variant: 'caption' }
          }}
        />
      </ListItemButton>
    </ListItem>
  )
}

/**
 * Shared file list panel for editor pages. Displays active + (optional) archived
 * files, filterable by either bare filename or the inner <Name>/Locale recorded
 * in the library index under `<type>NamesByFilename`.
 *
 * Active list is virtualized (react-window) to handle 2000+ items without
 * rendering every row into the DOM. Archived list uses native rendering since
 * it's typically small and stacked below with a bounded height.
 *
 * Multiselect: regular click selects + opens (today's behavior); Ctrl/Cmd-click
 * toggles into the bulk-select set without opening; Shift-click extends a range
 * within the currently-visible filtered list. Bulk actions (archive/unarchive/
 * delete/duplicate) live in the header toolbar AND a right-click context menu.
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
  // Bulk-action callbacks. Each receives an array of { name, path } files.
  // If a callback is omitted, the corresponding button/menu item is hidden.
  onArchive,
  onUnarchive,
  // onDelete receives full file objects so callers can warn with display names.
  onDelete,
  // onDuplicate is single-only; receives the one selected file.
  onDuplicate,
  // Fires whenever the multiselect set changes — pages render the editor-pane
  // dim/blur overlay based on this count.
  onSelectionChange
}) {
  const [search, setSearch] = useState('')
  const [listRef, listSize] = useAutoSize()
  const [selectedPaths, setSelectedPaths] = useState(() => new Set())
  const [lastClickedPath, setLastClickedPath] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null) // file[] | null

  const filteredActive = files.filter((f) => matchesFilter(f, search, namesByFilename))
  const filteredArchived = (archivedFiles || []).filter((f) =>
    matchesFilter(f, search, namesByFilename)
  )

  // Path → file lookup across both lists, used by the action toolbar to
  // resolve the selectedPaths set into actual file objects.
  const filesByPath = useMemo(() => {
    const m = new Map()
    for (const f of files) m.set(f.path, f)
    for (const f of archivedFiles || []) m.set(f.path, f)
    return m
  }, [files, archivedFiles])

  const archivedPathSet = useMemo(
    () => new Set((archivedFiles || []).map((f) => f.path)),
    [archivedFiles]
  )

  // Whether all currently-selected items are active, all archived, or mixed.
  // Drives the single context-aware Archive/Unarchive button.
  const selectionLocation = useMemo(() => {
    if (selectedPaths.size === 0) return 'empty'
    let hasActive = false
    let hasArchived = false
    for (const p of selectedPaths) {
      if (archivedPathSet.has(p)) hasArchived = true
      else hasActive = true
      if (hasActive && hasArchived) return 'mixed'
    }
    if (hasActive) return 'active'
    return 'archived'
  }, [selectedPaths, archivedPathSet])

  const updateSelection = useCallback(
    (next) => {
      setSelectedPaths(next)
      onSelectionChange?.(next)
    },
    [onSelectionChange]
  )

  const clearSelection = useCallback(() => {
    setSelectedPaths((prev) => {
      if (prev.size === 0) return prev
      const empty = new Set()
      onSelectionChange?.(empty)
      return empty
    })
    setLastClickedPath(null)
  }, [onSelectionChange])

  // Combined visible list — order matters for shift-click range selection.
  // Active rows come first, then archived (matches the on-screen layout).
  const visibleOrdered = useMemo(() => {
    const arr = filteredActive.slice()
    if (showArchived) arr.push(...filteredArchived)
    return arr
  }, [filteredActive, filteredArchived, showArchived])

  const handleRowClick = useCallback(
    (e, file) => {
      // Ctrl/Cmd-click — toggle membership; do NOT open editor.
      if (e.ctrlKey || e.metaKey) {
        const next = new Set(selectedPaths)
        if (next.has(file.path)) next.delete(file.path)
        else next.add(file.path)
        updateSelection(next)
        setLastClickedPath(file.path)
        return
      }
      // Shift-click — range from lastClickedPath to this row in visible order.
      if (e.shiftKey && lastClickedPath) {
        const fromIdx = visibleOrdered.findIndex((f) => f.path === lastClickedPath)
        const toIdx = visibleOrdered.findIndex((f) => f.path === file.path)
        if (fromIdx >= 0 && toIdx >= 0) {
          const [a, b] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
          const next = new Set(selectedPaths)
          for (let i = a; i <= b; i++) next.add(visibleOrdered[i].path)
          updateSelection(next)
          return
        }
      }
      // Plain click — collapse to this single item AND open editor.
      const next = new Set([file.path])
      updateSelection(next)
      setLastClickedPath(file.path)
      onSelect?.(file)
    },
    [selectedPaths, lastClickedPath, visibleOrdered, updateSelection, onSelect]
  )

  // Right-click — if the row isn't already in selection, replace selection
  // with just this row first so the menu acts on what the user pointed at.
  const handleRowContextMenu = useCallback(
    (e, file) => {
      e.preventDefault()
      if (!selectedPaths.has(file.path)) {
        const next = new Set([file.path])
        updateSelection(next)
        setLastClickedPath(file.path)
      }
      setContextMenu({ x: e.clientX, y: e.clientY, file })
    },
    [selectedPaths, updateSelection]
  )

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const selectedFiles = useMemo(() => {
    const out = []
    for (const p of selectedPaths) {
      const f = filesByPath.get(p)
      if (f) out.push(f)
    }
    return out
  }, [selectedPaths, filesByPath])

  const runAction = useCallback(
    async (kind) => {
      closeContextMenu()
      if (kind === 'archive' && onArchive) {
        await onArchive(selectedFiles)
        clearSelection()
      } else if (kind === 'unarchive' && onUnarchive) {
        await onUnarchive(selectedFiles)
        clearSelection()
      } else if (kind === 'delete' && onDelete) {
        // Stage for confirmation — actual onDelete fires from the dialog.
        setPendingDelete(selectedFiles.slice())
      } else if (kind === 'duplicate' && onDuplicate && selectedFiles.length === 1) {
        await onDuplicate(selectedFiles[0])
        clearSelection()
      }
    },
    [onArchive, onUnarchive, onDelete, onDuplicate, selectedFiles, clearSelection, closeContextMenu]
  )

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || pendingDelete.length === 0) {
      setPendingDelete(null)
      return
    }
    const files = pendingDelete
    setPendingDelete(null)
    await onDelete?.(files)
    clearSelection()
  }, [pendingDelete, onDelete, clearSelection])

  const cancelDelete = useCallback(() => setPendingDelete(null), [])

  const noun = (title || '').toLowerCase()
  const newTooltip = `New ${entityLabel || title || 'file'}`
  const selectionCount = selectedPaths.size

  // Action availability — drives both the toolbar buttons and context menu.
  const canArchive = !!onArchive && selectionLocation === 'active'
  const canUnarchive = !!onUnarchive && selectionLocation === 'archived'
  const canArchiveOrUnarchive = !!(onArchive || onUnarchive)
  const archiveBtnEnabled = canArchive || canUnarchive
  const archiveBtnLabel =
    selectionLocation === 'archived' ? 'Unarchive' : 'Archive'
  const archiveBtnIcon =
    selectionLocation === 'archived' ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />
  const archiveBtnTooltip =
    selectionLocation === 'mixed'
      ? 'Mixed selection — archive and unarchive disabled'
      : selectionLocation === 'empty'
        ? 'Select item(s) to archive'
        : archiveBtnLabel
  const canDelete = !!onDelete && selectionCount >= 1
  const canDuplicate = !!onDuplicate && selectionCount === 1

  const showLoader = loading && files.length === 0
  const showEmptyLibrary = !loading && files.length === 0 && !showArchived
  const showNoMatches =
    !loading &&
    filteredActive.length === 0 &&
    (!showArchived || filteredArchived.length === 0) &&
    files.length > 0
  const showLists = !showLoader && !showEmptyLibrary && !showNoMatches

  return (
    <Box
      sx={{
        width,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Row 1 — centered title (matches EditorHeader's h6) */}
      <Box sx={{ px: 1, pt: 1, display: 'flex', justifyContent: 'center' }}>
        <Typography variant="h6" noWrap>
          {title}
        </Typography>
      </Box>

      {/* Row 2 — action buttons. Eye toggle pinned left, bulk actions
          centered, New pinned right. Three flex sections at space-between. */}
      <Box
        sx={{
          px: 1,
          py: 0.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex' }}>
          <Tooltip title={showArchived ? 'Showing Archived Items' : 'Hiding Archived Items'}>
            <IconButton size="small" onClick={onToggleArchived}>
              {showArchived ? (
                <VisibilityIcon fontSize="small" />
              ) : (
                <VisibilityOffIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.25 }}>
          {!!onDelete && (
            <Tooltip
              title={
                selectionCount === 0
                  ? 'Select item(s) to delete'
                  : `Delete ${selectionCount} item${selectionCount === 1 ? '' : 's'}`
              }
            >
              <span>
                <IconButton
                  size="small"
                  disabled={!canDelete}
                  onClick={() => runAction('delete')}
                  aria-label="Delete"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {canArchiveOrUnarchive && (
            <Tooltip title={archiveBtnTooltip}>
              <span>
                <IconButton
                  size="small"
                  disabled={!archiveBtnEnabled}
                  onClick={() => runAction(canUnarchive ? 'unarchive' : 'archive')}
                  aria-label={archiveBtnLabel}
                >
                  {archiveBtnIcon}
                </IconButton>
              </span>
            </Tooltip>
          )}
          {!!onDuplicate && (
            <Tooltip
              title={
                selectionCount === 0
                  ? 'Select an item to duplicate'
                  : selectionCount > 1
                    ? 'Duplicate is single-item only'
                    : 'Duplicate'
              }
            >
              <span>
                <IconButton
                  size="small"
                  disabled={!canDuplicate}
                  onClick={() => runAction('duplicate')}
                  aria-label="Duplicate"
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>

        <Box sx={{ display: 'flex' }}>
          <Tooltip title={newTooltip}>
            <span>
              <IconButton size="small" onClick={onNew}>
                <AddIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* Row 3 — filter input */}
      <Box sx={{ px: 1, pb: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Filter..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }
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
          <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>
            No {noun} found. Check that a library is set in Settings.
          </Typography>
        )}

        {showNoMatches && (
          <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>
            No matches.
          </Typography>
        )}

        {showLists && (
          <>
            <Box ref={listRef} sx={{ flex: 1, minHeight: 0 }}>
              {listSize.height > 0 && filteredActive.length > 0 && (
                <VirtualList
                  style={{ height: listSize.height, width: listSize.width || width }}
                  rowCount={filteredActive.length}
                  rowHeight={ITEM_HEIGHT}
                  rowComponent={VirtualRow}
                  rowProps={{
                    items: filteredActive,
                    selectedFile,
                    selectedPaths,
                    onRowClick: handleRowClick,
                    onRowContextMenu: handleRowContextMenu,
                    namesByFilename,
                    archived: false
                  }}
                />
              )}
              {filteredActive.length === 0 && showArchived && (
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', display: 'block', px: 2, py: 1 }}
                >
                  No active matches.
                </Typography>
              )}
            </Box>

            {showArchived && filteredArchived.length > 0 && (
              <Box
                sx={{
                  borderTop: 1,
                  borderColor: 'divider',
                  maxHeight: '40%',
                  overflow: 'auto',
                  flexShrink: 0
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', px: 1.5, py: 0.5, display: 'block' }}
                >
                  Archived
                </Typography>
                <List dense disablePadding>
                  {filteredArchived.map((file) => {
                    const displayName = displayNameFor(file, namesByFilename)
                    const filenameBare = stripXml(file.name)
                    const showSubtitle = displayName !== filenameBare
                    const isMultiSelected = selectedPaths.has(file.path)
                    const isPrimary = selectedFile?.path === file.path
                    return (
                      <ListItem key={file.path} disablePadding>
                        <ListItemButton
                          selected={isPrimary || isMultiSelected}
                          onClick={(e) => handleRowClick(e, file)}
                          onContextMenu={(e) => handleRowContextMenu(e, file)}
                        >
                          <ListItemText
                            primary={displayName}
                            secondary={showSubtitle ? filenameBare : null}
                            slotProps={{
                              primary: {
                                noWrap: true,
                                variant: 'body2',
                                color: 'text.secondary'
                              },
                              secondary: { noWrap: true, variant: 'caption' }
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    )
                  })}
                </List>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Context menu — mirrors the toolbar buttons */}
      <Menu
        open={!!contextMenu}
        onClose={closeContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined}
      >
        {canArchiveOrUnarchive && (
          <MenuItem
            disabled={!archiveBtnEnabled}
            onClick={() => runAction(canUnarchive ? 'unarchive' : 'archive')}
          >
            <ListItemIcon>{archiveBtnIcon}</ListItemIcon>
            {archiveBtnLabel}
            {selectionCount > 1 ? ` (${selectionCount})` : ''}
          </MenuItem>
        )}
        {!!onDuplicate && (
          <MenuItem disabled={!canDuplicate} onClick={() => runAction('duplicate')}>
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            Duplicate
          </MenuItem>
        )}
        {!!onDelete && (
          <MenuItem disabled={!canDelete} onClick={() => runAction('delete')}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            Delete{selectionCount > 1 ? ` (${selectionCount})` : ''}
          </MenuItem>
        )}
      </Menu>

      {/* Delete confirmation. Files go to the OS trash (Recycle Bin /
          Trash), so this is a soft "are you sure" rather than a final
          warning — the user can still recover from the OS. */}
      <Dialog open={!!pendingDelete} onClose={cancelDelete}>
        <DialogTitle>
          {pendingDelete && pendingDelete.length === 1
            ? 'Delete this item?'
            : `Delete ${pendingDelete?.length ?? 0} items?`}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            {pendingDelete && pendingDelete.length === 1
              ? 'This file will be moved to your system trash.'
              : 'These files will be moved to your system trash. You can recover them from the OS Recycle Bin / Trash.'}
          </DialogContentText>
          {pendingDelete && pendingDelete.length > 0 && (
            <Box
              sx={{
                maxHeight: 200,
                overflow: 'auto',
                bgcolor: 'action.hover',
                borderRadius: 1,
                px: 1.5,
                py: 1
              }}
            >
              {pendingDelete.slice(0, 20).map((f) => (
                <Typography key={f.path} variant="body2" sx={{ fontFamily: 'monospace' }} noWrap>
                  {displayNameFor(f, namesByFilename)}
                </Typography>
              ))}
              {pendingDelete.length > 20 && (
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  …and {pendingDelete.length - 20} more
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
