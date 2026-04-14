import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useRecoilValue } from 'recoil';
import { clientPathState } from '../../recoil/atoms';
import { getNationCrestBitmap } from '../../data/nationCrestData';

/**
 * Renders a nation crest (1-based flag number) to a fixed-size canvas,
 * scale-to-fit while preserving aspect ratio.
 *
 * Props:
 *   flagNum        — 1-based flag number (string or number)
 *   size           — canvas edge in CSS px (default 80)
 *   paletteOverride — optional { pattern, number } passed from the palette picker
 */
export default function NationCrestCanvas({ flagNum, size = 80, paletteOverride }) {
  const clientPath = useRecoilValue(clientPathState);
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    if (!clientPath || flagNum == null || String(flagNum) === '' || Number(flagNum) < 1) return undefined;
    getNationCrestBitmap(clientPath, Number(flagNum), paletteOverride)
      .then((bmp) => {
        if (cancelled || !bmp) return;
        const scale = Math.min(size / bmp.width, size / bmp.height, 1);
        const w = Math.round(bmp.width * scale);
        const h = Math.round(bmp.height * scale);
        const dx = Math.floor((size - w) / 2);
        const dy = Math.floor((size - h) / 2);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bmp, dx, dy, w, h);
      })
      .catch(() => { /* blank */ });
    return () => { cancelled = true; };
  }, [clientPath, flagNum, size, paletteOverride]);

  return (
    <Box sx={{
      width: size, height: size, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover',
    }}>
      <canvas ref={canvasRef} width={size} height={size} style={{ imageRendering: 'pixelated' }} />
    </Box>
  );
}
