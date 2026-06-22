import React, { useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { useRecoilValue } from 'recoil'
import { clientPathState } from '../../recoil/atoms'
import { getCreatureMeta, getCreatureFrameBitmap } from '../../data/creatureSpriteData'

const FRAME_INTERVAL_MS = 200

/**
 * Draws a single creature sprite (from hades.dat) to a fixed-size canvas,
 * centered and at native pixel size (no scaling — matches in-game look).
 *
 * By default the forward-facing "still" frame is shown. When `animate` is set
 * and the cell is hovered, the creature's forward-facing walk/attack frames are
 * pre-rendered and cycled. If clientPath isn't set or the sprite can't be
 * rendered, the canvas stays blank (caller provides the placeholder chrome).
 */
export default function CreatureSpriteCanvas({ value, size, animate = false }) {
  const clientPath = useRecoilValue(clientPathState)
  const canvasRef = useRef(null)
  const [hovered, setHovered] = useState(false)
  const id = Number(value)

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, size, size)

    if (!clientPath || !id || id < 1) return undefined

    const draw = (bitmap) => {
      if (cancelled || !bitmap) return
      ctx.clearRect(0, 0, size, size)
      const dx = Math.floor((size - bitmap.width) / 2)
      const dy = Math.floor((size - bitmap.height) / 2)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(bitmap, dx, dy)
    }

    let timer = null

    ;(async () => {
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
    })().catch(() => {
      /* swallow — blank canvas is an acceptable error state */
    })

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [clientPath, id, size, animate, hovered])

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
