import { describe, it, expect } from 'vitest'
import {
  ITEM_DYE_RAMP,
  ITEM_SPRITE_MAX,
  ITEM_SPRITE_MODERN_FIRST,
  applyItemDye,
  containsRampPixel,
  itemDyeRule,
  packIconTakesDye,
  rampIndexOf
} from '../itemIcons.js'

// One RGBA pixel per entry.
function pixels(...rgba) {
  return new Uint8ClampedArray(rgba.flat())
}

const RAMP_0 = [...ITEM_DYE_RAMP[0], 255]
const RAMP_5 = [...ITEM_DYE_RAMP[5], 255]
const GREY = [0x80, 0x80, 0x80, 255]

// A color0.tbl entry: six colours, distinct from the ramp.
const DYE = [
  { r: 10, g: 0, b: 0 },
  { r: 20, g: 0, b: 0 },
  { r: 30, g: 0, b: 0 },
  { r: 40, g: 0, b: 0 },
  { r: 50, g: 0, b: 0 },
  { r: 60, g: 0, b: 0 }
]

describe('item sprite ids', () => {
  it("match Brigid's ItemSpriteIds", () => {
    expect(ITEM_SPRITE_MODERN_FIRST).toBe(20001)
    // sprite + 0x8000 must fit in a u16
    expect(ITEM_SPRITE_MAX + 0x8000).toBe(0xffff)
  })
})

// Brigid's ItemPack.IsDyeable, rule by rule (BRIG-41).
describe('itemDyeRule', () => {
  it('never dyes a modern id, whatever the manifest says', () => {
    const manifest = { covers: { item_icons: { dyeable: [20001] } } }
    expect(itemDyeRule(manifest, ITEM_SPRITE_MODERN_FIRST)).toBe('never')
    expect(itemDyeRule({}, ITEM_SPRITE_MODERN_FIRST - 1)).toBe('detect')
  })

  it('takes a dyeable list as the exact set', () => {
    const manifest = { covers: { item_icons: { dyeable: [5], no_dye: [5] } } }
    expect(itemDyeRule(manifest, 5)).toBe('always')
    expect(itemDyeRule(manifest, 6)).toBe('never')
  })

  it('refuses an id in no_dye and detects every other id', () => {
    const manifest = { covers: { item_icons: { no_dye: [5595] } } }
    expect(itemDyeRule(manifest, 5595)).toBe('never')
    expect(itemDyeRule(manifest, 5596)).toBe('detect')
  })

  it('detects when the manifest says nothing about dye', () => {
    expect(itemDyeRule({ covers: {} }, 1)).toBe('detect')
    expect(itemDyeRule(undefined, 1)).toBe('detect')
  })

  it('never dyes an id that is not a sprite', () => {
    expect(itemDyeRule({}, 0)).toBe('never')
    expect(itemDyeRule({}, 1.5)).toBe('never')
  })
})

describe('the ramp', () => {
  it('finds each ramp colour at its index, and nothing else', () => {
    ITEM_DYE_RAMP.forEach(([r, g, b], i) => expect(rampIndexOf(r, g, b)).toBe(i))
    expect(rampIndexOf(0x80, 0x80, 0x80)).toBe(-1)
  })

  it('counts only a visible ramp pixel', () => {
    expect(containsRampPixel(pixels(GREY, RAMP_0))).toBe(true)
    expect(containsRampPixel(pixels(GREY, [...ITEM_DYE_RAMP[0], 0]))).toBe(false)
    expect(containsRampPixel(pixels(GREY))).toBe(false)
  })
})

describe('applyItemDye', () => {
  it('replaces each ramp pixel with the dye colour at its index and keeps alpha', () => {
    const half = [...ITEM_DYE_RAMP[5], 128]
    const out = applyItemDye(pixels(RAMP_0, GREY, half), DYE)
    expect(Array.from(out)).toEqual([10, 0, 0, 255, 0x80, 0x80, 0x80, 255, 60, 0, 0, 128])
  })

  it('does not change its input', () => {
    const src = pixels(RAMP_5)
    applyItemDye(src, DYE)
    expect(Array.from(src)).toEqual(RAMP_5)
  })

  it('leaves the pixels as they are without six colours', () => {
    expect(Array.from(applyItemDye(pixels(RAMP_0), DYE.slice(0, 3)))).toEqual(RAMP_0)
  })
})

describe('packIconTakesDye', () => {
  it('applies the rule to the pixels', () => {
    expect(packIconTakesDye('always', pixels(GREY))).toBe(true)
    expect(packIconTakesDye('never', pixels(RAMP_0))).toBe(false)
    expect(packIconTakesDye('detect', pixels(RAMP_0))).toBe(true)
    expect(packIconTakesDye('detect', pixels(GREY))).toBe(false)
  })
})
