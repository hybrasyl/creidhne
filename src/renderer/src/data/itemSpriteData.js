// Item sprite data layer.
//
// Item sprites live as frames inside EPF entries within legend.dat:
//   item001.epf frame 0  → global id 1
//   item001.epf frame 265 → global id 266
//   item002.epf frame 0   → global id 267
// ...each EPF holds 266 frames, indexed with the 1-based global id.

import { EpfFile, PaletteLookup, renderEpf } from '@eriscorp/dalib-ts'
import { toImageData } from '@eriscorp/dalib-ts/helpers/imageData'
import { loadArchive, clearArchiveCache, registerCacheClearer } from '../utils/daClient'
import { getItemColorEntry } from './itemColorData'

const FRAMES_PER_EPF = 266

// Caches keyed by clientPath so switching clients invalidates cleanly.
const paletteLookupCache = new Map() // clientPath → PaletteLookup
const epfMapCache = new Map() // clientPath → Map<epfNum, EpfFile>
const bitmapCache = new Map() // `${clientPath}|${id}` → ImageBitmap
const indexCache = new Map() // clientPath → { total, visibleIds }

/**
 * Build the cache key for a rendered sprite bitmap. '' and 'None' are the
 * legacy un-dyed sentinels and collapse to the same key so we render once.
 */
export function buildItemSpriteCacheKey(clientPath, id, colorName) {
  const dye = !colorName || colorName === 'None' ? '' : colorName
  return `${clientPath}|${id}|${dye}`
}

/**
 * Convert a 1-based sprite id to its EPF number and the frame index within
 * that EPF. The actual EPF filename may use 2-digit or 3-digit padding; call
 * getEpfMap() to resolve a number to the loaded EpfFile.
 *
 * @returns {{ frameIdx: number, epfNum: number }}
 */
export function resolveItemSprite(id) {
  const n = Number(id)
  if (!Number.isFinite(n) || n < 1) return null
  const epfNum = Math.floor((n - 1) / FRAMES_PER_EPF) + 1
  const frameIdx = (n - 1) % FRAMES_PER_EPF
  return { epfNum, frameIdx }
}

async function getPaletteLookup(clientPath) {
  const cached = paletteLookupCache.get(clientPath)
  if (cached) return cached
  const archive = await loadArchive(clientPath, 'legend.dat')
  const lookup = PaletteLookup.fromArchive('item', archive)

  // Diagnostic: log what was found so palette-coverage gaps are visible
  // in DevTools. Useful when debugging rendering of high sprite IDs.
  try {
    const palEntries = archive.getEntriesByPattern('item', '.pal')
    const tblEntries = archive.getEntriesByPattern('item', '.tbl')
    const palIds = Array.from(lookup.palettes.keys()).sort((a, b) => a - b)

    console.log(
      `[itemSpriteData] legend.dat: ${palEntries.length} item*.pal, ${tblEntries.length} item*.tbl;`,
      `PaletteLookup has ${palIds.length} palette ids (range ${palIds[0]}..${palIds[palIds.length - 1]})`
    )
  } catch {
    /* ignore — diagnostics only */
  }

  paletteLookupCache.set(clientPath, lookup)
  return lookup
}

/**
 * Load every `item*.epf` entry in legend.dat and return a Map<epfNum, EpfFile>.
 * EPF filenames may use 2-digit or 3-digit padding; we discover via
 * getEntriesByPattern and use each entry's numeric identifier as the key.
 */
async function getEpfMap(clientPath) {
  const cached = epfMapCache.get(clientPath)
  if (cached) return cached
  const archive = await loadArchive(clientPath, 'legend.dat')
  const entries = archive.getEntriesByPattern('item', '.epf')
  const map = new Map()
  const foundNums = []
  for (const entry of entries) {
    const n = entry.tryGetNumericIdentifier()
    if (n === null || n < 1) continue
    map.set(n, EpfFile.fromEntry(entry))
    foundNums.push(n)
  }
  foundNums.sort((a, b) => a - b)

  console.log(`[itemSpriteData] loaded ${map.size} item EPFs: [${foundNums.join(',')}]`)
  epfMapCache.set(clientPath, map)
  return map
}

// Track which EPFs we've already warned about so we don't spam one warning
// per sprite. Reset when caches are cleared.
const fallbackWarnedEpfs = new Set()
function warnFallbackOnce(epfNum) {
  if (fallbackWarnedEpfs.has(epfNum)) return
  fallbackWarnedEpfs.add(epfNum)

  console.warn(
    `[itemSpriteData] item${String(epfNum).padStart(3, '0')}.epf has no palette table entry; using palette 0 default`
  )
}

