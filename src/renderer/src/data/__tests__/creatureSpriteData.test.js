import { describe, it, expect } from 'vitest'
import { deriveFrames, isFrameBlank } from '../creatureSpriteData.js'

describe('deriveFrames', () => {
  it('picks the forward-facing still frame (standingIndex + standingCount + 1, 1-based)', () => {
    const meta = {
      standingFrameIndex: 0,
      standingFrameCount: 2,
      attackFrameIndex: 4,
      attackFrameCount: 2
    }
    // standing group: frames 1-2 (back), 3-4 (forward) → still = 3
    expect(deriveFrames(meta, 12).still).toBe(3)
  })

  it('collects the forward halves of the standing and attack groups as use frames', () => {
    const meta = {
      standingFrameIndex: 0,
      standingFrameCount: 2,
      attackFrameIndex: 4,
      attackFrameCount: 2
    }
    // standing forward: 3,4 ; attack forward: 7,8
    expect(deriveFrames(meta, 12).use).toEqual([3, 4, 7, 8])
  })

  it('clamps frame numbers to totalFrames so they never point past the array', () => {
    const meta = {
      standingFrameIndex: 0,
      standingFrameCount: 2,
      attackFrameIndex: 4,
      attackFrameCount: 2
    }
    const { still, use } = deriveFrames(meta, 3)
    expect(still).toBe(3)
    // standing forward clamped to [3]; attack forward (7,8) entirely out of range
    expect(use).toEqual([3])
  })

  it('clamps the still frame when the standing range exceeds totalFrames', () => {
    const meta = {
      standingFrameIndex: 10,
      standingFrameCount: 5,
      attackFrameIndex: 0,
      attackFrameCount: 0
    }
    expect(deriveFrames(meta, 8).still).toBe(8)
  })

  it('yields no use frames when all animation counts are zero', () => {
    const meta = {
      standingFrameIndex: 0,
      standingFrameCount: 0,
      attackFrameIndex: 0,
      attackFrameCount: 0
    }
    expect(deriveFrames(meta, 4).use).toEqual([])
  })
})

describe('isFrameBlank', () => {
  const validFrame = {
    left: 0,
    top: 0,
    right: 4,
    bottom: 4,
    data: new Uint8Array([0, 0, 0, 0, 0, 1, 0, 0])
  }

  it('returns false when any pixel byte is non-zero', () => {
    expect(isFrameBlank(validFrame)).toBe(false)
  })

  it('returns true when all pixel bytes are zero (fully transparent)', () => {
    expect(isFrameBlank({ left: 0, top: 0, right: 4, bottom: 4, data: new Uint8Array(16) })).toBe(
      true
    )
  })

  it('returns true when frame is null or missing', () => {
    expect(isFrameBlank(null)).toBe(true)
    expect(isFrameBlank(undefined)).toBe(true)
  })

  it('returns true when data is missing or empty', () => {
    expect(isFrameBlank({ left: 0, top: 0, right: 4, bottom: 4 })).toBe(true)
    expect(isFrameBlank({ left: 0, top: 0, right: 4, bottom: 4, data: new Uint8Array(0) })).toBe(
      true
    )
  })

  it('returns true for a degenerate bounding box', () => {
    expect(isFrameBlank({ left: 5, top: 0, right: 5, bottom: 4, data: new Uint8Array([1]) })).toBe(
      true
    )
    expect(isFrameBlank({ left: 0, top: 5, right: 4, bottom: 3, data: new Uint8Array([1]) })).toBe(
      true
    )
  })
})
