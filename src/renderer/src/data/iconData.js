// Spell / Skill icon data layer.
//
// Icons live inside legend.dat as EPF containers:
//   skill001.epf, skill002.epf, ...  (skill icons)
//   spell001.epf, spell002.epf, ...  (spell icons)
// Each EPF holds 266 frames (icons). Id math mirrors items:
//   id 1   → epf 1, frame 0
//   id 266 → epf 1, frame 265
//   id 267 → epf 2, frame 0
//
// Palette pattern: guessed as `{type}*.pal` + `{type}*.tbl`. If that's wrong
// in your archive, check the diagnostic log and update `PALETTE_PATTERN`.

import { useState, useEffect } from 'react'
import { useRecoilValue } from 'recoil'
import { EpfFile, Palette, renderEpf } from '@eriscorp/dalib-ts'
import { toImageData } from '@eriscorp/dalib-ts/helpers/imageData'
import { loadArchive, registerCacheClearer } from '../utils/daClient'
import { clientPathState } from '../recoil/atoms'

const EPF_ARCHIVE = 'legend.dat'
const FRAMES_PER_EPF = 266
// Spell/skill icons don't ship with their own palette table — they render
// using a specific palette. Tweak if this turns out to be wrong for any
// subset. PALETTE_ARCHIVE may differ from EPF_ARCHIVE (e.g., gui*.pal lives
// in setoa.dat, used across the client's GUI surface).
const PALETTE_ARCHIVE      = 'setoa.dat'
const ICON_PALETTE_PATTERN = 'gui'
export const ICON_PALETTE_NUMBER = 6   // gui06.pal — confirmed correct for spell + skill icons

// Castable.book → icon type. CastableEditor passes `book` straight through.
export function typeFromBook(book) {
  if (!book) return 'skill'
  return String(book).includes('Spell') ? 'spell' : 'skill'
}

function epfPattern(type) { return type === 'spell' ? 'spell' : 'skill' }

export function resolveIcon(id) {
  const n = Number(id)
  if (!Number.isFinite(n) || n < 1) return null
  const epfNum = Math.floor((n - 1) / FRAMES_PER_EPF) + 1
  const frameIdx = (n - 1) % FRAMES_PER_EPF
  return { epfNum, frameIdx }
}

// Caches keyed so switching type / clientPath is cheap.
const paletteCache = new Map() // clientPath → Palette (shared across skill + spell)
const epfMapCache  = new Map() // `${clientPath}|${type}` → Map<epfNum, EpfFile>
const bitmapCache  = new Map() // `${clientPath}|${type}|${id}` → ImageBitmap
const indexCache   = new Map() // `${clientPath}|${type}` → { total, visibleIds }

function isFrameBlank(frame) {
  if (!frame || !frame.data || frame.data.length === 0) return true
  const w = frame.right - frame.left
  const h = frame.bottom - frame.top
  if (w <= 0 || h <= 0) return true
  for (let i = 0; i < frame.data.length; i++) if (frame.data[i] !== 0) return false
  return true
}

// Load every matching palette in the archive once; cached per clientPath.
// Returns Map<number, Palette>.
async function getIconPalettes(clientPath) {
  const cached = paletteCache.get(clientPath)
  if (cached) return cached
  const archive = await loadArchive(clientPath, PALETTE_ARCHIVE)
  const palettes = Palette.fromArchive(ICON_PALETTE_PATTERN, archive)
  paletteCache.set(clientPath, palettes)
  // eslint-disable-next-line no-console
  console.log(
    `[iconData] loaded ${palettes.size} ${ICON_PALETTE_PATTERN}*.pal palettes from ${PALETTE_ARCHIVE}:`,
    `[${Array.from(palettes.keys()).sort((a, b) => a - b).join(',')}]`
  )
  return palettes
}

async function getIconPalette(clientPath, paletteNumber = ICON_PALETTE_NUMBER) {
  const palettes = await getIconPalettes(clientPath)
  const p = palettes.get(paletteNumber)
  if (!p) {
    // Fallback to default if an override number isn't present.
    return palettes.get(ICON_PALETTE_NUMBER) || null
  }
  return p
}

/** Return sorted list of available palette numbers for the palette picker UI. */
export async function getAvailableIconPaletteNumbers(clientPath) {
  if (!clientPath) return []
  const palettes = await getIconPalettes(clientPath)
  return Array.from(palettes.keys()).sort((a, b) => a - b)
}

async function getEpfMap(clientPath, type) {
  const key = `${clientPath}|${type}`
  const cached = epfMapCache.get(key)
  if (cached) return cached
  const archive = await loadArchive(clientPath, EPF_ARCHIVE)
  const entries = archive.getEntriesByPattern(epfPattern(type), '.epf')
  const map = new Map()
  const foundNums = []
  for (const entry of entries) {
    const n = entry.tryGetNumericIdentifier()
    if (n === null || n < 1) continue
    map.set(n, EpfFile.fromEntry(entry))
    foundNums.push(n)
  }
  foundNums.sort((a, b) => a - b)
  // eslint-disable-next-line no-console
  console.log(`[iconData] loaded ${map.size} ${type} EPFs: [${foundNums.join(',')}]`)
  epfMapCache.set(key, map)
  return map
}

/**
 * @returns {Promise<{ total: number, visibleIds: number[] }>}
 */
export async function getIconIndex(clientPath, type) {
  if (!clientPath || !type) return { total: 0, visibleIds: [] }
  const key = `${clientPath}|${type}`
  const cached = indexCache.get(key)
  if (cached) return cached
  const epfMap = await getEpfMap(clientPath, type)
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
  indexCache.set(key, result)
  return result
}

export async function getIconBitmap(clientPath, type, id, paletteNumber) {
  if (!clientPath || !type || id == null) return null
  const effectivePalette = paletteNumber ?? ICON_PALETTE_NUMBER
  const key = `${clientPath}|${type}|${id}|${effectivePalette}`
  const cached = bitmapCache.get(key)
  if (cached) return cached
  const resolved = resolveIcon(id)
  if (!resolved) return null
  const epfMap = await getEpfMap(clientPath, type)
  const epf = epfMap.get(resolved.epfNum)
  if (!epf) return null
  const frame = epf.frames[resolved.frameIdx]
  if (!frame || !frame.data || frame.data.length === 0) return null
  const w = frame.right - frame.left
  const h = frame.bottom - frame.top
  if (w <= 0 || h <= 0) return null

  const palette = await getIconPalette(clientPath, effectivePalette)
  if (!palette) return null

  try {
    const rgba = renderEpf(frame, palette)
    const bitmap = await createImageBitmap(toImageData(rgba))
    bitmapCache.set(key, bitmap)
    return bitmap
  } catch {
    return null
  }
}

export function clearIconCache() {
  for (const bmp of bitmapCache.values()) {
    try { bmp.close?.() } catch { /* ignore */ }
  }
  bitmapCache.clear()
  epfMapCache.clear()
  paletteCache.clear()
  indexCache.clear()
}
registerCacheClearer(clearIconCache)

/** React hook — { total, visibleIds } for (clientPath, type). */
export function useIconIndex(type) {
  const clientPath = useRecoilValue(clientPathState)
  const [result, setResult] = useState(() => indexCache.get(`${clientPath}|${type}`) || null)
  useEffect(() => {
    if (!clientPath || !type) { setResult(null); return undefined }
    let cancelled = false
    getIconIndex(clientPath, type)
      .then((r) => { if (!cancelled) setResult(r) })
      .catch(() => { if (!cancelled) setResult(null) })
    return () => { cancelled = true }
  }, [clientPath, type])
  return result
}
