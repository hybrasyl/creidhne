// Nation crest data layer.
//
// All nation crests live as frames inside `nation.epf` (single EPF) in
// `setoa.dat`. XML `<Nation Flag="N" />` stores a 1-based flag number;
// frame index = N - 1.
//
// Palette is discovered from the same archive. We default to gui06 (which
// worked for spell/skill icons), but the dialog lets users cycle through
// every `.pal` entry so the correct one can be dialled in visually. Update
// DEFAULT_PALETTE once confirmed.

import { useState, useEffect } from 'react'
import { useRecoilValue } from 'recoil'
import { EpfFile, Palette, renderEpf } from '@eriscorp/dalib-ts'
import { toImageData } from '@eriscorp/dalib-ts/helpers/imageData'
import { loadArchive, registerCacheClearer } from '../utils/daClient'
import { clientPathState } from '../recoil/atoms'

const ARCHIVE = 'setoa.dat'
const EPF_NAME = 'nation.epf'

// Default palette (pattern + number). gui05.pal — confirmed correct for nation crests.
export const DEFAULT_CREST_PALETTE = { pattern: 'gui', number: 5 }

// Caches keyed per clientPath.
const epfCache = new Map() // clientPath → EpfFile
const allPalettesCache = new Map() // clientPath → Array<{ pattern, number, palette }>
const bitmapCache = new Map() // `${clientPath}|${flagNum}|${paletteKey}` → ImageBitmap

async function getEpf(clientPath) {
  const cached = epfCache.get(clientPath)
  if (cached) return cached
  const archive = await loadArchive(clientPath, ARCHIVE)
  if (!archive.has(EPF_NAME)) return null
  const epf = EpfFile.fromArchive(EPF_NAME, archive)
  epfCache.set(clientPath, epf)

  console.log(`[nationCrestData] ${EPF_NAME} has ${epf.frames.length} frames`)
  return epf
}

/**
 * Load every `.pal` entry in setoa.dat, split by prefix, and flatten into a
 * sorted list the palette picker can iterate. Each entry is
 *   { pattern: 'gui', number: 6, palette: Palette, label: 'gui06' }.
 */
async function getAllPalettes(clientPath) {
  const cached = allPalettesCache.get(clientPath)
  if (cached) return cached
  const archive = await loadArchive(clientPath, ARCHIVE)
  const palEntries = archive.getEntriesByExtension('.pal')
  const byPrefix = new Map()
  for (const entry of palEntries) {
    const name = entry.entryName.replace(/\.pal$/i, '').toLowerCase()
    const m = name.match(/^([a-z_]+)(\d+)$/)
    if (!m) continue
    const pattern = m[1]
    const number = parseInt(m[2], 10)
    if (!byPrefix.has(pattern)) byPrefix.set(pattern, Palette.fromArchive(pattern, archive))
  }
  const all = []
  for (const [pattern, map] of byPrefix.entries()) {
    for (const [number, palette] of map.entries()) {
      all.push({ pattern, number, palette, label: `${pattern}${String(number).padStart(2, '0')}` })
    }
  }
  all.sort((a, b) =>
    a.pattern === b.pattern ? a.number - b.number : a.pattern.localeCompare(b.pattern)
  )
  allPalettesCache.set(clientPath, all)

  console.log(
    `[nationCrestData] loaded ${all.length} palettes from ${ARCHIVE}:`,
    `[${Array.from(new Set(all.map((p) => p.pattern))).join(', ')}]`
  )
  return all
}

async function resolvePalette(clientPath, paletteOverride) {
  const all = await getAllPalettes(clientPath)
  const match = (pattern, number) => all.find((p) => p.pattern === pattern && p.number === number)
  if (paletteOverride) {
    const found = match(paletteOverride.pattern, paletteOverride.number)
    if (found) return found
  }
  const fallback = match(DEFAULT_CREST_PALETTE.pattern, DEFAULT_CREST_PALETTE.number)
  if (fallback) return fallback
  return all[0] || null
}

/**
 * @returns {Promise<{ total: number, visibleIds: number[] }>}
 *   visibleIds are 1-based flag numbers (every non-blank frame).
 */
export async function getNationCrestIndex(clientPath) {
  if (!clientPath) return { total: 0, visibleIds: [] }
  const epf = await getEpf(clientPath)
  if (!epf) return { total: 0, visibleIds: [] }
  const visibleIds = []
  for (let i = 0; i < epf.frames.length; i++) {
    const f = epf.frames[i]
    if (!f || !f.data || f.data.length === 0) continue
    const w = (f.right ?? 0) - (f.left ?? 0)
    const h = (f.bottom ?? 0) - (f.top ?? 0)
    if (w <= 0 || h <= 0) continue
    // Treat a frame as "present" — flag numbers are 1-based.
    visibleIds.push(i + 1)
  }
  return { total: epf.frames.length, visibleIds }
}

/**
 * Render a nation crest (flag number) to an ImageBitmap.
 *
 * @param {string} clientPath
 * @param {number|string} flagNum   1-based flag number (as stored in XML)
 * @param {{ pattern: string, number: number }} [paletteOverride]
 */
export async function getNationCrestBitmap(clientPath, flagNum, paletteOverride) {
  if (!clientPath) return null
  const n = Number(flagNum)
  if (!Number.isFinite(n) || n < 1) return null
  const epf = await getEpf(clientPath)
  if (!epf) return null
  const frame = epf.frames[n - 1]
  if (!frame || !frame.data || frame.data.length === 0) return null

  const paletteInfo = await resolvePalette(clientPath, paletteOverride)
  if (!paletteInfo) return null

  const key = `${clientPath}|${n}|${paletteInfo.label}`
  const cached = bitmapCache.get(key)
  if (cached) return cached

  try {
    const rgba = renderEpf(frame, paletteInfo.palette)
    const bitmap = await createImageBitmap(toImageData(rgba))
    bitmapCache.set(key, bitmap)
    return bitmap
  } catch {
    return null
  }
}

/** For the dialog's palette-picker dropdown. */
export async function getAvailableCrestPalettes(clientPath) {
  if (!clientPath) return []
  return await getAllPalettes(clientPath)
}

export function clearNationCrestCache() {
  for (const bmp of bitmapCache.values()) {
    try {
      bmp.close?.()
    } catch {
      /* ignore */
    }
  }
  bitmapCache.clear()
  epfCache.clear()
  allPalettesCache.clear()
}
registerCacheClearer(clearNationCrestCache)

/** React hook — { total, visibleIds } for current clientPath. */
export function useNationCrestIndex() {
  const clientPath = useRecoilValue(clientPathState)
  const [result, setResult] = useState(null)
  useEffect(() => {
    if (!clientPath) {
      setResult(null)
      return undefined
    }
    let cancelled = false
    getNationCrestIndex(clientPath)
      .then((r) => {
        if (!cancelled) setResult(r)
      })
      .catch(() => {
        if (!cancelled) setResult(null)
      })
    return () => {
      cancelled = true
    }
  }, [clientPath])
  return result
}
