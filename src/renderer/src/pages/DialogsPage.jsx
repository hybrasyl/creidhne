import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Tooltip,
  Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import IosShareIcon from '@mui/icons-material/IosShare'
import { newDocument, normalizeDocument } from '@shared/dialogDocument.js'
import { validateDialogDocument } from '@shared/dialogValidate.js'
import { useStoreValue, activeLibraryState } from '../store/appStore'
import { useUnsavedGuard } from '../hooks/useUnsavedGuard'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'
import DialogEditor from '../components/dialogs/DialogEditor'
import ExportDialog from '../components/dialogs/ExportDialog'

// The dialog builder (HTOO-458). A writer composes an NPC dialog here — sequences,
// dialogs, options, jumps, pursuits — and exports it as Lua to paste into a
// script's OnSpawn. Nothing is written into scripts/.
//
// The document is saved as JSON under world/.creidhne/dialogs/, and that is the
// one thing held constant: it is what keeps copy/paste from being a one-way
// door, and it is the document HTOO-141's compiler and modules will consume.
//
// Save takes any structurally valid document — a draft may have a dangling
// jump. Export is what validation gates.

function DialogsPage() {
  const activeLibrary = useStoreValue(activeLibraryState)
  const [list, setList] = useState([])
  const [listProblems, setListProblems] = useState([])
  const [doc, setDoc] = useState(null)
  // The name the open document was loaded under; a save under a different name
  // is a rename, and main removes the old file.
  const [loadedName, setLoadedName] = useState(null)
  const [status, setStatus] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  // The name awaiting a confirmed delete, or null. Deleting removes a file
  // from the world, so it is never one click.
  const [pendingDelete, setPendingDelete] = useState(null)

  const {
    markDirty,
    markClean,
    saveRef,
    guard,
    dialogOpen,
    handleDialogSave,
    handleDialogDiscard,
    handleDialogCancel
  } = useUnsavedGuard('Dialog')

  const refreshList = useCallback(async () => {
    if (!activeLibrary) {
      setList([])
      setListProblems([])
      return
    }
    const result = await window.electronAPI.listDialogs(activeLibrary)
    setList(result.dialogs ?? [])
    setListProblems(result.problems ?? [])
  }, [activeLibrary])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  // Validation runs on every edit; it is cheap (a walk of the document) and the
  // rows use it to mark their own fields.
  const problems = useMemo(
    () => (doc ? validateDialogDocument(doc) : { errors: [], warnings: [] }),
    [doc]
  )

  const openDocument = (name) =>
    guard(async () => {
      const result = await window.electronAPI.loadDialog(activeLibrary, name)
      if (result.error) {
        setStatus({ type: 'error', message: result.error })
        return
      }
      setDoc(result.document)
      setLoadedName(name)
      setStatus(null)
      markClean()
    })

  const handleNew = () =>
    guard(() => {
      setDoc(newDocument(''))
      setLoadedName(null)
      setStatus(null)
      markClean()
    })

  const updateDoc = (updater) => {
    setDoc((d) => normalizeDocument(typeof updater === 'function' ? updater(d) : updater))
    markDirty()
  }

  const handleSave = useCallback(async () => {
    if (!activeLibrary || !doc) return
    // The name is the file: refuse an invalid one here with the same message
    // the validator gives, rather than letting the boundary schema reject it.
    const nameProblem = problems.errors.find((e) => e.field === 'name')
    if (nameProblem) {
      setStatus({ type: 'error', message: nameProblem.message })
      throw new Error(nameProblem.message)
    }
    const result = await window.electronAPI.saveDialog(activeLibrary, doc, loadedName)
    if (result.error) {
      setStatus({ type: 'error', message: result.error })
      throw new Error(result.error)
    }
    setLoadedName(doc.name)
    setStatus({ type: 'success', message: `Saved ${doc.name}.json.` })
    markClean()
    await refreshList()
  }, [activeLibrary, doc, loadedName, problems, markClean, refreshList])

  // The unsaved-changes dialogs call whatever is current.
  saveRef.current = handleSave

  // Deletes a saved document by name — the open one, or any entry in the list.
  // If it is the open one, the editor closes with it.
  const handleDelete = async (name) => {
    setPendingDelete(null)
    if (!activeLibrary || !name) return
    const result = await window.electronAPI.deleteDialog(activeLibrary, name)
    if (result?.error) {
      setStatus({ type: 'error', message: result.error })
      return
    }
    if (name === loadedName) {
      setDoc(null)
      setLoadedName(null)
      markClean()
    }
    setStatus({ type: 'info', message: `Deleted ${name}.json.` })
    await refreshList()
  }

  // A new document that was never saved has no file; discarding it is just
  // closing the editor, and the unsaved-changes guard has nothing to protect.
  const handleDiscard = () => {
    setDoc(null)
    setLoadedName(null)
    setStatus(null)
    markClean()
  }

  if (!activeLibrary) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">No library selected. Open a library from Settings first.</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, p: 3, height: '100%', overflow: 'hidden' }}>
      <Paper
        variant="outlined"
        sx={{
          width: 240,
          p: 1,
          overflow: 'auto',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            Dialogs
          </Typography>
          <Tooltip title="New dialog">
            <IconButton size="small" onClick={handleNew}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        {list.length === 0 && !doc ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', px: 1 }}>
            No dialogs saved yet. Start one with +.
          </Typography>
        ) : (
          <List dense disablePadding>
            {doc && !loadedName && (
              <ListItemButton selected>
                <ListItemText
                  primary={doc.name || 'untitled'}
                  secondary="unsaved"
                  slotProps={{ primary: { variant: 'body2' }, secondary: { variant: 'caption' } }}
                />
              </ListItemButton>
            )}
            {list.map((entry) => (
              <ListItemButton
                key={entry.name}
                selected={loadedName === entry.name}
                onClick={() => openDocument(entry.name)}
                sx={{
                  pr: 0.5,
                  '& .delete-entry': { opacity: 0 },
                  '&:hover .delete-entry': { opacity: 1 }
                }}
              >
                <ListItemText
                  primary={entry.title || entry.name}
                  secondary={`${entry.name} · ${entry.sequences} sequence${entry.sequences === 1 ? '' : 's'}`}
                  slotProps={{ primary: { variant: 'body2' }, secondary: { variant: 'caption' } }}
                />
                <Tooltip title={`Delete ${entry.name}.json`}>
                  <IconButton
                    className="delete-entry"
                    size="small"
                    aria-label={`Delete ${entry.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setPendingDelete(entry.name)
                    }}
                    sx={{ '&:focus-visible': { opacity: 1 } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItemButton>
            ))}
          </List>
        )}
        {listProblems.length > 0 && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            {listProblems.map((p) => (
              <div key={p}>{p}</div>
            ))}
          </Alert>
        )}
      </Paper>

      <Box
        sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {status && (
          <Alert severity={status.type} onClose={() => setStatus(null)} sx={{ mb: 1 }}>
            {status.message}
          </Alert>
        )}
        {doc ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="h5" sx={{ flex: 1 }}>
                {doc.title || doc.name || 'New dialog'}
              </Typography>
              {problems.errors.length > 0 ? (
                <Typography variant="caption" color="error">
                  {problems.errors.length} error{problems.errors.length === 1 ? '' : 's'}
                </Typography>
              ) : problems.warnings.length > 0 ? (
                <Typography variant="caption" sx={{ color: 'warning.main' }}>
                  {problems.warnings.length} warning{problems.warnings.length === 1 ? '' : 's'}
                </Typography>
              ) : null}
              <Button
                size="small"
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => handleSave().catch(() => {})}
              >
                Save
              </Button>
              <Tooltip
                title={
                  problems.errors.length > 0
                    ? 'Fix the errors before exporting'
                    : 'Render the Lua to paste into a script'
                }
              >
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<IosShareIcon />}
                    disabled={problems.errors.length > 0}
                    onClick={() => setExportOpen(true)}
                  >
                    Export
                  </Button>
                </span>
              </Tooltip>
              {loadedName ? (
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setPendingDelete(loadedName)}
                >
                  Delete
                </Button>
              ) : (
                <Tooltip title="Close this new dialog without saving it">
                  <Button size="small" color="inherit" onClick={handleDiscard}>
                    Discard
                  </Button>
                </Tooltip>
              )}
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <DialogEditor doc={doc} onChange={updateDoc} problems={problems} />
            </Box>
          </>
        ) : (
          <Box sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ mb: 1 }}>
              Dialog builder
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 640 }}>
              Compose an NPC dialog — sequences, options, jumps and pursuits — then export it as Lua
              to paste into the NPC&apos;s script. Documents are saved in the world under
              <code> .creidhne/dialogs/</code>, so they can be reopened and edited here. Pick a
              dialog on the left or start a new one with +.
            </Typography>
          </Box>
        )}
      </Box>

      {doc && <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} doc={doc} />}
      <UnsavedChangesDialog
        open={dialogOpen}
        label="Dialog"
        onSave={handleDialogSave}
        onDiscard={handleDialogDiscard}
        onCancel={handleDialogCancel}
      />
      <Dialog open={!!pendingDelete} onClose={() => setPendingDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete {pendingDelete}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This removes <code>.creidhne/dialogs/{pendingDelete}.json</code> from the world. Lua you
            have already pasted into a script is not affected.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => handleDelete(pendingDelete)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default DialogsPage
