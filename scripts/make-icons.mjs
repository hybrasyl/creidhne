#!/usr/bin/env node
// Build every committed icon artifact from the two masters in build/.
//
// HTOO-38. Before this there was no generator for anything but the .icns, and the
// Linux and Windows icon was a single hand-made 256x256 PNG. That passed by luck:
// 256 is a standard hicolor size, so nothing complained. Two things were wrong with
// it and neither was visible from the config:
//
//   - **It carried 2 alpha levels.** Fully transparent or fully opaque, nothing
//     between, so the star's edges were hard steps rather than a smooth outline, and
//     every downscale Linux does at install time compounded that.
//   - **Its bounding box was 255x255+0+1** -- one pixel short and one pixel down,
//     which is what a hand crop leaves behind.
//
// And a single PNG is never resampled: electron-builder takes one size or a
// directory of sizes, so one file meant one icon size in the .deb payload.
//
// **Two masters, not one, and that is deliberate.** `build/creidhne-logo.png` is the
// star that Windows and the app chrome use. `build/creidhne-mac-icon.png` is the
// navy-and-gold compass tile -- different artwork, not a crop of the star -- and it
// serves macOS AND Linux. That is the house shape (balor, 2026-08-06; epona and
// taliesin follow it): the square tile for the two platforms that draw square icons,
// the app's own artwork for Windows. Creidhne first gave Linux the star, so the .deb
// and the AppImage showed the Windows icon. On a desktop of square tiles (Cinnamon
// among them) a star with transparent corners also reads as a smaller icon.
//
// **The tile here is the plain `macros/Creidhne.png`, NOT `Creidhne_fixed.png`.** For
// the sibling apps the `_fixed` variant is the one with real alpha. For Creidhne it is
// the reverse: measured, `Creidhne.png` carries 219 alpha levels and `_fixed` carries
// 2, which is the hard-stepped edge HTOO-38 removed. `build/creidhne-mac-icon.png` is
// byte-identical to `Creidhne.png`. Do not re-vendor `_fixed` over it.
//
// Outputs, all committed:
//
//   build/creidhne-logo.png  (1024, star)
//        `-- resources/icon.png        256     Windows .ico source + the window icon
//                                              on Windows
//   build/creidhne-mac-icon.png (1254, tile)
//        |-- build/icons/NxN.png       8 sizes Linux, via `linux.icon: build/icons`,
//        |                                     full-bleed (no Apple inset)
//        |-- resources/icon-linux.png  256     the window icon on Linux, so the
//        |                                     taskbar agrees with the launcher
//        `-- build/icon.icns           10 types macOS, inset onto Apple's grid
//
// Requires ImageMagick 7 (`magick`). Run via `bash scripts/regen-logo-assets.sh`, or
// directly:
//   node scripts/make-icons.mjs

import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const STAR = join(repoRoot, 'build', 'creidhne-logo.png')
const SQUIRCLE = join(repoRoot, 'build', 'creidhne-mac-icon.png')
const ICONS_DIR = join(repoRoot, 'build', 'icons')
const WIN_ICON = join(repoRoot, 'resources', 'icon.png')
const LINUX_WINDOW_ICON = join(repoRoot, 'resources', 'icon-linux.png')
const ICNS = join(repoRoot, 'build', 'icon.icns')

// The hicolor sizes a `.deb` install wants. **This list and nothing else may live in
// build/icons/**: electron-builder collects every file there matching
// `/^(\d+)(?:x\d+)?\.png$/i` (iconConverter.js, `collectIconsFromDir`), so a stray
// `1024x1024.png` left by an experiment is silently shipped. scripts/icons.test.mjs
// asserts the directory holds exactly these and nothing more, which is what makes
// that impossible rather than merely documented.
export const LINUX_SIZES = [16, 24, 32, 48, 64, 128, 256, 512]

// The Windows .ico source and the BrowserWindow icon. 256 is what a .ico tops out
// at, and electron-builder converts up from this file. The Linux window icon uses
// the same size, which is the largest one an X11 `_NET_WM_ICON` is usually drawn at.
const WIN_SIZE = 256

// Apple's macOS app-icon grid: the artwork occupies 824 of a 1024 canvas. Skipping
// the inset makes the icon render noticeably larger than every native app beside it.
const MAC_CANVAS = 1024
const MAC_ARTWORK = 824

// The modern icns set. Every entry is PNG data; `size` is the pixel dimension, and
// the @2x types repeat a dimension at a different OSType on purpose -- a 32x32 image
// is both ic11 (16@2x) and icp5 (32@1x).
const ICNS_ENTRIES = [
  { type: 'icp4', size: 16 }, // 16x16
  { type: 'icp5', size: 32 }, // 32x32
  { type: 'ic11', size: 32 }, // 16x16@2x
  { type: 'ic12', size: 64 }, // 32x32@2x
  { type: 'ic07', size: 128 }, // 128x128
  { type: 'ic13', size: 256 }, // 128x128@2x
  { type: 'ic08', size: 256 }, // 256x256
  { type: 'ic14', size: 512 }, // 256x256@2x
  { type: 'ic09', size: 512 }, // 512x512
  { type: 'ic10', size: 1024 } // 512x512@2x
]

