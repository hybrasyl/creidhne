#!/usr/bin/env node
// Build build/icon.icns from the macOS icon master in build/.
//
// macOS gets its own artwork (a squircle, drawn for the Dock) rather than the
// star logo Windows and Linux use — see build/creidhne-mac-icon.png. The master
// is a bare squircle filling its whole canvas, so this insets it to Apple's
// macOS grid: the shape occupies 824 of a 1024 canvas (80.5%) and the rest is
// transparent. Skipping that step makes the icon render noticeably larger than
// every native app beside it.
//
// The .icns is committed rather than generated at build time, matching what the
// notarized mac build already expected. It lives in build/
// (directories.buildResources) and is never packaged into the app.
//
// Requires ImageMagick 7 (`magick`), the same dependency regen-logo-assets.sh
// already has. Run via `bash scripts/regen-logo-assets.sh`, or directly:
//   node scripts/make-mac-icns.mjs

import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(repoRoot, 'build', 'creidhne-mac-icon.png')
const OUTPUT = join(repoRoot, 'build', 'icon.icns')

// Apple's macOS app-icon grid: the artwork occupies 824 of a 1024 canvas.
const CANVAS = 1024
const ARTWORK = 824

// The modern icns set. Every entry is PNG data; `size` is the pixel dimension,
// and the @2x types repeat a dimension at a different OSType on purpose — a
// 32x32 image is both ic11 (16@2x) and icp5 (32@1x).
const ENTRIES = [
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

function magick(args) {
  execFileSync('magick', args, { stdio: ['ignore', 'pipe', 'pipe'] })
}

const work = mkdtempSync(join(tmpdir(), 'creidhne-icns-'))
try {
  // Inset once at full size, then scale that down. Insetting per size would
  // round the padding differently at each step and wobble the artwork.
  const gridded = join(work, 'gridded.png')
  magick([
    SOURCE,
    '-resize',
    `${ARTWORK}x${ARTWORK}`,
    '-background',
    'none',
    '-gravity',
    'center',
    '-extent',
    `${CANVAS}x${CANVAS}`,
    gridded
  ])

  const chunks = []
  for (const { type, size } of ENTRIES) {
    const png = join(work, `${type}.png`)
    // -strip alone still leaves a tIME chunk holding the wall clock, which made
    // every regeneration produce a different file. This artifact is committed,
    // so it has to be byte-identical for identical input.
    magick([
      gridded,
      '-resize',
      `${size}x${size}`,
      '-strip',
      '-define',
      'png:exclude-chunks=date,time',
      png
    ])
    const data = readFileSync(png)

    // Each chunk is: OSType (4 bytes) + big-endian length (4 bytes, counting
    // this 8-byte header) + the PNG itself.
    const header = Buffer.alloc(8)
    header.write(type, 0, 4, 'ascii')
    header.writeUInt32BE(data.length + 8, 4)
    chunks.push(header, data)
  }

  const body = Buffer.concat(chunks)
  const fileHeader = Buffer.alloc(8)
  fileHeader.write('icns', 0, 4, 'ascii')
  fileHeader.writeUInt32BE(body.length + 8, 4)

  writeFileSync(OUTPUT, Buffer.concat([fileHeader, body]))

  const kb = (n) => `${Math.round(n / 1024)} KB`
  console.log(`Wrote build/icon.icns (${kb(body.length + 8)})`)
  for (const { type, size } of ENTRIES) console.log(`  ${type}  ${size}x${size}`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
