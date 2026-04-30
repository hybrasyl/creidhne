import React, { useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { useRecoilValue } from 'recoil'
import { clientPathState } from '../../recoil/atoms'
import { getDisplaySpriteBitmap } from '../../data/khanData'

/**
 * Render a single display sprite (one gender) to a fixed-size canvas.
 * Sprites are not scaled (pixelated, native size). The canvas is sized to
 * `size × size` CSS px; the bitmap is centered inside.
 *
 * Props:
 *   category       — category letter (from SLOT_TO_CATEGORY for a slot)
 *   gender         — 'M' or 'W'
 *   displaySprite  — numeric id
 *   size           — canvas edge (default 96)
 *   label          — optional small label under the canvas (e.g. "Male")
 */
export default function DisplaySpriteCanvas({
  category,
  gender,
  displaySprite,
  size = 96,
  label,
  pose,
  frameIdx,
  color = ''
}) {
  const clientPath = useRecoilValue(clientPathState)
  const canvasRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, size, size)
    if (
      !clientPath ||
      !category ||
      !gender ||
      displaySprite == null ||
      String(displaySprite) === ''
    )
      return undefined
    const opts = { category, gender, displaySprite, color }
    if (pose) opts.pose = pose
    if (frameIdx != null) opts.frameIdx = frameIdx
    getDisplaySpriteBitmap(clientPath, opts)
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
    return () => {
      cancelled = true
    }
  }, [clientPath, category, gender, displaySprite, size, pose, frameIdx, color])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
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
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          style={{ imageRendering: 'pixelated' }}
        />
      </Box>
      {label && (
        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1 }}>
          {label}
        </Typography>
      )}
    </Box>
  )
}
