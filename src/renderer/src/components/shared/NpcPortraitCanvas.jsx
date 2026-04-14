import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useRecoilValue } from 'recoil';
import { clientPathState } from '../../recoil/atoms';
import { getNpcPortraitBitmap } from '../../data/npcPortraitData';

/**
 * Renders an NPC portrait SPF to a fixed-size canvas, scaled-to-fit while
 * preserving aspect ratio. Draws nothing when clientPath is unset or the
 * filename doesn't resolve.
 *
 * Props:
 *   filename — literal SPF name (e.g. "mage.spf"); controlled value
 *   size     — square canvas edge in CSS px (default 96)
 */
export default function NpcPortraitCanvas({ filename, size = 96 }) {
  const clientPath = useRecoilValue(clientPathState);
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    if (!clientPath || !filename) return undefined;
    getNpcPortraitBitmap(clientPath, filename)
      .then((bmp) => {
        if (cancelled || !bmp) return;
        // Scale-to-fit preserving aspect ratio; center inside the canvas.
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
  }, [clientPath, filename, size]);

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
