import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  IconButton,
  Chip,
  CircularProgress
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import HelpIcon from '@mui/icons-material/Help'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useRecoilState } from 'recoil'
import { activeLibraryState, libraryIndexState } from '../recoil/atoms'
import { useLibraryIndexHydration } from '../hooks/useLibraryIndexHydration'

function IndexStatus({ status, building, onBuild }) {
  if (building) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={14} />
        <Typography variant="caption" sx={{
          color: "text.secondary"
        }}>
          Building...
        </Typography>
      </Box>
    );
  }

  if (!status) return null

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {status.exists ? (
        <>
          <Chip
            label={`Index built ${new Date(status.builtAt).toLocaleDateString()}`}
            size="small"
            color="success"
            variant="outlined"
          />
          <Tooltip title="Rebuild index">
            <IconButton size="small" onClick={onBuild}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      ) : (
        <>
          <Chip label="Index not built" size="small" color="warning" variant="outlined" />
          <Button size="small" variant="outlined" onClick={onBuild}>
            Build Index
          </Button>
        </>
      )}
    </Box>
  )
}

const ManageLibraries = ({ libraries, onAddLibrary, onRemoveLibrary }) => {
  const [selectedLibrary, setSelectedLibrary] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [activeLibrary, setActiveLibrary] = useRecoilState(activeLibraryState)
  const [, setLibraryIndex] = useRecoilState(libraryIndexState)
  const [indexStatuses, setIndexStatuses] = useState({})
  const [building, setBuilding] = useState({})
  const hydrateLibraryIndex = useLibraryIndexHydration()

  const loadStatuses = useCallback(async () => {
    const statuses = {}
    for (const lib of libraries) {
      statuses[lib] = await window.electronAPI.getIndexStatus(lib)
    }
    setIndexStatuses(statuses)
  }, [libraries])

  useEffect(() => {
    loadStatuses()
  }, [loadStatuses])

  const handleBuildIndex = async (library) => {
    setBuilding((prev) => ({ ...prev, [library]: true }))
    try {
      const result = await window.electronAPI.buildIndex(library)
      setIndexStatuses((prev) => ({
        ...prev,
        [library]: { exists: true, builtAt: result.builtAt }
      }))
      if (library === activeLibrary) {
        await hydrateLibraryIndex(library)
      }
    } finally {
      setBuilding((prev) => ({ ...prev, [library]: false }))
    }
  }

  const handleSetActive = (library) => {
    setActiveLibrary(library)
  }

  const handleRemoveClick = () => {
    setConfirmOpen(true)
  }

  const handleConfirmClose = async (confirmed) => {
    setConfirmOpen(false)
    if (!confirmed) return
    await window.electronAPI.deleteIndex(selectedLibrary)
    if (selectedLibrary === activeLibrary) {
      setActiveLibrary(null)
      setLibraryIndex({})
    }
    onRemoveLibrary(selectedLibrary)
    setSelectedLibrary('')
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: 'text.button', fontWeight: 'bold' }}>
          Manage Libraries
        </Typography>
        <Tooltip
          title="Add the world/xml directory of your Hybrasyl repo (e.g. path/to/world/xml). Each library maintains its own index for autocomplete."
          placement="top"
        >
          <IconButton sx={{ ml: 1, color: 'text.button' }}>
            <HelpIcon />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAddLibrary}>
          Add Library
        </Button>
        <Tooltip title="Remove selected library">
          <span>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleRemoveClick}
              disabled={!selectedLibrary}
            >
              Remove
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Set selected library as active">
          <span>
            <Button
              variant="contained"
              color="success"
              onClick={() => handleSetActive(selectedLibrary)}
              disabled={!selectedLibrary || selectedLibrary === activeLibrary}
            >
              Set Active
            </Button>
          </span>
        </Tooltip>
      </Box>
      <List sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 0 }}>
        {libraries.length === 0 && (
          <ListItem>
            <ListItemText
              primary={
                <Typography variant="body2" sx={{
                  color: "text.secondary"
                }}>
                  No libraries added yet.
                </Typography>
              }
            />
          </ListItem>
        )}
        {libraries.map((library) => (
          <ListItem
            key={library}
            button
            selected={selectedLibrary === library}
            onClick={() => setSelectedLibrary(library)}
            sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 1.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <Typography
                variant="body2"
                sx={{ flex: 1, color: 'text.button', wordBreak: 'break-all' }}
              >
                {library}
              </Typography>
              {library === activeLibrary && (
                <Chip label="Active" size="small" color="primary" icon={<CheckCircleIcon />} />
              )}
            </Box>
            <Box sx={{ mt: 0.5 }}>
              <IndexStatus
                status={indexStatuses[library]}
                building={building[library] ?? false}
                onBuild={() => handleBuildIndex(library)}
              />
            </Box>
          </ListItem>
        ))}
      </List>
      <Dialog open={confirmOpen} onClose={() => handleConfirmClose(false)}>
        <DialogTitle>Remove Library</DialogTitle>
        <DialogContent>
          <Typography>
            Remove <strong>{selectedLibrary}</strong>?
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mt: 1
            }}>
            Its index file will also be deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleConfirmClose(false)}>Cancel</Button>
          <Button onClick={() => handleConfirmClose(true)} color="error">
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ManageLibraries
