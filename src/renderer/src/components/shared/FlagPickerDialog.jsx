import React from 'react';
import { Dialog, DialogTitle, DialogContent, Box, Typography, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const FLAG_COUNT = 13;
const FLAGS = Array.from({ length: FLAG_COUNT }, (_, i) => i + 1);
const CELL_SIZE = 136;
const IMAGE_SIZE = 112;
const COLS = 5;
const CELL_GAP = 4; // MUI gap: 0.5 = 4px
const DIALOG_WIDTH = (CELL_SIZE + CELL_GAP) * COLS + 20;

export default function FlagPickerDialog({ open, value, onClose, onChange }) {
  const selectedFlag = parseInt(value, 10);

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: DIALOG_WIDTH } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', py: 1.5 }}>
        Nation Flags
        <IconButton size="small" onClick={onClose} sx={{ ml: 'auto' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 1, pt: '4px !important' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', width: COLS * CELL_SIZE }}>
          {FLAGS.map((f) => (
            <Tooltip key={f} title={`Flag ${f}`}>
              <Box
                onClick={() => { onChange(String(f)); onClose(); }}
                sx={{
                  width: CELL_SIZE, height: CELL_SIZE,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', gap: 0.5, borderRadius: 1, border: 2,
                  borderColor: f === selectedFlag ? 'primary.main' : 'transparent',
                  bgcolor: f === selectedFlag ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: f === selectedFlag ? 'action.selected' : 'action.hover' },
                }}
              >
                <Box sx={{ width: IMAGE_SIZE, height: IMAGE_SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={`./nations/${f}.webp`}
                    alt={`Flag ${f}`}
                    draggable={false}
                    style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, objectFit: 'contain' }}
                  />
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1 }}>
                  {f}
                </Typography>
              </Box>
            </Tooltip>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
