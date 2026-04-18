import React, { useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import { useRecoilValue } from 'recoil'
import { clientPathState } from '../../recoil/atoms'
import { getItemSpriteBitmap } from '../../data/itemSpriteData'

/**
 * Draws a single item sprite to a fixed-size canvas. The sprite is centered
 * and drawn at its native pixel size (no scaling — matches in-game look).
 * If clientPath isn't set or the sprite can't be rendered, the canvas stays
 * blank (caller provides the surrounding placeholder chrome).
 */
export default function ItemSpriteCanvas({ value, size }) {
  const clientPath = useRecoilValue(clientPathState)
  const canvasRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, size, size)

    if (!clientPath || !value || Number(value) < 1) return undefined

    getItemSpriteBitmap(clientPath, Number(value))
      .then((bitmap) => {
        if (cancelled || !bitmap) return
        const dx = Math.floor((size - bitmap.width) / 2)
        const dy = Math.floor((size - bitmap.height) / 2)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(bitmap, dx, dy)
      })
      .catch(() => {
        /* swallow — blank canvas is an acceptable error state */
      })

    return () => {
      cancelled = true
    }
  }, [clientPath, value, size])

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
      <canvas ref={canvasRef} width={size} height={size} style={{ imageRendering: 'pixelated' }} />
    </Box>
  )
}
