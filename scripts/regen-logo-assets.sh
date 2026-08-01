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
# chrome, Windows and Linux; build/creidhne-mac-icon.png is a separate squircle
# drawn for the macOS Dock. Everything below comes from the star except the
# .icns at the end.
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

# macOS app icon, from its own master. Insets the squircle onto Apple's icon
# grid and packs every required size into build/icon.icns.
node scripts/make-mac-icns.mjs
