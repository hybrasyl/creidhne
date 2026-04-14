import { describe, it, expect } from 'vitest'
import { tightBoundsAndNormalize } from '../effectData.js'

const fakeBitmap = (w, h) => ({ width: w, height: h })

describe('tightBoundsAndNormalize', () => {
  it('returns 1×1 fallback for empty frame array', () => {
    const r = tightBoundsAndNormalize([])
    expect(r.width).toBe(1)
    expect(r.height).toBe(1)
    expect(r.frames).toEqual([])
  })

  it('returns 1×1 fallback when all frames are null', () => {
    const r = tightBoundsAndNormalize([null, null])
    expect(r.width).toBe(1)
    expect(r.height).toBe(1)
    expect(r.frames).toEqual([null, null])
  })

  it('computes tight bounds across multiple frames', () => {
    const frames = [
      { bitmap: fakeBitmap(10, 10), left: 5, top: 5 },
      { bitmap: fakeBitmap(20, 10), left: 10, top: 0 },
    ]
    const r = tightBoundsAndNormalize(frames)
    // min: (5, 0), max: (30, 15) → width 25, height 15
    expect(r.width).toBe(25)
    expect(r.height).toBe(15)
  })

  it('normalizes each frame so min-left and min-top become origin', () => {
    const frames = [
      { bitmap: fakeBitmap(10, 10), left: 5, top: 5 },
      { bitmap: fakeBitmap(20, 10), left: 10, top: 0 },
    ]
    const r = tightBoundsAndNormalize(frames)
    // min-left = 5, min-top = 0
    expect(r.frames[0]).toEqual({ bitmap: frames[0].bitmap, left: 0, top: 5 })
    expect(r.frames[1]).toEqual({ bitmap: frames[1].bitmap, left: 5, top: 0 })
  })

  it('ignores null frames for bounds computation but preserves them in output', () => {
    const a = { bitmap: fakeBitmap(10, 10), left: 5, top: 5 }
    const c = { bitmap: fakeBitmap(8, 8), left: 5, top: 15 }
    const r = tightBoundsAndNormalize([a, null, c])
    expect(r.width).toBe(10)
    expect(r.height).toBe(18)
    expect(r.frames[0]).toEqual({ bitmap: a.bitmap, left: 0, top: 0 })
    expect(r.frames[1]).toBeNull()
    expect(r.frames[2]).toEqual({ bitmap: c.bitmap, left: 0, top: 10 })
  })

  it('handles negative left/top offsets', () => {
    const frames = [
      { bitmap: fakeBitmap(10, 10), left: -5, top: -3 },
      { bitmap: fakeBitmap(10, 10), left: 5, top: 7 },
    ]
    const r = tightBoundsAndNormalize(frames)
    expect(r.width).toBe(20)  // -5 to 15
    expect(r.height).toBe(20) // -3 to 17
    expect(r.frames[0]).toEqual({ bitmap: frames[0].bitmap, left: 0, top: 0 })
    expect(r.frames[1]).toEqual({ bitmap: frames[1].bitmap, left: 10, top: 10 })
  })

  it('floors width/height at 1 even when the bounds collapse to a single column/row', () => {
    const frames = [{ bitmap: fakeBitmap(0, 0), left: 0, top: 0 }]
    const r = tightBoundsAndNormalize(frames)
    expect(r.width).toBe(1)
    expect(r.height).toBe(1)
  })
})
