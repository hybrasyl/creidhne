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
  Button,
  ToggleButton,
  ToggleButtonGroup
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
import PendingActionsIcon from '@mui/icons-material/PendingActions'
import PublishIcon from '@mui/icons-material/Publish'
import { useStoreState, fileListViewModeState } from '../../store/appStore'
import { isModKey } from '../../utils/modKey'
import { EditorAlertsProvider } from './EditorAlerts'
import {
  ITEM_HEIGHT,
  FOLDER_HEIGHT,
  SECTION_HEIGHT,
  INDENT_STEP,
  LIST_SETS,
  stripXml,
  displayNameFor,
  filterFiles,
  buildListRows,
  rowHeightFor,
  selectionActions
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

// Row renderer for react-window. Renders a set's header, a folder or a file,
// all out of one flat row array — virtualization needs a flat rowCount, so the
// tree is flattened rather than rendered recursively with <Collapse>.
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
  stagedNamesByFilename,
  renderSecondary
}) {
  const row = rows[index]
  const indent = 1 + row.depth * INDENT_STEP

  if (row.kind === 'section') {
    return (
      <Box
        style={style}
        data-testid={`list-section-${row.key.slice('section:'.length)}`}
        sx={{
          height: SECTION_HEIGHT,
          px: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'action.hover',
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Typography variant="overline" sx={{ lineHeight: 1 }}>
          {row.name}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {row.count}
        </Typography>
      </Box>
    )
  }

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
  // A staged rel can be the same string as a live one, so each file looks its
  // name up in its own set's index.
  const displayName = displayNameFor(file, file.staged ? stagedNamesByFilename : namesByFilename)
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
              color: file.archived ? 'text.secondary' : undefined
            },
            secondary: { noWrap: true, variant: 'caption' }
          }}
        />
      </ListItemButton>
    </ListItem>
  )
})

/** An icon button with a tooltip that still shows while the button is disabled. */
function ToolbarButton({ title, label, disabled, onClick, children }) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton size="small" disabled={disabled} onClick={onClick} aria-label={label}>
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
}

/**
 * The shell of an editor page (HTOO-628): a toolbar across the page, the file
 * list on the left, and the page's editor column (`children`) on the right.
 *
 *   (Page name) | (New) | (Flat) (Staged) (Archived) (Active) | (Archive) (Stage) (Copy) (Delete)
 *
 * One component owns the toolbar and the list because the toolbar's item
 * actions act on the list's selection. It also provides the editor's alerts
 * area (`EditorAlerts.jsx`) around the right column, so a notice anywhere in it
 * shows under the editor header.
 *
 * The set toggles choose what the list shows; Active is the default and at
 * least one stays on. With one set on, the list shows that set's files alone;
 * with two or three, each set has a header row. The item actions are smart:
 * each is enabled only when it applies to every selected file, Archive becomes
 * Unarchive for archived files, and Stage becomes Release for staged files
 * (`selectionActions`).
 *
 * Files arrive as `{ rel, treePath, name, path, archived, staged }` from
 * `utils/fileTree`. Lookups key on `rel` — the index's own
 * `<type>NamesByFilename` key, `.ignore/`-prefixed for archived entries — and a
 * staged file looks its name up in the staged index.
 *
 * Multiselect: regular click selects + opens; Ctrl/Cmd-click toggles into the
 * bulk-select set without opening; Shift-click extends a range within the
 * visible file rows. Changing the shown sets clears the selection. Clicking a
 * folder only expands/collapses it — folders are never selected, so bulk
 * actions still operate purely on files.
 */
