import React, { useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import { useRecoilValue } from 'recoil'
import { clientPathState } from '../../recoil/atoms'
import { getIconBitmap } from '../../data/iconData'

/**
 * Renders a single spell/skill icon to a fixed-size canvas. Icons are 31×31
 * in the source EPF; we center the bitmap in the outer box and draw at
 * native resolution (no scaling by default).
 *
 * Props:
 *   type        — 'spell' | 'skill'
 *   id          — numeric icon id (1-based)
 *   size        — canvas edge in CSS px (default 48)
 *   preferPack  — when true, try a Hybrasyl .datf pack override first; fall
 *                 back to the vanilla EPF bitmap if no pack covers this id.
 */
export default function IconCanvas({ type, id, size = 48, paletteNumber, preferPack = false }) {
  const clientPath = useRecoilValue(clientPathState)
  const canvasRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, size, size)
    if (!clientPath || !type || id == null || String(id) === '' || Number(id) < 1) return undefined

    const drawVanilla = () =>
      getIconBitmap(clientPath, type, Number(id), paletteNumber)
        .then((bmp) => {
          if (cancelled || !bmp) return
          const dx = Math.floor((size - bmp.width) / 2)
          const dy = Math.floor((size - bmp.height) / 2)
          ctx.imageSmoothingEnabled = false
          ctx.drawImage(bmp, dx, dy)
        })
        .catch(() => {
          /* blank */
        })

    if (preferPack) {
      window.electronAPI
        .resolvePackAsset(type, Number(id))
        .then((dataUrl) => {
          if (cancelled) return
          if (!dataUrl) return drawVanilla()
          const img = new Image()
          img.onload = () => {
            if (cancelled) return
            const scale = Math.min(size / img.width, size / img.height, 1)
            const w = Math.round(img.width * scale)
            const h = Math.round(img.height * scale)
            const dx = Math.floor((size - w) / 2)
            const dy = Math.floor((size - h) / 2)
            ctx.imageSmoothingEnabled = false
            ctx.drawImage(img, dx, dy, w, h)
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
  }, [clientPath, type, id, size, paletteNumber, preferPack])

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
