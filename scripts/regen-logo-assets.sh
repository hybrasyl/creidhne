#!/usr/bin/env bash
# Regenerate the right-sized runtime logo assets from the 1024px master.
# The master lives in build/ (directories.buildResources) so it is never
# packaged. Nothing loads it at runtime; it exists only to regenerate these.
#
# Render sizes (checked in the source): splash draws at 172px, the Settings
# About logo at 48px, the toolbar at 36px. Sizes below are render x DPR headroom
# rounded up to something tidy. Requires ImageMagick 7 (`magick`).
#
# Two masters, not one. build/creidhne-logo.png is the star used by the app
# chrome and Windows; build/creidhne-mac-icon.png is the navy-and-gold tile used
# by macOS and Linux. The two webp files below come from the star; make-icons.mjs
# at the end builds from both.
set -euo pipefail
cd "$(dirname "$0")/.."

# Splash: 172px render -> 384 (~2.2x). Loaded by main from packaged resources/.
magick build/creidhne-logo.png -resize 384x384 -strip -quality 90 \
  resources/creidhne-splash.webp

# Renderer chrome: largest draw is the 48px About logo -> 192 (4x). Hashed into
# the renderer bundle by Vite; also used by the toolbar and the favicon.
magick build/creidhne-logo.png -resize 192x192 -strip -quality 90 \
  src/renderer/src/assets/creidhne.webp

echo "Regenerated resources/creidhne-splash.webp and src/renderer/src/assets/creidhne.webp"

# Every committed icon artifact: the Windows PNG from the star; the Linux hicolor
# set in build/icons/, the Linux window icon and the macOS .icns from the tile (the
# .icns alone inset onto Apple's icon grid). scripts/icons.test.mjs checks the results, so a
# regeneration that goes wrong is caught by `npm test` rather than by a release.
node scripts/make-icons.mjs
