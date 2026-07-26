import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Snackbar,
  Tooltip,
  Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import SaveIcon from '@mui/icons-material/Save'
import { useStoreValue, activeLibraryState, libraryIndexState } from '../store/appStore'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'
import { useLibraryIndexHydration } from '../hooks/useLibraryIndexHydration'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'
import SpellbookEditor from '../components/spellbooks/SpellbookEditor'
import { spellbookWriteCount } from '../utils/spellbook'

// Above this many castable files rewritten, confirm before applying — a large
// included category can stamp the book name onto many files at once.
const WARN_THRESHOLD = 10

const emptyBook = () => ({
  id: crypto.randomUUID(),
  name: 'New Spellbook',
  castables: [],
  categories: []
})

export default function SpellbooksPage() {
  const activeLibrary = useStoreValue(activeLibraryState)
  const libraryIndex = useStoreValue(libraryIndexState)
  const hydrate = useLibraryIndexHydration()

  // Full constants object (kept so other keys survive a save) and its last-saved
  // spellBooks snapshot (for rename detection + dirty compares).
  const [constantsBase, setConstantsBase] = useState({})
  const [books, setBooks] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState(null)
  const [warn, setWarn] = useState(null) // { count, onConfirm }

  const {
    markDirty,
    markClean,
    saveRef,
    guard,
    dialogOpen,
    handleDialogSave,
    handleDialogDiscard,
    handleDialogCancel
  } = useUnsavedGuard('Spellbook')

  const handleSaveRef = useRef(null)
  useEffect(() => {
    saveRef.current = () => handleSaveRef.current?.()
  })

  useEffect(() => {
    if (!activeLibrary) {
      setConstantsBase({})
      setBooks([])
      setSelectedId(null)
      return
    }
    window.electronAPI
      .loadUserConstants(activeLibrary)
      .then((data) => {
        const loaded = data || {}
        setConstantsBase(loaded)
        setBooks((loaded.spellBooks || []).map((b) => ({ categories: [], castables: [], ...b })))
      })
      .catch(console.error)
    setSelectedId(null)
    markClean()
  }, [activeLibrary, markClean])

  const selected = useMemo(
    () => (selectedId ? books.find((b) => b.id === selectedId) : null),
    [books, selectedId]
  )

  const updateSelected = useCallback(
    (partial) => {
      if (!selectedId) return
      setBooks((prev) => prev.map((b) => (b.id === selectedId ? { ...b, ...partial } : b)))
      markDirty()
    },
    [selectedId, markDirty]
  )

  const handleNew = () =>
    guard(() => {
      const b = emptyBook()
      setBooks((prev) => [...prev, b])
      setSelectedId(b.id)
      markDirty()
    })

  const handleDuplicate = () => {
    if (!selected) return
    guard(() => {
      const copy = { ...selected, id: crypto.randomUUID(), name: `${selected.name} copy` }
      setBooks((prev) => [...prev, copy])
      setSelectedId(copy.id)
      markDirty()
    })
  }

  const handleSelect = (id) => guard(() => setSelectedId(id))

  // Persist constants (with the current books) and reconcile the given book's
  // category tags on castables, then re-index and refresh the store.
  const persist = useCallback(
    async (nextBooks, applyBook, prevName) => {
      const nextConstants = { ...constantsBase, spellBooks: nextBooks }
      await window.electronAPI.saveUserConstants(activeLibrary, nextConstants)
      let summary = null
      if (applyBook) {
        summary = await window.electronAPI.spellbookApply(activeLibrary, {
          name: applyBook.name,
          prevName,
          castables: applyBook.castables,
          categories: applyBook.categories
        })
      }
      await window.electronAPI.buildIndexSection(activeLibrary, 'castables')
      await hydrate(activeLibrary)
      setConstantsBase(nextConstants)
      setBooks(nextBooks)
      return summary
    },
    [activeLibrary, constantsBase, hydrate]
  )

  const doSave = useCallback(async () => {
    if (!selected || !activeLibrary || !selected.name.trim()) return
    setSaving(true)
    try {
      const prevName = (constantsBase.spellBooks || []).find((b) => b.id === selected.id)?.name
      const summary = await persist(books, selected, prevName)
      markClean()
      const { added = [], removed = [], failed = [] } = summary || {}
      setSnackbar({
        severity: failed.length ? 'warning' : 'success',
        message: `Saved. ${added.length} tagged, ${removed.length} untagged${
          failed.length ? `, ${failed.length} failed` : ''
        }.`
      })
    } catch (err) {
      setSnackbar({ severity: 'error', message: `Save failed: ${err?.message || err}` })
    } finally {
      setSaving(false)
    }
  }, [selected, activeLibrary, constantsBase, books, persist, markClean])

  // Save button: warn first if the apply would rewrite many castable files.
  const handleSaveClick = useCallback(() => {
    if (!selected) return
    const prevName = (constantsBase.spellBooks || []).find((b) => b.id === selected.id)?.name
    const count = spellbookWriteCount(selected, libraryIndex?.castableCategoryMembers, prevName)
    if (count > WARN_THRESHOLD) {
      setWarn({ count, onConfirm: doSave })
      return
    }
    doSave()
  }, [selected, constantsBase, libraryIndex, doSave])

  // Register save with the unsaved guard (used on navigate / file-switch).
  handleSaveRef.current = handleSaveClick

  const handleDelete = async () => {
    if (!selected || !activeLibrary) return
    setSaving(true)
    try {
      // Strip the book's category tag from every castable that carries it.
      await window.electronAPI.spellbookApply(activeLibrary, {
        name: selected.name,
        castables: [],
        categories: []
      })
      const nextBooks = books.filter((b) => b.id !== selected.id)
      await persist(nextBooks, null)
      setSelectedId(null)
      markClean()
      setSnackbar({ severity: 'success', message: `Deleted "${selected.name}".` })
    } catch (err) {
      setSnackbar({ severity: 'error', message: `Delete failed: ${err?.message || err}` })
    } finally {
      setSaving(false)
    }
  }

  if (!activeLibrary) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">Open a world to edit spellbooks.</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
      {/* Left: book list */}
      <Box
        sx={{
          width: 240,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.5 }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            Spellbooks
          </Typography>
          <Tooltip title="New spellbook">
            <IconButton size="small" onClick={handleNew}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Divider />
        <List dense disablePadding sx={{ overflow: 'auto', flex: 1 }}>
          {books.map((book) => (
            <ListItem key={book.id} disablePadding>
              <ListItemButton
                selected={book.id === selectedId}
                onClick={() => handleSelect(book.id)}
              >
                <ListItemText
                  primary={book.name || '(unnamed)'}
                  secondary={`${(book.categories || []).length} cat · ${(book.castables || []).length} direct`}
                />
              </ListItemButton>
            </ListItem>
          ))}
          {books.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No spellbooks yet. Create one with +.
            </Typography>
          )}
        </List>
      </Box>

      {/* Right: editor */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {selected ? (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1,
                borderBottom: 1,
                borderColor: 'divider'
              }}
            >
              <Typography variant="subtitle1" sx={{ flex: 1 }} noWrap>
                {selected.name || '(unnamed)'}
              </Typography>
              <Button
                size="small"
                startIcon={<ContentCopyIcon />}
                onClick={handleDuplicate}
                disabled={saving}
              >
                Duplicate
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
                disabled={saving}
              >
                Delete
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveClick}
                disabled={saving || !selected.name.trim()}
              >
                Save &amp; Apply
              </Button>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <SpellbookEditor book={selected} onChange={updateSelected} />
            </Box>
          </>
        ) : (
          <Box sx={{ p: 3 }}>
            <Typography color="text.secondary">
              Select a spellbook, or create one with +.
            </Typography>
          </Box>
        )}
      </Box>

      {/* Warn-before-write confirm */}
      <Dialog open={!!warn} onClose={() => setWarn(null)}>
        <DialogTitle>Apply to many castables?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Saving this spellbook will edit {warn?.count} castable files to add or remove its
            category. Continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWarn(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const fn = warn?.onConfirm
              setWarn(null)
              fn?.()
            }}
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>

      <UnsavedChangesDialog
        open={dialogOpen}
        label="Spellbook"
        onSave={handleDialogSave}
        onDiscard={handleDialogDiscard}
        onCancel={handleDialogCancel}
      />

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)}>
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}
