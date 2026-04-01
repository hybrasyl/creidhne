import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Link,
  Box,
  Divider,
} from '@mui/material';

const AboutDialog = ({ open, onClose }) => {
  const [version, setVersion] = useState('');

  useEffect(() => {
    if (open) {
      window.electronAPI.getAppVersion().then(setVersion);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' }}>
        About Creidhne
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Version {version}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Link href="https://www.hybrasyl.com" target="_blank" rel="noopener noreferrer" variant="body2">
            hybrasyl.com
          </Link>
          <Link href="https://github.com/hybrasyl" target="_blank" rel="noopener noreferrer" variant="body2">
            GitHub
          </Link>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: '0.8rem', lineHeight: 1.7 }}>
          <Typography variant="body2" sx={{ fontFamily: 'inherit', fontWeight: 'bold', letterSpacing: 1 }}>
            NEW FROM ERISCO™
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'inherit', fontWeight: 'bold', fontSize: '1.1rem', mt: 1 }}>
            CREIDHNE
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'inherit', fontStyle: 'italic', mb: 1 }}>
            XML, IN COLLABORATION WITH REALITY
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'inherit', mb: 2 }}>
            A BESPOKE, NEXT-GENERATION XML MANAGEMENT SOLUTION
          </Typography>

          {[
            ['FEATURES', ['Exists', 'Works', 'Was not supposed to']],
            ['DELIVERABLES', [
              'Enterprise-grade workflow orchestration',
              'Cross-functional schema alignment',
              'Intent-driven deviation from legacy constraints',
              'Vertical integration of "fine, I\'ll do it myself"',
            ]],
            ['INCLUDES', [
              'Direct contradiction of prior claims',
              'Elimination of "someone else will handle it"',
              'Resolution of "this is impossible"',
            ]],
            ['SIDE EFFECTS', [
              'Loss of patience for "eventually"',
              'Increased intolerance for legacy worship',
              'Spontaneous implementation',
            ]],
          ].map(([heading, items]) => (
            <Box key={heading} sx={{ mb: 1.5 }}>
              <Typography variant="body2" sx={{ fontFamily: 'inherit', fontWeight: 'bold' }}>
                {heading}:
              </Typography>
              {items.map((item) => (
                <Typography key={item} variant="body2" sx={{ fontFamily: 'inherit', pl: 1 }}>
                  - {item}
                </Typography>
              ))}
            </Box>
          ))}

          <Box sx={{ mt: 2, borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>
            <Typography variant="body2" sx={{ fontFamily: 'inherit', fontWeight: 'bold' }}>
              WARNING:
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'inherit' }}>
              Do not compare to Dark Ages.
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'inherit' }}>
              This is how you got here.
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" size="small">Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AboutDialog;