/**
 * A frame is considered blank when every pixel byte is 0 (palette index 0 is
 * transparent in the DA format). Such frames correspond to unused slots in
 * the EPF and should be hidden from the picker grid — though a user can still
 * type the numeric id manually.
 */
export function isFrameBlank(frame) {
  if (!frame || !frame.data || frame.data.length === 0) return true
  const { left, top, right, bottom } = frame
  if (right <= left || bottom <= top) return true
  for (let i = 0; i < frame.data.length; i++) {
    if (frame.data[i] !== 0) return false
  }
  return true
}

/**
 * Enumerate item sprites in legend.dat.
 *
 * @returns {Promise<{ total: number, visibleIds: number[] }>}
 *   total: count of all frame slots across all item*.epf files
 *   visibleIds: the 1-based sprite ids whose frames have at least one
 *     non-transparent pixel (suitable for grid display)
 *
 * Result is cached per clientPath.
 */
export async function getItemSpriteIndex(clientPath) {
  if (!clientPath) return { total: 0, visibleIds: [] }
  const cached = indexCache.get(clientPath)
  if (cached) return cached

  const epfMap = await getEpfMap(clientPath)
  let total = 0
  const visibleIds = []
  const epfNums = Array.from(epfMap.keys()).sort((a, b) => a - b)
  for (const n of epfNums) {
    const epf = epfMap.get(n)
    const base = (n - 1) * FRAMES_PER_EPF
    for (let fi = 0; fi < epf.frames.length; fi++) {
      if (!isFrameBlank(epf.frames[fi])) visibleIds.push(base + fi + 1)
    }
    total += epf.frames.length
  }
  const result = { total, visibleIds }
  indexCache.set(clientPath, result)

  console.log(`[itemSpriteData] scanned ${total} frames; ${visibleIds.length} non-blank`)
  return result
}

/**
 * Render a single item sprite and return an ImageBitmap ready for canvas use.
 * Cached; repeated calls for the same (clientPath, id, colorName) return the
 * same bitmap.
 *
 * If `colorName` is set to a real DisplayColor (anything other than '' or
 * 'None'), the palette's dye-slot indices (98–103) are overwritten with the
 * matching color0.tbl entry before rendering — mirroring the legacy DA
 * client's `palette.Dye()` step.
 */
export async function getItemSpriteBitmap(clientPath, id, colorName = '') {
  if (!clientPath) return null
  const resolved = resolveItemSprite(id)
  if (!resolved) return null

  const key = buildItemSpriteCacheKey(clientPath, id, colorName)
  const cached = bitmapCache.get(key)
  if (cached) return cached

  const epfMap = await getEpfMap(clientPath)
  const epf = epfMap.get(resolved.epfNum)
  if (!epf) return null
  const frame = epf.frames[resolved.frameIdx]
  if (!frame) return null

  const lookup = await getPaletteLookup(clientPath)
  let palette = lookup.getPaletteForId(id)
  if (!palette) {
    // itempal.tbl only covers item010–item053 (ids 2395–14098). Items in
    // item001–item009 and item054 have no table entry — the DA client
    // defaults these to palette 0 (item001.pal), which we mirror here.
    palette = lookup.palettes.get(0)
    if (!palette) {
      const [fallback] = lookup.palettes.values()
      palette = fallback
    }
    if (!palette) return null
    warnFallbackOnce(resolved.epfNum)
  }

  const dyeEntry = await getItemColorEntry(clientPath, colorName)
  if (dyeEntry) palette = palette.dye(dyeEntry)

  const rgba = renderEpf(frame, palette)
  const bitmap = await createImageBitmap(toImageData(rgba))

  bitmapCache.set(key, bitmap)
  return bitmap
}

/**
 * Drop all item-sprite caches. Call when clientPath changes — the underlying
 * archive cache (in daClient.js) should also be cleared.
 */
export function clearItemSpriteCache() {
  for (const bitmap of bitmapCache.values()) {
    try {
      bitmap.close?.()
    } catch {
      /* ignore */
    }
  }
  bitmapCache.clear()
  epfMapCache.clear()
  paletteLookupCache.clear()
  indexCache.clear()
  fallbackWarnedEpfs.clear()
  clearArchiveCache()
}

// Auto-register so DAClientPathSection's central clear flushes us too.
registerCacheClearer(clearItemSpriteCache)
