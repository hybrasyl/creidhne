import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
} from '@mui/material';

function UnsavedChangesDialog({ open, label, onSave, onDiscard, onCancel }) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Unsaved Changes</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {label ? `"${label}" has unsaved changes.` : 'You have unsaved changes.'}{' '}
          Save before continuing?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onDiscard} color="error">Discard</Button>
        <Button onClick={onSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}

export default UnsavedChangesDialog;
