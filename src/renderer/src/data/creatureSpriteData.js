// Creature sprite data layer.
//
// Creature/NPC sprites live as `MNS###.MPF` stop-motion files inside hades.dat,
// each palettized by a matching `mns###.pal`. A creature's sprite id maps 1:1
// to its MPF number (sprite 1 → MNS001.MPF). The MPF carries named frame ranges
// (walk / standing / attack); we derive a single forward-facing "still" frame
// plus a list of forward-facing animation frames ("use") to cycle on hover.
//
// Mirrors the architecture of itemSpriteData.js: dalib-ts parsing happens here
// in the renderer (archives aren't serializable across IPC), with caches keyed
// by clientPath so switching clients invalidates cleanly.

import { MpfFile, Palette, renderMpf } from '@eriscorp/dalib-ts'
import { toImageData } from '@eriscorp/dalib-ts/helpers/imageData'
import { loadArchive, clearArchiveCache, registerCacheClearer } from '../utils/daClient'

const ARCHIVE = 'hades.dat'

// Caches keyed by clientPath so switching clients invalidates cleanly.
const mpfMapCache = new Map() // clientPath → Map<id, MpfFile>
const paletteMapCache = new Map() // clientPath → Map<paletteNum, Palette>
const metaCache = new Map() // `${clientPath}|${id}` → { still, use }
const bitmapCache = new Map() // `${clientPath}|${id}|${frameNum}` → ImageBitmap
const indexCache = new Map() // clientPath → { ids: number[] }

/**
 * Derive the forward-facing frames from an MPF's animation ranges.
 *
 * DA MPF animation groups store each direction's frames consecutively; the
 * second half of a group is the forward-facing (toward-camera) view. We surface
 * one still frame (forward-facing standing) plus the forward-facing halves of
 * the standing and attack groups for hover animation.
 *
 * Frame numbers are 1-based to keep this helper's output independent of the
 * 0-based `mpf.frames[]` array (callers subtract 1 to index). Indices are
 * clamped to totalFrames so malformed ranges never point past the array.
 *
 * @param {{ standingFrameIndex, standingFrameCount, attackFrameIndex, attackFrameCount }} meta
 * @param {number} totalFrames
 * @returns {{ still: number, use: number[] }}
 */
export function deriveFrames(meta, totalFrames) {
  const {
    standingFrameIndex: si,
    standingFrameCount: sc,
    attackFrameIndex: ai,
    attackFrameCount: ac
  } = meta

  // Forward-facing frames are the second half of each animation group.
  const still = Math.min(si + sc + 1, totalFrames)

  const use = []
  for (let f = si + sc + 1; f <= Math.min(si + sc * 2, totalFrames); f++) use.push(f)
  for (let f = ai + ac + 1; f <= Math.min(ai + ac * 2, totalFrames); f++) use.push(f)

  return { still, use }
}

/**
 * A frame is blank when it has no area or every pixel byte is 0 (palette index 0
 * is transparent in the DA format). Blank frames correspond to unused MPF slots
 * and let us hide empty creatures from the picker grid.
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
 * Load every `MNS###.MPF` entry in hades.dat and return a Map<id, MpfFile>.
 * The id is the numeric identifier in the filename (MNS001 → 1).
 */
async function getMpfMap(clientPath) {
  const cached = mpfMapCache.get(clientPath)
  if (cached) return cached
  const archive = await loadArchive(clientPath, ARCHIVE)
  const entries = archive.getEntriesByPattern('mns', '.mpf')
  const map = new Map()
  for (const entry of entries) {
    const n = entry.tryGetNumericIdentifier()
    if (n === null || n < 1) continue
    try {
      map.set(n, MpfFile.fromEntry(entry))
    } catch {
      /* skip unparseable MPFs */
    }
  }
  console.log(`[creatureSpriteData] loaded ${map.size} creature MPFs from ${ARCHIVE}`)
  mpfMapCache.set(clientPath, map)
  return map
}

