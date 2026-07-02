import { useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import { useRecoilValue } from 'recoil'
import { clientPathState, packCoverageState } from '../../recoil/atoms'
import { getIconBitmap } from '../../data/iconData'
import { getPackAssetUrl } from '../../data/packAssetCache'

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
 *                 When omitted (inline form previews), it self-derives from pack
 *                 coverage: the pack asset is always preferred when a pack covers
 *                 this id, so the form shows what the player actually sees.
 */
export default function IconCanvas({ type, id, size = 48, paletteNumber, preferPack }) {
  const clientPath = useRecoilValue(clientPathState)
  const packCoverage = useRecoilValue(packCoverageState)
  const canvasRef = useRef(null)

  // Explicit prop (from the dialog toggle) wins; otherwise prefer the pack
  // whenever a pack covers this specific id.
  // Only scan coverage when the caller didn't pass an explicit preferPack
  // (?? short-circuits, so the dialog's toggle path skips the scan entirely).
  const effectivePreferPack = preferPack ?? (packCoverage[type] || []).includes(Number(id))

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

    if (effectivePreferPack) {
      getPackAssetUrl(type, Number(id))
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
  }, [clientPath, type, id, size, paletteNumber, effectivePreferPack])

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
