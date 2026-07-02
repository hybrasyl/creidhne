import { useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import { useRecoilValue } from 'recoil'
import { clientPathState, packCoverageState } from '../../recoil/atoms'
import { getNationCrestBitmap } from '../../data/nationCrestData'
import { getPackAssetUrl } from '../../data/packAssetCache'

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
 *                     When omitted (inline form previews), it self-derives from
 *                     pack coverage: the pack asset is always preferred when a
 *                     pack covers this flag, so the form shows what the player
 *                     actually sees.
 */
export default function NationCrestCanvas({ flagNum, size = 80, paletteOverride, preferPack }) {
  const clientPath = useRecoilValue(clientPathState)
  const packCoverage = useRecoilValue(packCoverageState)
  const canvasRef = useRef(null)

  // Explicit prop (from the dialog toggle) wins; otherwise prefer the pack
  // whenever a pack covers this specific flag.
  const autoPrefer = (packCoverage.nation || []).includes(Number(flagNum))
  const effectivePreferPack = preferPack ?? autoPrefer

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

    if (effectivePreferPack) {
      getPackAssetUrl('nation', Number(flagNum))
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
  }, [clientPath, flagNum, size, paletteOverride, effectivePreferPack])

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
