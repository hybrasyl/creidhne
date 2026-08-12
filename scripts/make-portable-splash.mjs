// Generate build/portable-splash.bmp — the image NSIS shows while the portable
// exe extracts to %TEMP%, before electron exists. It must be a frozen frame of
// resources/splash.html at the same size as the splash BrowserWindow (420x300),
// so the extraction plate and the electron splash read as one boot rather than
// two screens. A BMP has no alpha, so the card's rounded corners / drop shadow
// cannot cross over; everything else mirrors splash.html's named values below.
//
// Run: node scripts/make-portable-splash.mjs   (requires ImageMagick 7)
// The BMP lives in build/ (buildResources) and is never packaged into app.asar.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const master = join(root, 'build', 'creidhne-logo.png')
const out = join(root, 'build', 'portable-splash.bmp')

// Mirror of resources/splash.html.
const W = 420
const H = 300 // splash BrowserWindow size (src/main/splash.js)
const GRAD_INNER = '#1b2c48' // radial 0%
const GRAD_OUTER = '#0c1524' // radial 100%
const GRAD_CX = 0.5
const GRAD_CY = 0.32 // circle at 50% 32%
const LOGO = 148 // .logo width
const LOGO_MB = 14 // .logo margin-bottom
const TITLE = 'CREIDHNE'
const TITLE_FILL = '#e8eefb'
const SUB = 'Loading…'
const SUB_FILL = '#7f8fb0'
const SEMIBOLD = 'C:/Windows/Fonts/seguisb.ttf'
const REGULAR = 'C:/Windows/Fonts/segoeui.ttf'

// Vertical layout: column centred in H. logo + LOGO_MB + title(~29) + 6 + sub(~16).
// The spinner is deliberately absent -- a BMP cannot animate -- so it is left out
// of the block height as well.
const blockH = LOGO + LOGO_MB + 29 + 6 + 16
const logoTop = Math.round((H - blockH) / 2)
const titleTop = logoTop + LOGO + LOGO_MB
const subTop = titleTop + 29 + 6

// Radial gradient centred at (50%, 32%): render a square big enough that the
// requested centre is interior, then crop the WxH window around it.
const base = 640
const cropX = Math.round(base / 2 - GRAD_CX * W)
const cropY = Math.round(base / 2 - GRAD_CY * H)

execFileSync(
  'magick',
  [
    '-size',
    `${base}x${base}`,
    `radial-gradient:${GRAD_INNER}-${GRAD_OUTER}`,
    '-crop',
    `${W}x${H}+${cropX}+${cropY}`,
    '+repage',
    '(',
    master,
    '-resize',
    `${LOGO}x${LOGO}`,
    ')',
    '-gravity',
    'North',
    '-geometry',
    `+0+${logoTop}`,
    '-composite',
    '-font',
    SEMIBOLD,
    '-pointsize',
    '22',
    '-kerning',
    '3',
    '-fill',
    TITLE_FILL,
    '-gravity',
    'North',
    '-annotate',
    `+0+${titleTop}`,
    TITLE,
    '-font',
    REGULAR,
    '-pointsize',
    '12',
    '-kerning',
    '1',
    '-fill',
    SUB_FILL,
    '-annotate',
    `+0+${subTop}`,
    SUB,
    '-alpha',
    'off',
    '-type',
    'TrueColor',
    `BMP3:${out}`
  ],
  { stdio: 'inherit' }
)
console.log(`Wrote ${out} (${W}x${H}, 24-bit)`)
