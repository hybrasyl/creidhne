// Effect data layer.
//
// Spell/status effects live in roh.dat as either:
//   - efct###.epf   (older, palette-indexed via mefc*.pal / mefc*.tbl)
//   - efct###.efa   (newer, direct color with blending type)
//
// Files may use 2- or 3-digit padding; we discover via
// archive.getEntriesByPattern and key by each entry's numeric identifier.
// If the same id exists in both formats, EFA is preferred (richer / newer).

import { useState, useEffect } from 'react'
import { useRecoilValue } from 'recoil'
import { EpfFile, EfaFile, PaletteLookup, renderEpf, renderEfa } from '@eriscorp/dalib-ts'
import { toImageData } from '@eriscorp/dalib-ts/helpers/imageData'
import { loadArchive, registerCacheClearer } from '../utils/daClient'
import { clientPathState } from '../recoil/atoms'

const ARCHIVE = 'roh.dat'

// Caches keyed by clientPath.
const paletteLookupCache = new Map() // clientPath → PaletteLookup   (for EPF rendering)
const effectMapCache     = new Map() // clientPath → Map<id, { kind, entry }>
const loadedFileCache    = new Map() // `${clientPath}|${id}` → { kind, file }
const framesCache        = new Map() // `${clientPath}|${id}` → { width, height, frames, defaultFrameIntervalMs }
const indexCache         = new Map() // clientPath → { total, visibleIds }

const fallbackWarnedIds = new Set()