export default function EditorFileListPanel({
  title,
  entityLabel,
  files,
  archivedFiles,
  selectedFile,
  onSelect,
  // Called with `{ staged }`: true when the list shows only staged files, so
  // the new entity starts with the Staging box checked.
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
  // Staging (HTOO-453). A page that passes onRelease gets the Staged toggle and
  // the Stage/Release action. stagedNamesByFilename is the staged index's,
  // keyed by the staged `rel`.
  stagedFiles,
  stagedNamesByFilename,
  onStage,
  onRelease,
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
  renderSecondary,
  // The page's editor column.
  children
}) {
  const [newMenuAnchor, setNewMenuAnchor] = useState(null)
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState(['active'])
  const [viewMode, setViewMode] = useStoreState(fileListViewModeState)
  const [listRef, listSize] = useAutoSize()
  const [selectedPaths, setSelectedPaths] = useState(() => new Set())
  const [lastClickedPath, setLastClickedPath] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null) // file[] | null
  // Expansion is deliberately not persisted: filtering auto-expands anyway, and
  // persisting would mean a library/type-keyed map to prune as worlds come and
  // go. Keys carry their set (`staged:animist`), so one Set serves every set.
  const [expanded, setExpanded] = useState(() => new Set())

  const hasStaging = !!onRelease
  const hasArchive = !!(onArchive || onUnarchive)
  const folderMode = viewMode === 'folder'

  // Each set's files, filtered with its own names index.
  const setFiles = useMemo(
    () => ({ active: files || [], archived: archivedFiles || [], staged: stagedFiles || [] }),
    [files, archivedFiles, stagedFiles]
  )
  const sections = useMemo(
    () =>
      LIST_SETS.filter((s) => shown.includes(s.key)).map((s) => ({
        ...s,
        files: filterFiles(
          setFiles[s.key],
          search,
          s.key === 'staged' ? stagedNamesByFilename : namesByFilename
        )
      })),
    [shown, setFiles, search, namesByFilename, stagedNamesByFilename]
  )

  // A live filter forces everything open — the surviving tree is only matches
  // plus their ancestors, so revealing all of it is exactly right.
  const { rows, folderKeys: allFolders } = useMemo(
    () => buildListRows({ sections, folderMode, expanded, expandAll: !!search }),
    [sections, folderMode, expanded, search]
  )
  const rowHeight = useMemo(() => rowHeightFor(rows), [rows])

  // Expand/collapse all. `allExpanded` decides which way the one button goes, so
  // it is measured against the tree's own folder keys rather than a count.
  const allExpanded = allFolders.length > 0 && allFolders.every((k) => expanded.has(k))
  const toggleExpandAll = useCallback(
    () => setExpanded(allExpanded ? new Set() : new Set(allFolders)),
    [allExpanded, allFolders]
  )

  // Path → file lookup across every set, to resolve the selection into files.
  const filesByPath = useMemo(() => {
    const m = new Map()
    for (const list of Object.values(setFiles)) for (const f of list) m.set(f.path, f)
    return m
  }, [setFiles])

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

  // A selection never holds a file the list no longer shows.
  useEffect(() => {
    clearSelection()
  }, [shown, clearSelection])

  const toggleFolder = useCallback((key) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // Visible file rows, in render order — the basis for shift-click ranges.
  // Section and folder rows are excluded so a range never sweeps one in.
  const visibleFiles = useMemo(
    () => rows.filter((r) => r.kind === 'file').map((r) => r.file),
    [rows]
  )

  const handleRowClick = useCallback(
    (e, file) => {
      // Ctrl/Cmd-click — toggle membership; do NOT open editor. On macOS it is
      // ⌘-click alone: a Control-click there is a right-click (the context menu).
      if (isModKey(e, window.electronAPI?.platform)) {
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

  const handlers = useMemo(
    () => ({
      archive: onArchive,
      unarchive: onUnarchive,
      stage: onStage,
      release: onRelease,
      duplicate: onDuplicate
    }),
    [onArchive, onUnarchive, onStage, onRelease, onDuplicate]
  )

  const runAction = useCallback(
    async (kind) => {
      closeContextMenu()
      if (kind === 'delete') {
        // Stage for confirmation — actual onDelete fires from the dialog.
        if (onDelete) setPendingDelete(selectedFiles.slice())
        return
      }
      const handler = handlers[kind]
      if (!handler) return
      if (kind === 'duplicate') {
        if (selectedFiles.length !== 1) return
        await handler(selectedFiles[0])
      } else {
        await handler(selectedFiles)
      }
      clearSelection()
    },
    [handlers, onDelete, selectedFiles, clearSelection, closeContextMenu]
  )

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || pendingDelete.length === 0) {
      setPendingDelete(null)
      return
    }
    const list = pendingDelete
    setPendingDelete(null)
    await onDelete?.(list)
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
      stagedNamesByFilename,
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
      stagedNamesByFilename,
      renderSecondary
    ]
  )

  const noun = (title || '').toLowerCase()
  const label = entityLabel || title || 'file'
  const onlyStaged = shown.length === 1 && shown[0] === 'staged'
  const newTooltip = `New ${onlyStaged ? 'staged ' : ''}${label}`
  const selectionCount = selectedPaths.size

  // The smart actions, from the selection, gated on what the page supports.
  const actions = selectionActions(selectedFiles)
  const archiveEnabled = actions.archive.enabled && !!handlers[actions.archive.kind]
  const moveEnabled = actions.move.enabled && !!handlers[actions.move.kind]
  const copyEnabled = actions.copy.enabled && !!onDuplicate
  const deleteEnabled = actions.delete.enabled && !!onDelete
  const archiveIcon =
    actions.archive.kind === 'unarchive' ? (
      <UnarchiveIcon fontSize="small" />
    ) : (
      <ArchiveIcon fontSize="small" />
    )
  const moveIcon =
    actions.move.kind === 'release' ? (
      <PublishIcon fontSize="small" />
    ) : (
      <PendingActionsIcon fontSize="small" />
    )
  const why = (action, enabled) =>
    enabled
      ? `${action} ${selectionCount} item${selectionCount === 1 ? '' : 's'}`
      : selectionCount === 0
        ? `Select item(s) to ${action.toLowerCase()}`
        : `${action} does not apply to this selection`

  // Toggle values in toolbar order, as the mockup has them.
  const toggles = [
    hasStaging && { key: 'staged', label: 'Staged', count: setFiles.staged.length },
    hasArchive && { key: 'archived', label: 'Archived', count: setFiles.archived.length },
    { key: 'active', label: 'Active', count: setFiles.active.length }
  ].filter(Boolean)

  // One value rather than four overlapping booleans, so the states are
  // exclusive by construction instead of by reading three `!loading` guards.
  const shownCount = sections.reduce((n, s) => n + setFiles[s.key].length, 0)
  const listState =
    loading && (files || []).length === 0
      ? 'loading'
      : shownCount === 0
        ? 'empty'
        : rows.length === 0
          ? 'noMatches'
          : 'list'
  const emptyText = onlyStaged
    ? `No staged ${noun}. Stage an active file, or use New while only Staged is shown.`
    : shown.length === 1 && shown[0] === 'archived'
      ? `No archived ${noun}.`
      : shown.length === 1
        ? `No ${noun} found. Check that a library is set in Settings.`
        : `No ${noun} in the sets shown.`

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* ── The page toolbar ── */}
      <Box
        data-testid="page-toolbar"
        role="toolbar"
        aria-label={`${title} toolbar`}
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          flexShrink: 0,
          minHeight: 44,
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Box
          sx={{
            width,
            flexShrink: 0,
            px: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: 1,
            borderColor: 'divider'
          }}
        >
          <Typography variant="h6" noWrap>
            {title}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, minWidth: 0 }}>
          {(extraActions || []).map((action, idx) => (
            <ToolbarButton
              key={idx}
              title={action.tooltip || ''}
              label={action.tooltip}
              disabled={!!action.disabled}
              onClick={action.onClick}
            >
              {action.icon}
            </ToolbarButton>
          ))}
          <ToolbarButton
            title={newMenuItems?.length ? 'Create…' : newTooltip}
            label={newTooltip}
            onClick={(e) =>
              newMenuItems?.length
                ? setNewMenuAnchor(e.currentTarget)
                : onNew?.({ staged: hasStaging && onlyStaged })
            }
          >
            <AddIcon fontSize="small" />
          </ToolbarButton>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <ToolbarButton
            title={folderMode ? 'Grouping by folder' : 'Flat list'}
            label={folderMode ? 'Switch to flat list' : 'Group by folder'}
            onClick={() => setViewMode(folderMode ? 'flat' : 'folder')}
          >
            {folderMode ? <AccountTreeIcon fontSize="small" /> : <ViewListIcon fontSize="small" />}
          </ToolbarButton>
          {folderMode && allFolders.length > 0 && (
            // Disabled while filtering rather than hidden: a live filter forces
            // every surviving folder open, so the button would appear to do
            // nothing. Saying why is better than a control that ignores clicks.
            <ToolbarButton
              title={
                search
                  ? 'Filtering already shows every match'
                  : allExpanded
                    ? 'Collapse all folders'
                    : 'Expand all folders'
              }
              label={allExpanded ? 'Collapse all folders' : 'Expand all folders'}
              disabled={!!search}
              onClick={toggleExpandAll}
            >
              {allExpanded ? (
                <UnfoldLessIcon fontSize="small" />
              ) : (
                <UnfoldMoreIcon fontSize="small" />
              )}
            </ToolbarButton>
          )}
          {toggles.length > 1 && (
            <ToggleButtonGroup
              size="small"
              value={shown}
              // At least one set stays on: an empty list with no way to say why
              // is worse than a toggle that does not turn off.
              onChange={(_, next) => {
                if (next.length) setShown(next)
              }}
              aria-label="Sets to show"
              sx={{ ml: 0.5 }}
            >
              {toggles.map((t) => (
                <ToggleButton
                  key={t.key}
                  value={t.key}
                  aria-label={`${t.label} (${t.count})`}
                  sx={{ py: 0.25, px: 1, textTransform: 'none', whiteSpace: 'nowrap' }}
                >
                  {t.label}
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{ ml: 0.75, color: 'text.secondary' }}
                  >
                    {t.count}
                  </Typography>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {hasArchive && (
            <ToolbarButton
              title={why(actions.archive.label, archiveEnabled)}
              label={actions.archive.label}
              disabled={!archiveEnabled}
              onClick={() => runAction(actions.archive.kind)}
            >
              {archiveIcon}
            </ToolbarButton>
          )}
          {hasStaging && (
            <ToolbarButton
              title={why(actions.move.label, moveEnabled)}
              label={actions.move.label}
              disabled={!moveEnabled}
              onClick={() => runAction(actions.move.kind)}
            >
              {moveIcon}
            </ToolbarButton>
          )}
          {!!onDuplicate && (
            <ToolbarButton
              title={
                copyEnabled
                  ? 'Duplicate'
                  : selectionCount > 1
                    ? 'Duplicate is single-item only'
                    : 'Select an item to duplicate'
              }
              label="Duplicate"
              disabled={!copyEnabled}
              onClick={() => runAction('duplicate')}
            >
              <ContentCopyIcon fontSize="small" />
            </ToolbarButton>
          )}
          {!!onDelete && (
            <ToolbarButton
              title={why('Delete', deleteEnabled)}
              label="Delete"
              disabled={!deleteEnabled}
              onClick={() => runAction('delete')}
            >
              <DeleteIcon fontSize="small" />
            </ToolbarButton>
          )}
        </Box>
      </Box>

      {/* New (+) dropdown — only when newMenuItems provided */}
      <Menu
        open={!!newMenuAnchor}
        anchorEl={newMenuAnchor}
        onClose={() => setNewMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
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

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* ── The file list ── */}
        <Box
          data-testid="file-list"
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

          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {listState === 'loading' && (
              <Box
                sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <CircularProgress size={24} />
              </Box>
            )}

            {listState === 'empty' && (
              <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>
                {emptyText}
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
        </Box>

        {/* ── The editor column, with the alerts area for its header ── */}
        <EditorAlertsProvider>{children}</EditorAlertsProvider>
      </Box>

      {/* Context menu — mirrors the toolbar's item actions */}
      <Menu
        open={!!contextMenu}
        onClose={closeContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined}
      >
        {hasArchive && (
          <MenuItem disabled={!archiveEnabled} onClick={() => runAction(actions.archive.kind)}>
            <ListItemIcon>{archiveIcon}</ListItemIcon>
            {actions.archive.label}
            {selectionCount > 1 ? ` (${selectionCount})` : ''}
          </MenuItem>
        )}
        {hasStaging && (
          <MenuItem disabled={!moveEnabled} onClick={() => runAction(actions.move.kind)}>
            <ListItemIcon>{moveIcon}</ListItemIcon>
            {actions.move.label}
            {selectionCount > 1 ? ` (${selectionCount})` : ''}
          </MenuItem>
        )}
        {!!onDuplicate && (
          <MenuItem disabled={!copyEnabled} onClick={() => runAction('duplicate')}>
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            Duplicate
          </MenuItem>
        )}
        {!!onDelete && (
          <MenuItem disabled={!deleteEnabled} onClick={() => runAction('delete')}>
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
                  {displayNameFor(f, f.staged ? stagedNamesByFilename : namesByFilename)}
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
