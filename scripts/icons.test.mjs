import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { inflateSync } from 'zlib'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { LINUX_SIZES } from './make-icons.mjs'

/**
 * HTOO-38. The committed icon set, checked against the artifacts rather than against
 * the generator that made them — a generator nobody runs is not a guard, and the point
 * of committing these is that CI has no ImageMagick to regenerate them with.
 *
 * PNG headers are read directly rather than shelled out to `magick`, so this needs no
 * toolchain and runs in the ordinary suite on every commit.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const ICONS_DIR = join(repoRoot, 'build', 'icons')

/**
 * Width, height and colour type out of the IHDR chunk.
 *
 * PNG signature is 8 bytes, then the IHDR chunk header is 8 more, so width is at
 * offset 16, height at 20, bit depth at 24 and colour type at 25. Colour type 6 is
 * RGBA — the icon needs an alpha channel, and a type-2 (RGB) file would show as a
 * black square on every desktop that composites it.
 */
function readPng(file) {
  const buf = readFileSync(file)
  expect(buf.length, `${file} is too short to be a PNG`).toBeGreaterThan(26)
  expect(buf.subarray(0, 8).toString('hex'), `${file} has no PNG signature`).toBe(
    '89504e470d0a1a0a'
  )
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25],
    bytes: buf.length
  }
}

/**
 * The RGBA of one pixel, decoded with nothing but zlib.
 *
 * Covers what make-icons.mjs writes and nothing more: 8-bit RGBA (FORCE_RGBA),
 * non-interlaced. Anything else fails loudly here rather than decoding as noise.
 */
function pixelAt(file, x, y) {
  const buf = readFileSync(file)
  const { width, bitDepth, colorType } = readPng(file)
  expect(bitDepth, `${file}: decoder handles 8-bit only`).toBe(8)
  expect(colorType, `${file}: decoder handles RGBA only`).toBe(6)
  expect(buf[28], `${file}: decoder handles non-interlaced only`).toBe(0)

  const idat = []
  for (let off = 8; off < buf.length;) {
    const len = buf.readUInt32BE(off)
    if (buf.subarray(off + 4, off + 8).toString('ascii') === 'IDAT') {
      idat.push(buf.subarray(off + 8, off + 8 + len))
    }
    off += len + 12
  }
  const raw = inflateSync(Buffer.concat(idat))

  // Undo the per-row filters down to row y. Each row is one filter byte + 4*width.
  const stride = width * 4
  let prev = Buffer.alloc(stride)
  let row
  for (let r = 0; r <= y; r++) {
    const start = r * (stride + 1)
    const filter = raw[start]
    row = Buffer.from(raw.subarray(start + 1, start + 1 + stride))
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? row[i - 4] : 0
      const b = prev[i]
      const c = i >= 4 ? prev[i - 4] : 0
      let pred = 0
      if (filter === 1) pred = a
      else if (filter === 2) pred = b
      else if (filter === 3) pred = (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      row[i] = (row[i] + pred) & 0xff
    }
    prev = row
  }
  const [r, g, b, a] = row.subarray(x * 4, x * 4 + 4)
  return { r, g, b, a }
}

/**
 * A point just inside the middle of the left edge. The tile is opaque navy there.
 * The star is not: measured, it is transparent there at 256 and an opaque brown
 * blend at 16, so the test is "opaque AND blue over red", not opacity alone. The
 * same pixel also catches an Apple inset applied where it does not belong (the
 * inset leaves ~10% of transparent margin on every side).
 */
const edgePoint = (size) => [Math.max(1, Math.round(size * 0.03)), Math.floor(size / 2)]
const isTile = ({ r, b, a }) => a === 255 && b > r

describe('build/icons', () => {
  it('holds one square RGBA PNG per declared size', () => {
    for (const size of LINUX_SIZES) {
      const png = readPng(join(ICONS_DIR, `${size}x${size}.png`))
      expect(png.width, `${size}x${size}.png width`).toBe(size)
      expect(png.height, `${size}x${size}.png height`).toBe(size)
      expect(png.colorType, `${size}x${size}.png is not RGBA (colour type 6)`).toBe(6)
      expect(png.bitDepth, `${size}x${size}.png is not 8-bit`).toBe(8)
    }
  })

  it('holds those files AND NOTHING ELSE', () => {
    // The trap this test exists for. electron-builder collects every file matching
    // /^(\d+)(?:x\d+)?\.png$/i from this directory (app-builder-lib
    // `iconConverter.js`, `collectIconsFromDir`), so a stray `1024x1024.png` left by a
    // regeneration experiment is silently shipped in the .deb payload — collected
    // beside the fix, and reintroducing exactly the "a size nobody chose" defect.
    // Asserting the contents is the only thing that makes that impossible.
    const expected = LINUX_SIZES.map((s) => `${s}x${s}.png`).sort()
    expect(readdirSync(ICONS_DIR).sort()).toEqual(expected)
  })

  it('is the full-bleed tile, not the star', () => {
    // The .deb and the AppImage shipped the star -- the Windows icon -- because the
    // generator fed the Linux set from it. The house shape gives Linux the same
    // square tile as macOS, without the Apple inset.
    for (const size of LINUX_SIZES) {
      const px = pixelAt(join(ICONS_DIR, `${size}x${size}.png`), ...edgePoint(size))
      expect(
        isTile(px),
        `${size}x${size}.png is not the full-bleed tile: ${JSON.stringify(px)}`
      ).toBe(true)
    }
  })

  it('covers the hicolor sizes a .deb install wants', () => {
    // 16 through 512 with 24 and 48 present: 24 is the GNOME switcher size and 48 is
    // the freedesktop default. Missing either means a desktop environment downscales
    // 512 at display time, which is the blurry-icon symptom rather than a build error.
    expect(LINUX_SIZES).toEqual([16, 24, 32, 48, 64, 128, 256, 512])
  })
})

