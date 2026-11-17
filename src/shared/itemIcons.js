// Item icon rules that Brigid applies to item_icons pack art (HTOO-695). Main
// uses the dye rule when it gives a pack icon; the renderer uses the ramp and
// the dye pass when it draws one. Electron-free, so both processes import it.
//
// The rules restate Brigid's, and each names its source in `brigid`:
//   - ItemSpriteIds (BRIG-77): the sprite id range.
//   - ItemPack.IsDyeable (BRIG-41): which pack icons take the dye.
//   - ItemDyeRamp and ItemDyePass: the ramp and the find-and-replace dye.
// asset-pack-format.md (document repo), item_icons, is the authoring spec.

/** The first modern item sprite id. A modern icon is never dyed by the ramp. */
export const ITEM_SPRITE_MODERN_FIRST = 20001

/** The largest item sprite id: the server sends `sprite + 0x8000` as a u16. */
export const ITEM_SPRITE_MAX = 32767

/**
 * The canonical purple ramp of legacy item art, lightest first, in the order
 * of palette indices 98 to 103. A `color0.tbl` entry gives six colours in the
 * same order.
 */
export const ITEM_DYE_RAMP = Object.freeze([
  [0xb3, 0x93, 0xc7],
  [0x9b, 0x7b, 0xb7],
  [0x8f, 0x5b, 0xa3],
  [0x7f, 0x3b, 0x93],
  [0x47, 0x23, 0x5f],
  [0x37, 0x00, 0x5b]
])

/**
 * How the dye applies to one pack icon, from the manifest of the pack that
 * gives the image:
 *   'never'  — not dyed;
 *   'always' — dyed (the manifest's `dyeable` list names the id);
 *   'detect' — dyed when the image has a visible pixel of the ramp.
 *
 * @param {object} manifest the pack's _manifest.json
 * @param {number} id the item sprite id
 * @returns {'never' | 'always' | 'detect'}
 */
export function itemDyeRule(manifest, id) {
  if (!Number.isInteger(id) || id < 1 || id >= ITEM_SPRITE_MODERN_FIRST) return 'never'
  const covers = manifest?.covers?.item_icons
  if (Array.isArray(covers?.dyeable)) return covers.dyeable.includes(id) ? 'always' : 'never'
  if (Array.isArray(covers?.no_dye) && covers.no_dye.includes(id)) return 'never'
  return 'detect'
}

/** The ramp index (0 to 5) whose RGB equals this RGB, or -1. Alpha is not compared. */
export function rampIndexOf(r, g, b) {
  for (let i = 0; i < ITEM_DYE_RAMP.length; i++) {
    const c = ITEM_DYE_RAMP[i]
    if (c[0] === r && c[1] === g && c[2] === b) return i
  }
  return -1
}

/**
 * True when the RGBA pixels have at least one visible pixel (alpha above 0)
 * of a ramp colour.
 *
 * @param {Uint8ClampedArray | Uint8Array} rgba
 */
export function containsRampPixel(rgba) {
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] > 0 && rampIndexOf(rgba[i], rgba[i + 1], rgba[i + 2]) >= 0) return true
  }
  return false
}

/**
 * A copy of the RGBA pixels with each ramp pixel replaced by the colour at the
 * same index of `colors`. Alpha stays as it is; other pixels do not change.
 *
 * @param {Uint8ClampedArray | Uint8Array} rgba
 * @param {{ r: number, g: number, b: number }[]} colors six colours, a color0.tbl entry
 * @returns {Uint8ClampedArray}
 */
export function applyItemDye(rgba, colors) {
  const out = new Uint8ClampedArray(rgba)
  if (!Array.isArray(colors) || colors.length < ITEM_DYE_RAMP.length) return out
  for (let i = 0; i + 3 < out.length; i += 4) {
    const index = rampIndexOf(out[i], out[i + 1], out[i + 2])
    if (index < 0) continue
    const c = colors[index]
    out[i] = c.r
    out[i + 1] = c.g
    out[i + 2] = c.b
  }
  return out
}

/** Whether a pack icon with this rule and these pixels takes the dye. */
export function packIconTakesDye(rule, rgba) {
  if (rule === 'always') return true
  if (rule === 'detect') return containsRampPixel(rgba)
  return false
}
