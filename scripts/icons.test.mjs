import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
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
