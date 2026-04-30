import { describe, it, expect } from 'vitest'
import {
  resolveItemSprite,
  isFrameBlank,
  buildItemSpriteCacheKey
} from '../itemSpriteData.js'

describe('resolveItemSprite', () => {
  it('maps id 1 to item001.epf frame 0', () => {
    expect(resolveItemSprite(1)).toEqual({ epfNum: 1, frameIdx: 0 })
  })

  it('maps id 266 to item001.epf frame 265 (last frame of EPF 1)', () => {
    expect(resolveItemSprite(266)).toEqual({ epfNum: 1, frameIdx: 265 })
  })

  it('maps id 267 to item002.epf frame 0 (start of EPF 2)', () => {
    expect(resolveItemSprite(267)).toEqual({ epfNum: 2, frameIdx: 0 })
  })

  it('maps id 5853 to item023.epf frame 0 (boundary confirmed via real data)', () => {
    // 5852 frames in EPFs 1..22, so id 5853 is the first of EPF 23.
    expect(resolveItemSprite(5853)).toEqual({ epfNum: 23, frameIdx: 0 })
  })

  it('accepts string ids', () => {
    expect(resolveItemSprite('42')).toEqual({ epfNum: 1, frameIdx: 41 })
  })

  it('returns null for non-numeric, zero, or negative ids', () => {
    expect(resolveItemSprite(0)).toBeNull()
    expect(resolveItemSprite(-1)).toBeNull()
    expect(resolveItemSprite('abc')).toBeNull()
    expect(resolveItemSprite(null)).toBeNull()
    expect(resolveItemSprite(undefined)).toBeNull()
  })
})

describe('isFrameBlank', () => {
  const validFrame = {
    left: 0,
    top: 0,
    right: 4,
    bottom: 4,
    data: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
  }

  it('returns false when any pixel byte is non-zero', () => {
    expect(isFrameBlank(validFrame)).toBe(false)
  })

  it('returns true when all pixel bytes are zero (fully transparent)', () => {
    expect(
      isFrameBlank({
        left: 0,
        top: 0,
        right: 4,
        bottom: 4,
        data: new Uint8Array(16) // all zeros
      })
    ).toBe(true)
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

  it('returns true for degenerate bounding box (right <= left)', () => {
    expect(isFrameBlank({ left: 5, top: 0, right: 5, bottom: 4, data: new Uint8Array([1]) })).toBe(
      true
    )
    expect(isFrameBlank({ left: 5, top: 0, right: 3, bottom: 4, data: new Uint8Array([1]) })).toBe(
      true
    )
  })

  it('returns true for degenerate bounding box (bottom <= top)', () => {
    expect(isFrameBlank({ left: 0, top: 5, right: 4, bottom: 5, data: new Uint8Array([1]) })).toBe(
      true
    )
    expect(isFrameBlank({ left: 0, top: 5, right: 4, bottom: 3, data: new Uint8Array([1]) })).toBe(
      true
    )
  })
})

describe('buildItemSpriteCacheKey', () => {
  it('includes clientPath, id, and color in the key', () => {
    expect(buildItemSpriteCacheKey('/p', 42, 'Crimson')).toBe('/p|42|Crimson')
  })

  it('produces different keys for different colors on the same sprite', () => {
    const a = buildItemSpriteCacheKey('/p', 42, 'Crimson')
    const b = buildItemSpriteCacheKey('/p', 42, 'Black')
    expect(a).not.toBe(b)
  })

  it('collapses blank, None, null, and undefined to a single un-dyed key', () => {
    const blank = buildItemSpriteCacheKey('/p', 42, '')
    expect(buildItemSpriteCacheKey('/p', 42, 'None')).toBe(blank)
    expect(buildItemSpriteCacheKey('/p', 42, null)).toBe(blank)
    expect(buildItemSpriteCacheKey('/p', 42, undefined)).toBe(blank)
  })

  it('keeps clientPath and id distinct across different inputs', () => {
    expect(buildItemSpriteCacheKey('/a', 1, '')).not.toBe(buildItemSpriteCacheKey('/b', 1, ''))
    expect(buildItemSpriteCacheKey('/p', 1, '')).not.toBe(buildItemSpriteCacheKey('/p', 2, ''))
  })
})
