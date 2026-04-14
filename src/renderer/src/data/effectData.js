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
  const lookup = PaletteLookup.fromArchive('mefc', archive)
  try {
    const palEntries = archive.getEntriesByPattern('mefc', '.pal')
    const tblEntries = archive.getEntriesByPattern('mefc', '.tbl')
    const palIds = Array.from(lookup.palettes.keys()).sort((a, b) => a - b)
    // eslint-disable-next-line no-console
    console.log(
      `[effectData] ${ARCHIVE}: ${palEntries.length} mefc*.pal, ${tblEntries.length} mefc*.tbl;`,
      `PaletteLookup has ${palIds.length} palette ids (range ${palIds[0]}..${palIds[palIds.length - 1]})`
    )
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

async function renderEpfFrames(loaded, id, clientPath) {
  const epf = loaded.file
  const lookup = await getPaletteLookup(clientPath)
  let palette = lookup.getPaletteForId(Number(id))
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
      console.warn(`[effectData] effect id ${id} has no palette table entry; using palette 0 default`)
    }
  }

  const frames = []
  for (const frame of epf.frames) {
    if (!frame || !frame.data || frame.data.length === 0) { frames.push(null); continue }
    const w = frame.right - frame.left
    const h = frame.bottom - frame.top
    if (w <= 0 || h <= 0) { frames.push(null); continue }
    try {
      const rgba = renderEpf(frame, palette)
      const bitmap = await createImageBitmap(toImageData(rgba))
      frames.push({ bitmap, left: frame.left, top: frame.top })
    } catch {
      frames.push(null)
    }
  }
  return { width: epf.pixelWidth, height: epf.pixelHeight, frames, defaultFrameIntervalMs: null }
}

async function renderEfaFrames(loaded) {
  const efa = loaded.file
  let maxRight = 0
  let maxBottom = 0
  const frames = []
  for (const frame of efa.frames) {
    try {
      const rgba = renderEfa(frame, efa.blendingType)
      if (!rgba || rgba.width === 0 || rgba.height === 0) { frames.push(null); continue }
      const bitmap = await createImageBitmap(toImageData(rgba))
      const left = frame.left || 0
      const top = frame.top || 0
      frames.push({ bitmap, left, top })
      if (left + bitmap.width > maxRight) maxRight = left + bitmap.width
      if (top + bitmap.height > maxBottom) maxBottom = top + bitmap.height
    } catch {
      frames.push(null)
    }
  }
  return {
    width: Math.max(1, maxRight),
    height: Math.max(1, maxBottom),
    frames,
    defaultFrameIntervalMs: efa.frameIntervalMs || null,
  }
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
