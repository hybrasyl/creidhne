import { useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { useStoreValue, clientPathState, packCoverageState } from '../../store/appStore'
import { getCreatureMeta, getCreatureFrameBitmap } from '../../data/creatureSpriteData'
import { getPackAssetUrl } from '../../data/packAssetCache'

const FRAME_INTERVAL_MS = 200

/**
 * Draws a single creature sprite (from hades.dat) to a fixed-size canvas,
 * centered and at native pixel size (no scaling — matches in-game look).
 *
 * By default the forward-facing "still" frame is shown. When `animate` is set
 * and the cell is hovered, the creature's forward-facing walk/attack frames are
 * pre-rendered and cycled. When `preferPack` is set and a .datf creature_sprites
 * pack covers this id, its static master PNG is drawn instead (phase-1 packs are
 * static, so there's no animation); otherwise it falls back to the MPF path. If
 * clientPath isn't set or the sprite can't be rendered, the canvas stays blank
 * (caller provides the placeholder chrome). When `preferPack` is omitted (inline
 * field previews), it self-derives from pack coverage: the pack asset is always
 * preferred when a pack covers this creature, so the form shows what the player
 * actually sees.
 */
export default function CreatureSpriteCanvas({ value, size, animate = false, preferPack }) {
  const clientPath = useStoreValue(clientPathState)
  const packCoverage = useStoreValue(packCoverageState)
  const canvasRef = useRef(null)
  const [hovered, setHovered] = useState(false)
  const id = Number(value)

  // Explicit prop (from the dialog toggle) wins; otherwise prefer the pack
  // whenever a pack covers this specific creature id.
  // Only scan coverage when the caller didn't pass an explicit preferPack.
  const effectivePreferPack = preferPack ?? (packCoverage.creature || []).includes(id)

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, size, size)

    if (!clientPath || !id || id < 1) return undefined

    // Native-size centered draw (MPF frames render at their in-game size).
    const draw = (bitmap) => {
      if (cancelled || !bitmap) return
      ctx.clearRect(0, 0, size, size)
      const dx = Math.floor((size - bitmap.width) / 2)
      const dy = Math.floor((size - bitmap.height) / 2)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(bitmap, dx, dy)
    }

    // Scale-to-fit centered draw (pack masters may exceed the cell size).
    const drawScaled = (source) => {
      if (cancelled || !source) return
      ctx.clearRect(0, 0, size, size)
      const scale = Math.min(size / source.width, size / source.height, 1)
      const w = Math.round(source.width * scale)
      const h = Math.round(source.height * scale)
      const dx = Math.floor((size - w) / 2)
      const dy = Math.floor((size - h) / 2)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(source, dx, dy, w, h)
    }

    let timer = null

    const drawVanilla = async () => {
      const meta = await getCreatureMeta(clientPath, id)
      if (cancelled || !meta) return

      // Static path: draw the still frame.
      if (!animate || !hovered || !meta.use.length) {
        const bmp = await getCreatureFrameBitmap(clientPath, id, meta.still)
        draw(bmp)
        return
      }

      // Animated path: pre-render the use frames, then cycle them.
      const bitmaps = await Promise.all(
        meta.use.map((f) => getCreatureFrameBitmap(clientPath, id, f))
      )
      const frames = bitmaps.filter(Boolean)
      if (cancelled || frames.length === 0) {
        const bmp = await getCreatureFrameBitmap(clientPath, id, meta.still)
        draw(bmp)
        return
      }
      let i = 0
      draw(frames[0])
      timer = setInterval(() => {
        i = (i + 1) % frames.length
        draw(frames[i])
      }, FRAME_INTERVAL_MS)
    }

    ;(async () => {
      if (effectivePreferPack) {
        const dataUrl = await getPackAssetUrl('creature', id)
        if (cancelled) return
        if (dataUrl) {
          // Pack override is a single static master — draw it, no animation.
          const img = new Image()
          img.onload = () => drawScaled(img)
          img.src = dataUrl
          return
        }
      }
      await drawVanilla()
    })().catch(() => {
      /* swallow — blank canvas is an acceptable error state */
    })

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [clientPath, id, size, animate, hovered, effectivePreferPack])

  return (
    <Box
      onMouseEnter={animate ? () => setHovered(true) : undefined}
      onMouseLeave={animate ? () => setHovered(false) : undefined}
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <canvas ref={canvasRef} width={size} height={size} style={{ imageRendering: 'pixelated' }} />
    </Box>
  )
}
