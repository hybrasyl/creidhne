import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Tooltip, IconButton, Paper, Stack,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ClearIcon from '@mui/icons-material/Clear';
import HelpIcon from '@mui/icons-material/Help';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { useRecoilState } from 'recoil';
import { clientPathState } from '../recoil/atoms';
import { clearAllClientCaches } from '../utils/daClient';
// Side-effect imports: register per-picker cache clearers.
import '../data/itemSpriteData';
import '../data/itemColorData';
import '../data/soundData';
import '../data/effectData';
import '../data/khanData';

const STATUS_COLORS = {
  green:  '#2e7d32',
  yellow: '#ed6c02',
  red:    '#d32f2f',
  gray:   '#9e9e9e',
};

const STATUS_LABELS = {
  green:  'All known client files found',
  yellow: 'Some client files missing — partial picker support',
  red:    'No expected files found — wrong directory?',
  gray:   'No path set',
};

function StatusIndicator({ status, files }) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  const tooltipBody = (
    <Box sx={{ p: 0.5, minWidth: 240 }}>
      <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {files.length === 0 ? (
        <Typography variant="caption" color="inherit">
          Set the path to see file status.
        </Typography>
      ) : (
        <Stack spacing={0.25}>
          {files.map((f) => (
            <Box key={f.rel} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {f.found
                ? <CheckCircleOutlineIcon fontSize="inherit" sx={{ color: '#81c784' }} />
                : <HighlightOffIcon fontSize="inherit" sx={{ color: '#e57373' }} />}
              <Typography variant="caption" sx={{ flex: 1 }}>
                <code>{f.rel}</code> — {f.category}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );

  return (
    <Tooltip title={tooltipBody} placement="right" arrow>
      <Box
        sx={{
          width: 14, height: 14, borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}`,
          cursor: 'help',
          flexShrink: 0,
        }}
      />
    </Tooltip>
  );
}

const DAClientPathSection = () => {
  const [clientPath, setClientPath] = useRecoilState(clientPathState);
  const [check, setCheck] = useState({ status: 'gray', files: [] });

  const refreshCheck = useCallback(async (path) => {
    const result = await window.electronAPI.checkClientPath(path);
    setCheck(result);
  }, []);

  useEffect(() => {
    refreshCheck(clientPath);
  }, [clientPath, refreshCheck]);

  const handleBrowse = async () => {
    const dir = await window.electronAPI.openDirectory();
    if (!dir) return;
    clearAllClientCaches();
    setClientPath(dir);
  };

  const handleClear = () => {
    clearAllClientCaches();
    setClientPath(null);
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: 'text.button', fontWeight: 'bold' }}>
          Dark Ages Client
        </Typography>
        <Tooltip
          title="Path to your Dark Ages client install directory (the folder containing legend.dat, roh.dat, etc.). Required for sprite, sound, and effect pickers."
          placement="top"
        >
          <IconButton sx={{ ml: 1, color: 'text.button' }}>
            <HelpIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button variant="contained" startIcon={<FolderOpenIcon />} onClick={handleBrowse}>
          {clientPath ? 'Change Path' : 'Set Path'}
        </Button>
        {clientPath && (
          <Button variant="outlined" color="error" startIcon={<ClearIcon />} onClick={handleClear}>
            Clear
          </Button>
        )}
      </Box>

      <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <StatusIndicator status={check.status} files={check.files} />
        <Typography variant="body2" sx={{ flex: 1, wordBreak: 'break-all', color: 'text.button' }}>
          {clientPath || <span style={{ opacity: 0.6 }}>(not set)</span>}
        </Typography>
      </Paper>
    </Box>
  );
};

export default DAClientPathSection;