// `-strip` alone still leaves a tIME chunk holding the wall clock, which made every
// regeneration produce a different file. These artifacts are committed, so identical
// input has to give byte-identical output.
const DETERMINISTIC = ['-strip', '-define', 'png:exclude-chunks=date,time']

// Forces RGBA. Without it ImageMagick palettises whichever sizes happen to have few
// enough colours -- measured: of the eight Linux sizes only the 16x16 did, which is
// exactly the "one file is different and nobody knows why" a generated set exists to
// avoid. A paletted PNG with tRNS is valid and smaller, but a uniform set is worth
// 300 bytes, and it lets the test assert one rule rather than a per-size exception.
//
// **Deliberately NOT applied to the .icns.** Adding it there changes the bytes of an
// artifact that shipped notarized in 1.10.0, for a uniformity nobody here can verify
// on macOS. The old generator produced the committed file exactly; keeping that true
// is worth more than consistency with the PNG sets.
const FORCE_RGBA = ['-define', 'png:color-type=6']

function magick(args) {
  execFileSync('magick', args, { stdio: ['ignore', 'pipe', 'pipe'] })
}

/** One square PNG at `size`, straight off the master. No crop, no gravity. */
function resize(source, size, out, extra = []) {
  magick([source, '-resize', `${size}x${size}`, ...DETERMINISTIC, ...extra, out])
}

function buildLinuxSet() {
  // Recreated rather than added to, so a size dropped from LINUX_SIZES is dropped
  // from the directory too. Leaving stale files behind is how a directory acquires a
  // size nobody chose.
  rmSync(ICONS_DIR, { recursive: true, force: true })
  mkdirSync(ICONS_DIR, { recursive: true })
  // Full-bleed: the tile fills the whole canvas. The 824/1024 inset is Apple's grid
  // and belongs to the .icns alone; on Linux it would make the icon smaller than
  // its neighbours, which is the fault moving off the star exists to fix.
  for (const size of LINUX_SIZES) {
    resize(SQUIRCLE, size, join(ICONS_DIR, `${size}x${size}.png`), FORCE_RGBA)
  }
  console.log(`Wrote build/icons/ (${readdirSync(ICONS_DIR).length} files)`)
  for (const size of LINUX_SIZES) console.log(`  ${size}x${size}.png`)
}

function buildWindowsIcon() {
  resize(STAR, WIN_SIZE, WIN_ICON, FORCE_RGBA)
  console.log(`Wrote resources/icon.png (${WIN_SIZE}x${WIN_SIZE})`)
}

// The BrowserWindow icon on Linux. Some window managers draw the window's own icon
// (`_NET_WM_ICON` on X11) in the taskbar and switcher rather than the `.desktop`
// one, so a star here would bring back the Windows icon on exactly those desktops.
function buildLinuxWindowIcon() {
  resize(SQUIRCLE, WIN_SIZE, LINUX_WINDOW_ICON, FORCE_RGBA)
  console.log(`Wrote resources/icon-linux.png (${WIN_SIZE}x${WIN_SIZE})`)
}

function buildIcns() {
  const work = mkdtempSync(join(tmpdir(), 'creidhne-icns-'))
  try {
    // Inset once at full size, then scale that down. Insetting per size would round
    // the padding differently at each step and wobble the artwork.
    const gridded = join(work, 'gridded.png')
    magick([
      SQUIRCLE,
      '-resize',
      `${MAC_ARTWORK}x${MAC_ARTWORK}`,
      '-background',
      'none',
      '-gravity',
      'center',
      '-extent',
      `${MAC_CANVAS}x${MAC_CANVAS}`,
      gridded
    ])

    const chunks = []
    for (const { type, size } of ICNS_ENTRIES) {
      const png = join(work, `${type}.png`)
      resize(gridded, size, png)
      const data = readFileSync(png)

      // Each chunk is: OSType (4 bytes) + big-endian length (4 bytes, counting this
      // 8-byte header) + the PNG itself.
      const header = Buffer.alloc(8)
      header.write(type, 0, 4, 'ascii')
      header.writeUInt32BE(data.length + 8, 4)
      chunks.push(header, data)
    }

    const body = Buffer.concat(chunks)
    const fileHeader = Buffer.alloc(8)
    fileHeader.write('icns', 0, 4, 'ascii')
    fileHeader.writeUInt32BE(body.length + 8, 4)
    writeFileSync(ICNS, Buffer.concat([fileHeader, body]))

    console.log(`Wrote build/icon.icns (${Math.round((body.length + 8) / 1024)} KB)`)
    for (const { type, size } of ICNS_ENTRIES) console.log(`  ${type}  ${size}x${size}`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

// Importable for the test without regenerating anything.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildLinuxSet()
  buildWindowsIcon()
  buildLinuxWindowIcon()
  buildIcns()
}
