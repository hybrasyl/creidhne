import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography
} from '@mui/material'
import { countLabel } from '@shared/renameRepair.js'

/**
 * The confirm step for a rename that other files depend on (HTOO-378).
 *
 * Three answers, and the middle one is the one users get wrong, so it is spelled
 * out rather than labelled:
 *
 *   Update    save the entity AND repoint every file listed
 *   Skip      save the entity, leave the references pointing at the old name
 *   Cancel    write nothing at all
 *
 * Nothing has been written when this opens. That is what makes Cancel truthful
 * and what makes the count accurate: it describes the files as they stand, not
 * as they were before a save that already happened.
 */
export default function RenameReferencesDialog({
  open,
  scanning,
  oldName,
  newName,
  result,
  onUpdate,
  onSkip,
  onCancel
}) {
  const files = result?.files ?? []
  const total = result?.total ?? 0
  const unreadable = result?.unreadable ?? []

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Other files use this name</DialogTitle>
      <DialogContent>
        {scanning ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
            <CircularProgress size={20} />
            <Typography variant="body2">Looking for files that use “{oldName}”…</Typography>
          </Box>
        ) : (
          <>
            <DialogContentText component="div">
              A name is a key, so renaming <b>{oldName}</b> to <b>{newName}</b> leaves{' '}
              {countLabel(total, 'reference')} in {countLabel(files.length, 'file')} pointing at a
              name that no longer exists.
            </DialogContentText>

            <List dense sx={{ maxHeight: 260, overflowY: 'auto', mt: 1 }}>
              {files.map((f) => (
                <ListItem key={`${f.sourceType}/${f.rel}`} disableGutters>
                  <ListItemText
                    primary={`${f.sourceType}/${f.rel}`}
                    secondary={countLabel(f.count, 'reference')}
                    slotProps={{ primary: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
                  />
                </ListItem>
              ))}
            </List>

            {unreadable.length > 0 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {countLabel(unreadable.length, 'file')} could not be read, so this list may be
                incomplete: {unreadable.map((f) => f.rel).join(', ')}
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {/* Ordered least to most destructive, left to right, and each says what
            it does rather than assuming the verb is obvious. */}
        <Button onClick={onCancel} color="inherit">
          Cancel — write nothing
        </Button>
        <Button onClick={onSkip} disabled={scanning} color="inherit">
          Skip — save only this file
        </Button>
        <Button onClick={onUpdate} disabled={scanning || total === 0} variant="contained">
          Update {countLabel(files.length, 'file')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
