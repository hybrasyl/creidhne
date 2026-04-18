import React, { useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import { useRecoilValue } from 'recoil'
import { clientPathState } from '../../recoil/atoms'
import { getNationCrestBitmap } from '../../data/nationCrestData'

/**
 * Renders a nation crest (1-based flag number) to a fixed-size canvas,
 * scale-to-fit while preserving aspect ratio.
 *
 * Props:
 *   flagNum         — 1-based flag number (string or number)
 *   size            — canvas edge in CSS px (default 80)
 *   paletteOverride — optional { pattern, number } passed from the palette picker
 *   preferPack      — when true, try a Hybrasyl .datf pack override first; fall
 *                     back to the vanilla EPF bitmap if no pack covers this id.
 */
export default function NationCrestCanvas({
  flagNum,
  size = 80,
  paletteOverride,
  preferPack = false
}) {
  const clientPath = useRecoilValue(clientPathState)
  const canvasRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, size, size)
    if (!clientPath || flagNum == null || String(flagNum) === '' || Number(flagNum) < 1)
      return undefined

    const drawScaled = (source) => {
      const scale = Math.min(size / source.width, size / source.height, 1)
      const w = Math.round(source.width * scale)
      const h = Math.round(source.height * scale)
      const dx = Math.floor((size - w) / 2)
      const dy = Math.floor((size - h) / 2)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(source, dx, dy, w, h)
    }

    const drawVanilla = () =>
      getNationCrestBitmap(clientPath, Number(flagNum), paletteOverride)
        .then((bmp) => {
          if (cancelled || !bmp) return
          drawScaled(bmp)
        })
        .catch(() => {
          /* blank */
        })

    if (preferPack) {
      window.electronAPI
        .resolvePackAsset('nation', Number(flagNum))
        .then((dataUrl) => {
          if (cancelled) return
          if (!dataUrl) return drawVanilla()
          const img = new Image()
          img.onload = () => {
            if (cancelled) return
            drawScaled(img)
          }
          img.src = dataUrl
        })
        .catch(drawVanilla)
    } else {
      drawVanilla()
    }

    return () => {
      cancelled = true
    }
  }, [clientPath, flagNum, size, paletteOverride, preferPack])

  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'action.hover'
      }}
    >
      <canvas ref={canvasRef} width={size} height={size} style={{ imageRendering: 'pixelated' }} />
    </Box>
  )
}