describe('resources/icon.png', () => {
  const ICON = join(repoRoot, 'resources', 'icon.png')

  it('is a 256 square RGBA PNG', () => {
    // Windows .ico source and the BrowserWindow icon. 256 is what a .ico tops out at.
    const png = readPng(ICON)
    expect(png.width).toBe(256)
    expect(png.height).toBe(256)
    expect(png.colorType).toBe(6)
  })

  it('is generated rather than hand-made, which the file SIZE shows', () => {
    // The hand-made predecessor carried 2 alpha levels — fully transparent or fully
    // opaque, nothing between — so the star's edges were hard steps. A properly
    // resampled 256 of this artwork has a smooth alpha ramp, which costs bytes: the
    // old file was ~19 KB and the generated one is far larger. This is a proxy for
    // "the edges are antialiased" that needs no image decoder, and it is a floor
    // rather than an exact size so a future master change does not break it.
    const png = readPng(ICON)
    expect(png.bytes, 'icon.png looks hand-flattened again — regenerate it').toBeGreaterThan(
      40 * 1024
    )
  })
})

describe('the window icon, per platform', () => {
  const STAR_ICON = join(repoRoot, 'resources', 'icon.png')
  const LINUX_ICON = join(repoRoot, 'resources', 'icon-linux.png')

  it('resources/icon.png is the star (Windows)', () => {
    // Guard the guard: the edge probe must see the star as NOT a tile, or the
    // build/icons assertion above would pass whatever it was given.
    expect(isTile(pixelAt(STAR_ICON, ...edgePoint(256)))).toBe(false)
  })

  it('resources/icon-linux.png is a 256 RGBA tile', () => {
    const png = readPng(LINUX_ICON)
    expect([png.width, png.height, png.colorType]).toEqual([256, 256, 6])
    expect(isTile(pixelAt(LINUX_ICON, ...edgePoint(256)))).toBe(true)
  })

  it('main gives the Linux window the tile', () => {
    // Some window managers draw the window's own icon rather than the .desktop one,
    // so a packaging fix alone leaves the star in the taskbar there.
    const main = readFileSync(join(repoRoot, 'src', 'main', 'index.js'), 'utf8')
    expect(main).toMatch(/process\.platform === 'linux'[^\n]*\n?[^\n]*icon-linux\.png/)
  })
})

describe('build/icon.icns', () => {
  it('is an icns container whose declared length matches the file', () => {
    // A truncated .icns is accepted by electron-builder and rejected by macOS at
    // install time, which is the worst place to find out. Header is `icns` plus a
    // big-endian total length counting the 8-byte header itself.
    const buf = readFileSync(join(repoRoot, 'build', 'icon.icns'))
    expect(buf.subarray(0, 4).toString('ascii')).toBe('icns')
    expect(buf.readUInt32BE(4)).toBe(buf.length)
  })

  it('carries the ten OSTypes macOS asks for', () => {
    // Walked rather than trusted: the generator writes these, and this asserts the
    // artifact has them, which is the point of checking the artifact at all.
    const buf = readFileSync(join(repoRoot, 'build', 'icon.icns'))
    const types = []
    let off = 8
    while (off + 8 <= buf.length) {
      const type = buf.subarray(off, off + 4).toString('ascii')
      const len = buf.readUInt32BE(off + 4)
      expect(len, `chunk ${type} declares a length that runs off the end`).toBeGreaterThan(8)
      types.push(type)
      off += len
    }
    expect(off, 'the chunk walk did not land exactly on the end of the file').toBe(buf.length)
    expect(types).toEqual([
      'icp4',
      'icp5',
      'ic11',
      'ic12',
      'ic07',
      'ic13',
      'ic08',
      'ic14',
      'ic09',
      'ic10'
    ])
  })
})
