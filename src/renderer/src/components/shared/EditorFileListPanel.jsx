import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { List as VirtualList } from 'react-window'
import {
  Box,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Tooltip,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import FolderIcon from '@mui/icons-material/Folder'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ClearIcon from '@mui/icons-material/Clear'
import { useStoreState, fileListViewModeState } from '../../store/appStore'
import { isModKey } from '../../utils/modKey'
import EditorPageShell from '../editorShell/EditorPageShell'
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
  onToggleSet,
  namesByFilename,
  stagedNamesByFilename,
  renderSecondary
}) {
  const row = rows[index]
  const indent = 1 + row.depth * INDENT_STEP

  if (row.kind === 'section') {
    return (
      <ListItem disablePadding style={style}>
        <ListItemButton
          data-testid={`list-section-${row.set}`}
          aria-expanded={row.open}
          onClick={() => onToggleSet(row.set)}
          sx={{
            height: SECTION_HEIGHT,
            px: 1,
            gap: 0.5,
            bgcolor: 'action.hover',
            borderBottom: 1,
            borderColor: 'divider'
          }}
        >
          {row.open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          <Typography variant="overline" sx={{ lineHeight: 1, flex: 1 }}>
            {row.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {row.count}
          </Typography>
        </ListItemButton>
      </ListItem>
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

/**
 * Creidhne's editor page: the house editor shell
 * (`editorShell/EditorPageShell.jsx`, HTOO-637) with Creidhne's list.
 *
 *   (Page name) | (New) | (Flat) (Staged) (Archived) (Active) | (Archive) (Stage) (Copy) (Delete)
 *
 * The shell owns the toolbar, the context menu, the delete confirmation and the
 * alerts provider around the editor column. Its item actions follow the
 * selection this file gives it: each is enabled only when it applies to every
 * selected file, Archive becomes Unarchive for archived files, and Stage
 * becomes Release for staged files (`editorShell/selectionActions.js`).
 *
 * This file owns the list: the filter, the set headers, the folder tree, the
 * virtualized rows and the multi-select.
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
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState(['active'])
  const [viewMode, setViewMode] = useStoreState(fileListViewModeState)
  const [listRef, listSize] = useAutoSize()
  const [selectedPaths, setSelectedPaths] = useState(() => new Set())
  const shell = useRef(null)
  const [lastClickedPath, setLastClickedPath] = useState(null)
  // Expansion is deliberately not persisted: filtering auto-expands anyway, and
  // persisting would mean a library/type-keyed map to prune as worlds come and
  // go. Keys carry their set (`staged:animist`), so one Set serves every set.
  const [expanded, setExpanded] = useState(() => new Set())
  // The sets whose header is collapsed. Not persisted, like folder expansion.
  const [collapsedSets, setCollapsedSets] = useState(() => new Set())

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
    () =>
      buildListRows({
        sections,
        folderMode,
        expanded,
        expandAll: !!search,
        collapsed: collapsedSets
      }),
    [sections, folderMode, expanded, search, collapsedSets]
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

  const toggleSet = useCallback((key) => {
    setCollapsedSets((prev) => {
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
      shell.current?.openContextMenu(e)
    },
    [selectedPaths, updateSelection]
  )

  const selectedFiles = useMemo(() => {
    const out = []
    for (const p of selectedPaths) {
      const f = filesByPath.get(p)
      if (f) out.push(f)
    }
    return out
  }, [selectedPaths, filesByPath])

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
      onToggleSet: toggleSet,
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
      toggleSet,
      namesByFilename,
      stagedNamesByFilename,
      renderSecondary
    ]
  )

  const noun = (title || '').toLowerCase()
  const label = entityLabel || title || 'file'
  const onlyStaged = shown.length === 1 && shown[0] === 'staged'
  const newTooltip = `New ${onlyStaged ? 'staged ' : ''}${label}`

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

  const describeFile = useCallback(
    (f) => displayNameFor(f, f.staged ? stagedNamesByFilename : namesByFilename),
    [namesByFilename, stagedNamesByFilename]
  )

  return (
    <EditorPageShell
      ref={shell}
      title={title}
      entityLabel={label}
      width={width}
      newLabel={newTooltip}
      onNew={() => onNew?.({ staged: hasStaging && onlyStaged })}
      newMenuItems={newMenuItems}
      extraActions={extraActions}
      folderMode={folderMode}
      onFolderModeChange={(folder) => setViewMode(folder ? 'folder' : 'flat')}
      expandAll={
        folderMode && allFolders.length > 0
          ? { allExpanded, filtering: !!search, onToggle: toggleExpandAll }
          : null
      }
      sets={toggles}
      shownSets={shown}
      onShownSetsChange={setShown}
      selection={selectedFiles}
      describeFile={describeFile}
      onArchive={onArchive}
      onUnarchive={onUnarchive}
      onStage={onStage}
      onRelease={onRelease}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onActionDone={clearSelection}
      list={
        <>
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
        </>
      }
    >
      {children}
    </EditorPageShell>
  )
}
