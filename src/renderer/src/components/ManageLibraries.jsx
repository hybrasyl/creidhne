import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import HelpIcon from '@mui/icons-material/Help';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const ManageLibraries = ({ libraries, onAddLibrary, onRemoveLibrary }) => {
  const [selectedLibrary, setSelectedLibrary] = useState('');
  const [activeLibrary, setActiveLibrary] = useState(null);
  const [open, setOpen] = useState(false);

  const handleRemoveLibrary = () => {
    setOpen(true);
  };

  const handleClose = (confirmed) => {
    setOpen(false);
    if (confirmed) {
      onRemoveLibrary(selectedLibrary);
      if (selectedLibrary === activeLibrary) {
        setActiveLibrary(null);
      }
      setSelectedLibrary('');
    }
  };

  const handleUseLibrary = () => {
    setActiveLibrary(selectedLibrary);
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ textAlign: 'center', color: "text.button", fontWeight: 'bold' }}>
          Manage Libraries
        </Typography>
        <Tooltip
          title="Make sure to add the root directory of your repo. If you are working with Ceridwen, you would select '/path-to/Ceridwen', not '/path-to/Ceridwen/xml'. This tool requires that your xml directories match the structure in Ceridwen - please review the repo for help on getting your directories in order."
          placement="top"
        >
          <IconButton sx={{ ml: 1, color: "text.button" }}>
            <HelpIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Tooltip title="Add the root directory of your repo">
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAddLibrary}>
          Add
        </Button>
      </Tooltip>
      <Tooltip title="Remove a repo from management">
        <span>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleRemoveLibrary}
            disabled={!selectedLibrary}
            sx={{ ml: 2 }}
          >
            Remove
          </Button>
        </span>
      </Tooltip>
      <Tooltip title="Set this repo as active">
        <span>
          <Button
            variant="contained"
            color="success"
            onClick={handleUseLibrary}
            disabled={!selectedLibrary}
            sx={{ ml: 2 }}
          >
            Use this Repo
          </Button>
        </span>
      </Tooltip>
      <List sx={{ mt: 2, maxHeight: 200, overflow: 'auto', border: '1px solid gray', borderRadius: '4px' }}>
        {libraries.map((library, index) => (
          <ListItem
            key={index}
            button
            selected={selectedLibrary === library}
            onClick={() => setSelectedLibrary(library)}
          >
            <Typography variant="body2" sx={{ color: "text.button"}}>{library}</Typography>
            {library === activeLibrary && <CheckCircleIcon color="success" sx={{ ml: 1 }} />}
          </ListItem>
        ))}
      </List>
      <Dialog open={open} onClose={() => handleClose(false)}>
        <DialogTitle>Confirm Removal</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to remove "{selectedLibrary}"?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleClose(false)}>Cancel</Button>
          <Button onClick={() => handleClose(true)} color="error">
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManageLibraries;
