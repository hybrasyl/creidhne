import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useRecoilValue } from 'recoil';
import { clientPathState } from '../../recoil/atoms';
import { getEffectFrames } from '../../data/effectData';

// Speed in DA client = milliseconds per frame directly.
// If the XML speed field is empty/0, default to 100ms.
const DEFAULT_MS = 100;
const MIN_FRAME_MS = 1;

function frameDurationMs(speed, defaultMs) {
  const n = Number(speed);
  if (Number.isFinite(n) && n > 0) return Math.max(MIN_FRAME_MS, n);
  if (defaultMs && defaultMs > 0) return Math.max(MIN_FRAME_MS, defaultMs);
  return DEFAULT_MS;
}

/**
 * Renders an effect as a (optionally animated) canvas. Each frame is drawn at
 * its own (left, top) onto a canvas sized to the EPF's full bounding box.
 *
 * Props:
 *   effectId — numeric id (string or number)
 *   speed    — playback speed (string or number, see frameDurationMs)
 *   size     — max width/height in CSS pixels (canvas scales to fit)
 *   playing  — true to loop animation, false to show first frame only
 */
export default function EffectPreview({ effectId, speed, size = 64, playing = true }) {
  const clientPath = useRecoilValue(clientPathState);
  const canvasRef = useRef(null);
  const [anim, setAnim] = useState(null); // { width, height, frames }
  const [loading, setLoading] = useState(false);
  const frameIndexRef = useRef(0);

  // Load effect frames when id or clientPath changes.
  useEffect(() => {
    if (!clientPath || effectId == null || Number(effectId) < 1) {
      setAnim(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    getEffectFrames(clientPath, Number(effectId))
      .then((r) => { if (!cancelled) { setAnim(r); setLoading(false); } })
      .catch(() => { if (!cancelled) { setAnim(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [clientPath, effectId]);

  // Draw frames. When `playing`, cycle; otherwise show first valid frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !anim) return undefined;

    const { width, height, frames } = anim;
    const validFrames = frames.filter(Boolean);
    if (validFrames.length === 0) return undefined;

    // Scale canvas to fit `size` while preserving aspect ratio.
    const scale = Math.min(size / width, size / height, 1);
    const dispW = Math.max(1, Math.round(width * scale));
    const dispH = Math.max(1, Math.round(height * scale));
    canvas.width = dispW;
    canvas.height = dispH;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const drawFrame = (idx) => {
      ctx.clearRect(0, 0, dispW, dispH);
      const f = frames[idx];
      if (!f) return;
      ctx.drawImage(
        f.bitmap,
        Math.round(f.left * scale),
        Math.round(f.top * scale),
        Math.round(f.bitmap.width * scale),
        Math.round(f.bitmap.height * scale)
      );
    };

    // Find first valid frame for still display
    const firstValidIdx = frames.findIndex(Boolean);

    if (!playing) {
      drawFrame(firstValidIdx >= 0 ? firstValidIdx : 0);
      return undefined;
    }

    // Animate: cycle through all frames (including blank ones for timing fidelity).
    frameIndexRef.current = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      drawFrame(frameIndexRef.current);
      frameIndexRef.current = (frameIndexRef.current + 1) % frames.length;
      timerId = setTimeout(tick, frameDurationMs(speed, anim.defaultFrameIntervalMs));
    };
    let timerId = setTimeout(tick, 0);
    return () => { stopped = true; clearTimeout(timerId); };
  }, [anim, size, playing, speed]);

  return (
    <Box sx={{
      width: size, height: size, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover',
      overflow: 'hidden',
    }}>
      {loading && !anim && <CircularProgress size={Math.min(24, size / 2)} />}
      <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />
    </Box>
  );
}
