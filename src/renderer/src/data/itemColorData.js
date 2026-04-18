// Item color data layer.
//
// color0.tbl inside legend.dat maps each ItemColor enum value (0..71 today,
// up to 255 in principle) to a set of 6 RGB shades that together define the
// dye's highlight/midtone/shadow range. The enum order matches ITEM_COLORS
// (offset by 1 to skip the leading blank UI entry).

import { useState, useEffect } from 'react'
import { useRecoilValue } from 'recoil'
import { ColorTable } from '@eriscorp/dalib-ts'
import { ITEM_COLORS } from './itemConstants'
import { loadArchive, registerCacheClearer } from '../utils/daClient'
import { clientPathState } from '../recoil/atoms'

// clientPath → Map<colorName, [{r,g,b,a}, ...]>
const swatchMapCache = new Map()

/**
 * Load color0.tbl from legend.dat and build a Map keyed by ItemColor enum
 * name (e.g. 'None', 'Crimson') whose value is the 6-shade array for that
 * color. Cached per clientPath.
 *
 * @returns {Promise<Map<string, {r:number,g:number,b:number,a:number}[]>>}
 */
export async function loadItemColorSwatches(clientPath) {
  if (!clientPath) return new Map()
  const cached = swatchMapCache.get(clientPath)
  if (cached) return cached

  const archive = await loadArchive(clientPath, 'legend.dat')
  const table = ColorTable.fromArchive('color0', archive)
  const map = new Map()
  // ITEM_COLORS[0] is '' (the "(none)" UI option, no swatch). Every entry
  // after that corresponds to enum value (index - 1).
  for (let i = 1; i < ITEM_COLORS.length; i++) {
    const name = ITEM_COLORS[i]
    const entry = table.get(i - 1)
    if (entry?.colors) map.set(name, entry.colors)
  }
  swatchMapCache.set(clientPath, map)

  console.log(`[itemColorData] loaded ${map.size} color swatches from color0.tbl`)
  return map
}

export function clearItemColorCache() {
  swatchMapCache.clear()
}
registerCacheClearer(clearItemColorCache)

/**
 * React hook — returns the swatch map for the current clientPath, or null
 * while loading / if clientPath is unset. Loads once per clientPath.
 */
export function useItemColorSwatches() {
  const clientPath = useRecoilValue(clientPathState)
  const [swatches, setSwatches] = useState(() => swatchMapCache.get(clientPath) || null)

  useEffect(() => {
    if (!clientPath) {
      setSwatches(null)
      return undefined
    }
    let cancelled = false
    loadItemColorSwatches(clientPath)
      .then((map) => {
        if (!cancelled) setSwatches(map)
      })
      .catch(() => {
        if (!cancelled) setSwatches(null)
      })
    return () => {
      cancelled = true
    }
  }, [clientPath])

  return swatches
}