/** Load every `mns###.pal` palette and return a Map<paletteNum, Palette>. */
async function getPaletteMap(clientPath) {
  const cached = paletteMapCache.get(clientPath)
  if (cached) return cached
  const archive = await loadArchive(clientPath, ARCHIVE)
  const map = Palette.fromArchive('mns', archive)
  console.log(`[creatureSpriteData] loaded ${map.size} creature palettes`)
  paletteMapCache.set(clientPath, map)
  return map
}

/** Resolve the palette for a creature, with fallbacks if paletteNumber misses. */
function resolvePalette(palMap, mpf, id) {
  return (
    palMap.get(mpf.paletteNumber) ??
    palMap.get(id) ??
    palMap.get(0) ??
    palMap.values().next().value ??
    null
  )
}

/**
 * Frame metadata (still + animation frames) for a creature sprite id.
 * Cached per (clientPath, id). Returns null if the creature has no MPF.
 *
 * @returns {Promise<{ still: number, use: number[] } | null>}
 */
export async function getCreatureMeta(clientPath, id) {
  if (!clientPath || !id || Number(id) < 1) return null
  const key = `${clientPath}|${id}`
  const cached = metaCache.get(key)
  if (cached) return cached

  const mpfMap = await getMpfMap(clientPath)
  const mpf = mpfMap.get(Number(id))
  if (!mpf) return null

  const meta = deriveFrames(mpf, mpf.frames.length)
  metaCache.set(key, meta)
  return meta
}

/**
 * Enumerate creature sprites in hades.dat.
 *
 * @returns {Promise<{ ids: number[] }>} sprite ids whose still frame is non-blank,
 *   sorted ascending. Cached per clientPath.
 */
export async function getCreatureSpriteIndex(clientPath) {
  if (!clientPath) return { ids: [] }
  const cached = indexCache.get(clientPath)
  if (cached) return cached

  const mpfMap = await getMpfMap(clientPath)
  const ids = []
  for (const [id, mpf] of mpfMap) {
    const { still } = deriveFrames(mpf, mpf.frames.length)
    const frame = mpf.frames[still - 1]
    if (!isFrameBlank(frame)) ids.push(id)
  }
  ids.sort((a, b) => a - b)
  const result = { ids }
  indexCache.set(clientPath, result)

  console.log(`[creatureSpriteData] ${ids.length} creatures with a renderable still frame`)
  return result
}

/**
 * Render a single creature frame and return an ImageBitmap ready for canvas use.
 * Cached per (clientPath, id, frameNum). frameNum is 1-based (matches the
 * still/use numbers from getCreatureMeta / deriveFrames).
 *
 * @returns {Promise<ImageBitmap | null>}
 */
export async function getCreatureFrameBitmap(clientPath, id, frameNum) {
  if (!clientPath || !id || Number(id) < 1 || !frameNum || frameNum < 1) return null

  const key = `${clientPath}|${id}|${frameNum}`
  const cached = bitmapCache.get(key)
  if (cached) return cached

  const mpfMap = await getMpfMap(clientPath)
  const mpf = mpfMap.get(Number(id))
  if (!mpf) return null
  const frame = mpf.frames[frameNum - 1]
  if (!frame || isFrameBlank(frame)) return null

  const palMap = await getPaletteMap(clientPath)
  const palette = resolvePalette(palMap, mpf, Number(id))
  if (!palette) return null

  const rgba = renderMpf(frame, palette)
  const bitmap = await createImageBitmap(toImageData(rgba))

  bitmapCache.set(key, bitmap)
  return bitmap
}

/**
 * Drop all creature-sprite caches. Called when clientPath changes via the
 * central cache-clearer registry.
 */
export function clearCreatureSpriteCache() {
  for (const bitmap of bitmapCache.values()) {
    try {
      bitmap.close?.()
    } catch {
      /* ignore */
    }
  }
  bitmapCache.clear()
  mpfMapCache.clear()
  paletteMapCache.clear()
  metaCache.clear()
  indexCache.clear()
  clearArchiveCache()
}

// Auto-register so DAClientPathSection's central clear flushes us too.
registerCacheClearer(clearCreatureSpriteCache)
