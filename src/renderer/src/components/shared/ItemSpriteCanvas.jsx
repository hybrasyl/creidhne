import { useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import { useStoreValue, clientPathState, packCoverageState } from '../../store/appStore'
import { getItemSpriteBitmap } from '../../data/itemSpriteData'

/**
 * Draws a single item sprite to a fixed-size canvas. The sprite is centered
 * and drawn at its native pixel size (no scaling — matches in-game look); a
 * pack icon larger than the canvas is scaled down to fit.
 * If the sprite can't be rendered, the canvas stays blank (caller provides the
 * surrounding placeholder chrome).
 *
 * preferPack — when true, draw the item_icons pack art first and fall back to
 * legend.dat (HTOO-695). When omitted, it follows pack coverage: a pack icon
 * is drawn whenever a pack has this id, as Brigid does, so the form shows what
 * the player sees.
 */
export default function ItemSpriteCanvas({ value, size, color = '', preferPack }) {
  const clientPath = useStoreValue(clientPathState)
  const packCoverage = useStoreValue(packCoverageState)
  const canvasRef = useRef(null)
  const id = Number(value)
  const usePack = preferPack ?? (packCoverage.item || []).includes(id)

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, size, size)

    if (!value || !Number.isFinite(id) || id < 1) return undefined
    if (!clientPath && !usePack) return undefined

    getItemSpriteBitmap(clientPath, id, color, { preferPack: usePack })
      .then((bitmap) => {
        if (cancelled || !bitmap) return
        const scale = Math.min(size / bitmap.width, size / bitmap.height, 1)
        const w = Math.round(bitmap.width * scale)
        const h = Math.round(bitmap.height * scale)
        const dx = Math.floor((size - w) / 2)
        const dy = Math.floor((size - h) / 2)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(bitmap, dx, dy, w, h)
      })
      .catch(() => {
        /* swallow — blank canvas is an acceptable error state */
      })

    return () => {
      cancelled = true
    }
  }, [clientPath, value, id, size, color, usePack])

  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        data-testid="item-sprite-canvas"
        style={{ imageRendering: 'pixelated' }}
      />
    </Box>
  )
}
