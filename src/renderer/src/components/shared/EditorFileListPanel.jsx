import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { List as VirtualList } from 'react-window'
import {
  Box,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Tooltip,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import ArchiveIcon from '@mui/icons-material/Archive'
import UnarchiveIcon from '@mui/icons-material/Unarchive'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FolderIcon from '@mui/icons-material/Folder'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import ViewListIcon from '@mui/icons-material/ViewList'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import ClearIcon from '@mui/icons-material/Clear'
import { useStoreState, fileListViewModeState } from '../../store/appStore'
import {
  ITEM_HEIGHT,
  FOLDER_HEIGHT,
  INDENT_STEP,
  stripXml,
  folderKeys,
  displayNameFor,
  filterFiles,
  buildFileTree,
  flattenTree,
  flattenFlat,
  rowHeightFor
} from '../../utils/fileTree'

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

// Row renderer for react-window. Renders either a folder header or a file, both
// out of one flat row array — virtualization needs a flat rowCount, so the tree
// is flattened rather than rendered recursively with <Collapse>.
const VirtualRow = memo(function VirtualRow({
  index,
  style,
  rows,
  selectedFile,
  selectedPaths,
  onRowClick,
  onRowContextMenu,
  onToggleFolder,
  namesByFilename,
  archived,
  renderSecondary
}) {
  const row = rows[index]
  const indent = 1 + row.depth * INDENT_STEP

  if (row.kind === 'folder') {
    return (
      <ListItem disablePadding style={style}>
        <ListItemButton
          onClick={() => onToggleFolder(row.key)}
          sx={{ height: FOLDER_HEIGHT, pl: indent }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>
            {row.open ? <FolderOpenIcon fontSize="small" /> : <FolderIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText
            primary={row.name}
            secondary={null}
            slotProps={{
              primary: { noWrap: true, variant: 'body2', sx: { fontSize: '0.9rem' } }
            }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
            {row.count}
          </Typography>
          {row.open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </ListItemButton>
      </ListItem>
    )
  }

  const file = row.file
  const displayName = displayNameFor(file, namesByFilename)
  const filenameBare = stripXml(file.name)
  const showSubtitle = displayName !== filenameBare
  const isMultiSelected = selectedPaths.has(file.path)
  const isPrimary = selectedFile?.path === file.path
  return (
    <ListItem disablePadding style={style}>
      <ListItemButton
        selected={isPrimary || isMultiSelected}
        onClick={(e) => onRowClick(e, file)}
        onContextMenu={(e) => onRowContextMenu(e, file)}
        sx={{ height: ITEM_HEIGHT, pl: indent }}
      >
        <ListItemText
          primary={displayName}
          // A page-supplied secondary takes the slot outright; without one the
          // filename fallback behaves exactly as it always has. Folder rows are
          // never offered it — they return above with secondary={null}.
          secondary={renderSecondary ? renderSecondary(file) : showSubtitle ? filenameBare : null}
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
})

/**
 * Shared file list panel for editor pages. Active and Archived are tabs over one
 * virtualized list; each can group by folder or show flat, driven by a persisted
 * global setting read straight from the store (so pages thread no view props).
 *
 * Files arrive as `{ rel, treePath, name, path, archived }` from
 * `utils/fileTree#toSectionFile`. Lookups key on `rel` — the index's own
 * `<type>NamesByFilename` key, `.ignore/`-prefixed for archived entries — so no
 * key-prefix threading is needed anywhere.
 *
 * Multiselect: regular click selects + opens; Ctrl/Cmd-click toggles into the
 * bulk-select set without opening; Shift-click extends a range within the
 * currently-visible file rows. Selection is per-tab and clears on tab change,
 * which is what removes the old active/archived "mixed" selection state.
 * Clicking a folder only expands/collapses it — folders are never selected, so
 * bulk actions still operate purely on files.
 */
export default function EditorFileListPanel({
  title,
  entityLabel,
  files,
  archivedFiles,
  selectedFile,
  onSelect,
  onNew,
  namesByFilename,
  loading = false,
  width = 240,
  // Bulk-action callbacks. Each receives an array of { rel, name, path } files.
  // If a callback is omitted, the corresponding button/menu item is hidden.
  onArchive,
  onUnarchive,
  // onDelete receives full file objects so callers can warn with display names.
  onDelete,
  // onDuplicate is single-only; receives the one selected file.
  onDuplicate,
  // Fires whenever the multiselect set changes — pages render the editor-pane
  // dim/blur overlay based on this count.
  onSelectionChange,
  // Page-specific extra IconButton entries rendered before the New button.
  // Shape: [{ icon: ReactNode, tooltip: string, onClick: () => void, disabled?: boolean }]
  extraActions,
  // Optional: turn the New (+) button into a dropdown of create options instead
  // of a single onNew. Shape: [{ label: string, onClick: () => void, icon?: ReactNode }].
  // When omitted, the + button calls onNew directly (default behavior).
  newMenuItems,
  // Optional: (file) => ReactNode, rendered in the secondary slot of file rows
  // instead of the filename subtitle. Row height is fixed at ITEM_HEIGHT (52px),
  // so keep the node to one line — a chip or a short caption.
  // MUST be useCallback-stable: it goes into the rowProps memo below, and an
  // identity that changes every render re-renders every visible row.
  renderSecondary
}) {
  const [newMenuAnchor, setNewMenuAnchor] = useState(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('active')
  const [viewMode, setViewMode] = useStoreState(fileListViewModeState)
  const [listRef, listSize] = useAutoSize()
  const [selectedPaths, setSelectedPaths] = useState(() => new Set())
  const [lastClickedPath, setLastClickedPath] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null) // file[] | null
  // Expansion is deliberately not persisted: the only real tree today is one
  // archive folder, filtering auto-expands anyway, and persisting would mean a
  // library/type-keyed map to prune as worlds come and go. One Set across both
  // tabs — a folder is the same folder whichever tab you view it from.
  const [expanded, setExpanded] = useState(() => new Set())

  const archivedTab = tab === 'archived'
  // Memoized: a bare conditional would hand `filtered` a new array identity on
  // every render whenever archivedFiles is undefined, defeating its memo.
  const tabFiles = useMemo(
    () => (archivedTab ? archivedFiles || [] : files),
    [archivedTab, archivedFiles, files]
  )

  // Memoized so unrelated local-state changes (context menu, new-menu anchor,
  // pending delete, selection) don't re-walk all 2000+ items with a regex each.
  const filtered = useMemo(
    () => filterFiles(tabFiles, search, namesByFilename),
    [tabFiles, search, namesByFilename]
  )

  // Filter first, then build: rebuilding from surviving leaves prunes empty
  // folders and keeps every match's ancestors for free.
  //
  // Split from the flatten below so expanding a folder doesn't re-run the build
  // over every file — the tree is a pure function of `filtered` and cannot have
  // changed just because a folder opened.
  const tree = useMemo(
    () => (viewMode === 'folder' ? buildFileTree(filtered) : null),
    [viewMode, filtered]
  )

  const rows = useMemo(() => {
    if (!tree) return flattenFlat(filtered)
    // A live filter forces everything open — the surviving tree is only matches
    // plus their ancestors, so revealing all of it is exactly right.
    return flattenTree(tree, expanded, !!search)
  }, [tree, filtered, expanded, search])

  const rowHeight = useMemo(() => rowHeightFor(rows), [rows])

  // Expand/collapse all. `allExpanded` decides which way the one button goes, so
  // it is measured against the tree's own folder keys rather than a count — a
  // folder opened, then filtered away, then restored would otherwise leave the
  // two sets the same size and different.
  const allFolders = useMemo(() => folderKeys(tree), [tree])
  const allExpanded = allFolders.length > 0 && allFolders.every((k) => expanded.has(k))
  const toggleExpandAll = useCallback(
    () => setExpanded(allExpanded ? new Set() : new Set(allFolders)),
    [allExpanded, allFolders]
  )

  // Path → file lookup across both tabs, used by the action toolbar to
  // resolve the selectedPaths set into actual file objects.
  const filesByPath = useMemo(() => {
    const m = new Map()
    for (const f of files) m.set(f.path, f)
    for (const f of archivedFiles || []) m.set(f.path, f)
    return m
  }, [files, archivedFiles])

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

  // Selection is scoped to a tab, so switching tabs drops it — otherwise a bulk
  // action fired from Archived could act on files selected under Active.
  useEffect(() => {
    clearSelection()
  }, [tab, clearSelection])

  const toggleFolder = useCallback((key) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // Visible file rows, in render order — the basis for shift-click ranges.
  // Folder rows are excluded so a range never sweeps in a folder. In flat mode
  // every row is already a file, so `filtered` is that list unchanged.
  const visibleFiles = useMemo(
    () => (tree ? rows.filter((r) => r.kind === 'file').map((r) => r.file) : filtered),
    [tree, rows, filtered]
  )

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
        const fromIdx = visibleFiles.findIndex((f) => f.path === lastClickedPath)
        const toIdx = visibleFiles.findIndex((f) => f.path === file.path)
        if (fromIdx >= 0 && toIdx >= 0) {
          const [a, b] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
          const next = new Set(selectedPaths)
          for (let i = a; i <= b; i++) next.add(visibleFiles[i].path)
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
    [selectedPaths, lastClickedPath, visibleFiles, updateSelection, onSelect]
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

  // Stable rowProps identity so react-window doesn't re-render every visible
  // row on unrelated state changes (memoized VirtualRow can then bail out).
  const rowProps = useMemo(
    () => ({
      rows,
      selectedFile,
      selectedPaths,
      onRowClick: handleRowClick,
      onRowContextMenu: handleRowContextMenu,
      onToggleFolder: toggleFolder,
      namesByFilename,
      archived: archivedTab,
      renderSecondary
    }),
    [
      rows,
      selectedFile,
      selectedPaths,
      handleRowClick,
      handleRowContextMenu,
      toggleFolder,
      namesByFilename,
      archivedTab,
      renderSecondary
    ]
  )

  const noun = (title || '').toLowerCase()
  const newTooltip = `New ${entityLabel || title || 'file'}`
  const selectionCount = selectedPaths.size

  // Action availability. With tabs, "where the selection lives" is just the
  // active tab — the old active/archived/mixed tri-state is gone.
  const canArchive = !!onArchive && !archivedTab && selectionCount >= 1
  const canUnarchive = !!onUnarchive && archivedTab && selectionCount >= 1
  const canArchiveOrUnarchive = !!(archivedTab ? onUnarchive : onArchive)
  const archiveBtnEnabled = canArchive || canUnarchive
  const archiveBtnLabel = archivedTab ? 'Unarchive' : 'Archive'
  const archiveBtnIcon = archivedTab ? (
    <UnarchiveIcon fontSize="small" />
  ) : (
    <ArchiveIcon fontSize="small" />
  )
  const archiveBtnTooltip = archiveBtnEnabled
    ? archiveBtnLabel
    : `Select item(s) to ${archiveBtnLabel.toLowerCase()}`
  const canDelete = !!onDelete && selectionCount >= 1
  const canDuplicate = !!onDuplicate && selectionCount === 1

  // One value rather than four overlapping booleans, so the states are
  // exclusive by construction instead of by reading three `!loading` guards.
  const listState =
    loading && files.length === 0
      ? 'loading'
      : tabFiles.length === 0
        ? 'empty'
        : rows.length === 0
          ? 'noMatches'
          : 'list'

  const folderMode = viewMode === 'folder'

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

      {/* Row 2 — action buttons. Folder/flat toggle pinned left, bulk actions
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
          <Tooltip title={folderMode ? 'Grouping by folder' : 'Flat list'}>
            <IconButton
              size="small"
              onClick={() => setViewMode(folderMode ? 'flat' : 'folder')}
              aria-label={folderMode ? 'Switch to flat list' : 'Group by folder'}
            >
              {folderMode ? (
                <AccountTreeIcon fontSize="small" />
              ) : (
                <ViewListIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          {folderMode && allFolders.length > 0 && (
            // Disabled while filtering rather than hidden: a live filter forces
            // every surviving folder open, so the button would appear to do
            // nothing. Saying why is better than a control that ignores clicks.
            <Tooltip
              title={
                search
                  ? 'Filtering already shows every match'
                  : allExpanded
                    ? 'Collapse all folders'
                    : 'Expand all folders'
              }
            >
              <span>
                <IconButton
                  size="small"
                  onClick={toggleExpandAll}
                  disabled={!!search}
                  aria-label={allExpanded ? 'Collapse all folders' : 'Expand all folders'}
                >
                  {allExpanded ? (
                    <UnfoldLessIcon fontSize="small" />
                  ) : (
                    <UnfoldMoreIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          )}
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
                  onClick={() => runAction(archivedTab ? 'unarchive' : 'archive')}
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

        <Box sx={{ display: 'flex', gap: 0.25 }}>
          {(extraActions || []).map((action, idx) => (
            <Tooltip key={idx} title={action.tooltip || ''}>
              <span>
                <IconButton size="small" onClick={action.onClick} disabled={!!action.disabled}>
                  {action.icon}
                </IconButton>
              </span>
            </Tooltip>
          ))}
          <Tooltip title={newMenuItems?.length ? 'Create…' : newTooltip}>
            <span>
              <IconButton
                size="small"
                onClick={(e) =>
                  newMenuItems?.length ? setNewMenuAnchor(e.currentTarget) : onNew?.()
                }
                aria-label={newTooltip}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* New (+) dropdown — only when newMenuItems provided */}
      <Menu
        open={!!newMenuAnchor}
        anchorEl={newMenuAnchor}
        onClose={() => setNewMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {(newMenuItems || []).map((item, i) => (
          <MenuItem
            key={i}
            onClick={() => {
              setNewMenuAnchor(null)
              item.onClick?.()
            }}
          >
            {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
            {item.label}
          </MenuItem>
        ))}
      </Menu>

      {/* Row 3 — Active / Archived tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0 } }}
      >
        <Tab value="active" label={`Active (${files.length})`} />
        <Tab value="archived" label={`Archived (${(archivedFiles || []).length})`} />
      </Tabs>

      {/* Row 4 — filter input */}
      <Box sx={{ px: 1, py: 1 }}>
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
              ),
              // Only while there is something to clear, so the field does not
              // carry a permanent dead control.
              endAdornment: search ? (
                <InputAdornment position="end">
                  <Tooltip title="Clear filter">
                    <IconButton size="small" edge="end" onClick={() => setSearch('')}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ) : null
            }
          }}
        />
      </Box>
      <Divider />

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {listState === 'loading' && (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {listState === 'empty' && (
          <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>
            {archivedTab
              ? `No archived ${noun}.`
              : `No ${noun} found. Check that a library is set in Settings.`}
          </Typography>
        )}

        {listState === 'noMatches' && (
          <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>
            No matches.
          </Typography>
        )}

        {listState === 'list' && (
          <Box ref={listRef} sx={{ flex: 1, minHeight: 0 }}>
            {listSize.height > 0 && rows.length > 0 && (
              <VirtualList
                style={{ height: listSize.height, width: listSize.width || width }}
                rowCount={rows.length}
                rowHeight={rowHeight}
                rowComponent={VirtualRow}
                rowProps={rowProps}
              />
            )}
          </Box>
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
            onClick={() => runAction(archivedTab ? 'unarchive' : 'archive')}
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