async function getPaletteLookup(clientPath) {
  const cached = paletteLookupCache.get(clientPath)
  if (cached) return cached
  const archive = await loadArchive(clientPath, ARCHIVE)
  // Palette files are `eff*.pal`; the table is `effpal.tbl` (single file, no
  // number). Use fromArchivePatterns(tablePattern, palettePattern, archive).
  const lookup = PaletteLookup.fromArchivePatterns('effpal', 'eff', archive)
  try {
    const palEntries = archive.getEntriesByPattern('eff', '.pal')
    const tblEntries = archive.getEntriesByPattern('effpal', '.tbl')
    const palIds = Array.from(lookup.palettes.keys()).sort((a, b) => a - b)
    // eslint-disable-next-line no-console
    console.log(
      `[effectData] ${ARCHIVE}: ${palEntries.length} eff*.pal, ${tblEntries.length} effpal*.tbl;`,
      `PaletteLookup has ${palIds.length} palette ids (range ${palIds[0]}..${palIds[palIds.length - 1]})`
    )

    // Diagnostic: what palette numbers does the table reference vs. what
    // exists in the archive? Split by luminance-blend convention (≥1000).
    const paletteIdSet = new Set(palIds)
    const referencedByTable = new Set()
    for (const v of lookup.table.entries.values()) referencedByTable.add(v)
    for (const v of lookup.table.overrides.values()) referencedByTable.add(v)
    const refSorted = Array.from(referencedByTable).sort((a, b) => a - b)
    const smallRefs = refSorted.filter((n) => n < 1000)
    const largeRefs = refSorted.filter((n) => n >= 1000)
    const missingSmall = smallRefs.filter((n) => !paletteIdSet.has(n))
    const missingAfterSubtract = largeRefs.filter((n) => !paletteIdSet.has(n - 1000))
    // eslint-disable-next-line no-console
    console.log(
      `[effectData] table references ${refSorted.length} palette ids;`,
      `small (<1000): ${smallRefs.length} [${smallRefs.slice(0, 10).join(',')}${smallRefs.length > 10 ? ',…' : ''}];`,
      `large (≥1000): ${largeRefs.length} [${largeRefs.slice(0, 10).join(',')}${largeRefs.length > 10 ? ',…' : ''}]`
    )
    if (missingSmall.length || missingAfterSubtract.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[effectData] palette numbers referenced but not in archive:`,
        `small missing: [${missingSmall.join(',')}];`,
        `large (after -1000) missing: [${missingAfterSubtract.join(',')}]`
      )
    }
    // Expose for ad-hoc console inspection:
    //   window.__daEffectPalette(311)  → logs table entry for effect 311
    if (typeof window !== 'undefined') {
      window.__daEffectPalette = (id) => {
        const rawEntry = lookup.table.entries.get(Number(id))
        const rawOverride = lookup.table.overrides.get(Number(id))
        const rawFinal = lookup.table.getPaletteNumber(Number(id))
        // eslint-disable-next-line no-console
        console.log(`[effectData] effect ${id}: entries=${rawEntry ?? '∅'}, overrides=${rawOverride ?? '∅'}, getPaletteNumber=${rawFinal}`)
        return { entry: rawEntry, override: rawOverride, final: rawFinal }
      }
    }
  } catch { /* diagnostics only */ }
  paletteLookupCache.set(clientPath, lookup)
  return lookup
}

/** Build a map of effect id → { kind: 'epf'|'efa', entry }. EFAs are preferred when both exist. */
async function getEffectMap(clientPath) {
  const cached = effectMapCache.get(clientPath)
  if (cached) return cached
  const archive = await loadArchive(clientPath, ARCHIVE)
  const epfEntries = archive.getEntriesByPattern('efct', '.epf')
  const efaEntries = archive.getEntriesByPattern('efct', '.efa')
  const map = new Map()
  for (const entry of epfEntries) {
    const n = entry.tryGetNumericIdentifier()
    if (n === null || n < 1) continue
    map.set(n, { kind: 'epf', entry })
  }
  let efaCount = 0
  for (const entry of efaEntries) {
    const n = entry.tryGetNumericIdentifier()
    if (n === null || n < 1) continue
    map.set(n, { kind: 'efa', entry }) // overrides epf if both exist
    efaCount++
  }
  // eslint-disable-next-line no-console
  console.log(`[effectData] ${ARCHIVE}: ${epfEntries.length} efct*.epf, ${efaEntries.length} efct*.efa (${efaCount} used); ${map.size} unique effect ids`)
  effectMapCache.set(clientPath, map)
  return map
}

async function loadEffectFile(clientPath, id) {
  const key = `${clientPath}|${id}`
  const cached = loadedFileCache.get(key)
  if (cached) return cached
  const map = await getEffectMap(clientPath)
  const ref = map.get(Number(id))
  if (!ref) return null
  let result
  if (ref.kind === 'epf') {
    result = { kind: 'epf', file: EpfFile.fromEntry(ref.entry) }
  } else {
    // EFA frames are zlib-compressed; use the async (browser-native) path.
    result = { kind: 'efa', file: await EfaFile.fromBufferAsync(ref.entry.toUint8Array()) }
  }
  loadedFileCache.set(key, result)
  return result
}

/**
 * @returns {Promise<{ total: number, visibleIds: number[] }>}
 */
export async function getEffectIndex(clientPath) {
  if (!clientPath) return { total: 0, visibleIds: [] }
  const cached = indexCache.get(clientPath)
  if (cached) return cached
  const map = await getEffectMap(clientPath)
  const visibleIds = Array.from(map.keys()).sort((a, b) => a - b)
  const result = { total: map.size, visibleIds }
  indexCache.set(clientPath, result)
  return result
}

// Compute the tight bounding box of all non-null frames, then normalize each
// frame's (left, top) so the animation renders at origin (0, 0). Returns
// { width, height, frames } where frames have their left/top adjusted.
export function tightBoundsAndNormalize(rawFrames) {
  let minLeft = Infinity, minTop = Infinity
  let maxRight = -Infinity, maxBottom = -Infinity
  for (const f of rawFrames) {
    if (!f) continue
    if (f.left < minLeft) minLeft = f.left
    if (f.top < minTop) minTop = f.top
    const r = f.left + f.bitmap.width
    const b = f.top + f.bitmap.height
    if (r > maxRight) maxRight = r
    if (b > maxBottom) maxBottom = b
  }
  if (!Number.isFinite(minLeft)) return { width: 1, height: 1, frames: rawFrames }
  const width = Math.max(1, maxRight - minLeft)
  const height = Math.max(1, maxBottom - minTop)
  const frames = rawFrames.map((f) => (f ? { bitmap: f.bitmap, left: f.left - minLeft, top: f.top - minTop } : null))
  return { width, height, frames }
}

async function renderEpfFrames(loaded, id, clientPath) {
  const epf = loaded.file
  const lookup = await getPaletteLookup(clientPath)
  // getPaletteForId throws when the referenced palette isn't present (common
  // for 4-digit luminance-blended entries where N-1000 isn't in the archive).
  let palette = null
  try {
    palette = lookup.getPaletteForId(Number(id))
  } catch { /* fall through to fallback */ }
  if (!palette) {
    palette = lookup.palettes.get(0)
    if (!palette) {
      const [first] = lookup.palettes.values()
      palette = first
    }
    if (!palette) return null
    if (!fallbackWarnedIds.has(Number(id))) {
      fallbackWarnedIds.add(Number(id))
      // eslint-disable-next-line no-console
      console.warn(`[effectData] effect id ${id}: palette unavailable, using palette 0 default`)
    }
  }

  const rawFrames = []
  for (const frame of epf.frames) {
    if (!frame || !frame.data || frame.data.length === 0) { rawFrames.push(null); continue }
    const w = frame.right - frame.left
    const h = frame.bottom - frame.top
    if (w <= 0 || h <= 0) { rawFrames.push(null); continue }
    try {
      const rgba = renderEpf(frame, palette)
      const bitmap = await createImageBitmap(toImageData(rgba))
      rawFrames.push({ bitmap, left: frame.left, top: frame.top })
    } catch {
      rawFrames.push(null)
    }
  }
  return { ...tightBoundsAndNormalize(rawFrames), defaultFrameIntervalMs: null }
}

async function renderEfaFrames(loaded) {
  const efa = loaded.file
  const rawFrames = []
  for (const frame of efa.frames) {
    try {
      const rgba = renderEfa(frame, efa.blendingType)
      if (!rgba || rgba.width === 0 || rgba.height === 0) { rawFrames.push(null); continue }
      const bitmap = await createImageBitmap(toImageData(rgba))
      rawFrames.push({ bitmap, left: frame.left || 0, top: frame.top || 0 })
    } catch {
      rawFrames.push(null)
    }
  }
  return { ...tightBoundsAndNormalize(rawFrames), defaultFrameIntervalMs: efa.frameIntervalMs || null }
}

/**
 * Render all frames of an effect into composited ImageBitmaps.
 * @returns {Promise<{ width, height, frames, defaultFrameIntervalMs } | null>}
 */
export async function getEffectFrames(clientPath, id) {
  if (!clientPath || id == null) return null
  const key = `${clientPath}|${id}`
  const cached = framesCache.get(key)
  if (cached) return cached

  const loaded = await loadEffectFile(clientPath, id)
  if (!loaded) return null

  let result
  if (loaded.kind === 'epf') {
    result = await renderEpfFrames(loaded, id, clientPath)
  } else {
    result = await renderEfaFrames(loaded)
  }
  if (!result) return null
  framesCache.set(key, result)
  return result
}

export function clearEffectCache() {
  for (const result of framesCache.values()) {
    if (!result) continue
    for (const f of result.frames) {
      if (f?.bitmap) {
        try { f.bitmap.close?.() } catch { /* ignore */ }
      }
    }
  }
  framesCache.clear()
  loadedFileCache.clear()
  effectMapCache.clear()
  paletteLookupCache.clear()
  indexCache.clear()
  fallbackWarnedIds.clear()
}
registerCacheClearer(clearEffectCache)

/** React hook — sorted visible effect id list for current clientPath. */
export function useEffectIndex() {
  const clientPath = useRecoilValue(clientPathState)
  const [result, setResult] = useState(() => indexCache.get(clientPath) || null)
  useEffect(() => {
    if (!clientPath) { setResult(null); return undefined }
    let cancelled = false
    getEffectIndex(clientPath)
      .then((r) => { if (!cancelled) setResult(r) })
      .catch(() => { if (!cancelled) setResult(null) })
    return () => { cancelled = true }
  }, [clientPath])
  return result
}
