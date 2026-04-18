// NPC portrait data layer.
//
// Portraits live as SPF files inside `npc/npcbase.dat`. Each SPF is
// self-contained — palettized SPFs embed `primaryColors` / `secondaryColors`
// palettes in the file itself; colorized SPFs carry direct RGB per frame.
//
// XML Appearance.Portrait holds the literal filename ("mage.spf", "bank.spf"),
// so the picker outputs and accepts filenames directly (no id table).

import { useState, useEffect } from 'react'
import { useRecoilValue } from 'recoil'
import { SpfFile, SpfFormatType, renderSpfPalettized, renderSpfColorized } from '@eriscorp/dalib-ts'
import { toImageData } from '@eriscorp/dalib-ts/helpers/imageData'
import { loadArchive, registerCacheClearer } from '../utils/daClient'
import { clientPathState } from '../recoil/atoms'

const ARCHIVE = 'npc/npcbase.dat'

const filenameIndexCache = new Map() // clientPath → string[] (sorted filenames)
const spfCache = new Map() // `${clientPath}|${filename}` → SpfFile
const bitmapCache = new Map() // `${clientPath}|${filename}|${frameIdx}` → ImageBitmap

/**
 * Enumerate every .spf entry in npc/npcbase.dat. Cached per clientPath.
 * Returns a sorted array of filenames (e.g. ['bank.spf', 'girl.spf', ...]).
 */
export async function getNpcPortraitIndex(clientPath) {
  if (!clientPath) return []
  const cached = filenameIndexCache.get(clientPath)
  if (cached) return cached
  const archive = await loadArchive(clientPath, ARCHIVE)
  const entries = archive.getEntriesByExtension('.spf')
  const names = entries.map((e) => e.entryName).sort((a, b) => a.localeCompare(b))
  filenameIndexCache.set(clientPath, names)

  console.log(`[npcPortraitData] loaded ${names.length} portrait SPFs from ${ARCHIVE}`)
  return names
}

async function getSpf(clientPath, filename) {
  const key = `${clientPath}|${filename}`
  const cached = spfCache.get(key)
  if (cached) return cached
  const archive = await loadArchive(clientPath, ARCHIVE)
  if (!archive.has(filename)) return null
  const spf = SpfFile.fromArchive(filename, archive)
  spfCache.set(key, spf)
  return spf
}

/**
 * Render an NPC portrait to an ImageBitmap.
 *
 * @param {string} clientPath
 * @param {string} filename   Literal SPF filename (e.g. "mage.spf")
 * @param {number} [frameIdx] Defaults to 0 — portraits are typically single-frame
 */
export async function getNpcPortraitBitmap(clientPath, filename, frameIdx = 0) {
  if (!clientPath || !filename) return null
  const key = `${clientPath}|${filename}|${frameIdx}`
  const cachedBmp = bitmapCache.get(key)
  if (cachedBmp) return cachedBmp

  const spf = await getSpf(clientPath, filename)
  if (!spf) return null
  const frame = spf.frames?.[frameIdx]
  if (!frame) return null

  let rgba
  try {
    if (spf.format === SpfFormatType.Colorized) {
      rgba = renderSpfColorized(frame)
    } else {
      // Palettized — use the SPF's embedded primaryColors palette.
      rgba = renderSpfPalettized(frame, spf.primaryColors)
    }
  } catch {
    return null
  }
  if (!rgba || rgba.width === 0 || rgba.height === 0) return null

  const bitmap = await createImageBitmap(toImageData(rgba))
  bitmapCache.set(key, bitmap)
  return bitmap
}

export function clearNpcPortraitCache() {
  for (const bmp of bitmapCache.values()) {
    try {
      bmp.close?.()
    } catch {
      /* ignore */
    }
  }
  bitmapCache.clear()
  spfCache.clear()
  filenameIndexCache.clear()
}
registerCacheClearer(clearNpcPortraitCache)

/** React hook — sorted portrait filename list for current clientPath. */
export function useNpcPortraitIndex() {
  const clientPath = useRecoilValue(clientPathState)
  const [names, setNames] = useState(() => filenameIndexCache.get(clientPath) || null)
  useEffect(() => {
    if (!clientPath) {
      setNames(null)
      return undefined
    }
    let cancelled = false
    getNpcPortraitIndex(clientPath)
      .then((r) => {
        if (!cancelled) setNames(r)
      })
      .catch(() => {
        if (!cancelled) setNames(null)
      })
    return () => {
      cancelled = true
    }
  }, [clientPath])
  return names
}
