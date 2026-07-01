import React, { useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import { useRecoilValue } from 'recoil'
import { clientPathState, packCoverageState, npcPortraitPickerModeState } from '../../recoil/atoms'
import { getNpcPortraitBitmap } from '../../data/npcPortraitData'

/**
 * Renders an NPC portrait SPF to a fixed-size canvas, scaled-to-fit while
 * preserving aspect ratio. Draws nothing when clientPath is unset or the
 * filename doesn't resolve.
 *
 * Props:
 *   filename   — literal SPF name (e.g. "mage.spf"); controlled value
 *   size       — square canvas edge in CSS px (default 96)
 *   preferPack — when true, try a Hybrasyl .datf pack override (keyed by the
 *                portrait name) first; fall back to the vanilla SPF bitmap if
 *                no pack covers this portrait. When omitted (inline field
 *                previews), it self-derives from the picker mode + pack
 *                coverage so the form preview matches the picker dialog.
 */
export default function NpcPortraitCanvas({ filename, size = 96, preferPack }) {
  const clientPath = useRecoilValue(clientPathState)
  const packCoverage = useRecoilValue(packCoverageState)
  const mode = useRecoilValue(npcPortraitPickerModeState)
  const canvasRef = useRef(null)

  // Explicit prop (from the dialog) wins; otherwise derive from mode+coverage.
  const autoPrefer = mode === 'hybrasyl' && (packCoverage.npcportrait?.length ?? 0) > 0
  const effectivePreferPack = preferPack ?? autoPrefer

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, size, size)
    if (!clientPath || !filename) return undefined

    // Scale-to-fit preserving aspect ratio; center inside the canvas.
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
      getNpcPortraitBitmap(clientPath, filename)
        .then((bmp) => {
          if (cancelled || !bmp) return
          drawScaled(bmp)
        })
        .catch(() => {
          /* blank */
        })

    if (effectivePreferPack) {
      window.electronAPI
        .resolvePackAsset('npcportrait', filename)
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
  }, [clientPath, filename, size, effectivePreferPack])

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
