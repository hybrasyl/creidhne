import { useEffect } from 'react'
import { useSetRecoilState } from 'recoil'
import { activePacksState, packCoverageState } from '../recoil/atoms'

// Fetch the active .datf packs + their per-subtype covered-id sets from main.
// Shared by App bootstrap and the on-open picker rescan so the coverage logic
// lives in one place. Returns { packs, coverage }; never throws.
export async function loadPackState() {
  try {
    const packs = await window.electronAPI.listActivePacks()
    const packList = Array.isArray(packs) ? packs : []
    const subtypes = new Set()
    for (const p of packList) for (const s of p.coveredSubtypes || []) subtypes.add(s)
    const coverage = {}
    for (const s of subtypes) {
      const ids = await window.electronAPI.listPackCoveredIds(s)
      coverage[s] = Array.isArray(ids) ? ids : []
    }
    return { packs: packList, coverage }
  } catch {
    return { packs: [], coverage: {} }
  }
}

/**
 * Re-scan the .datf source directories (brigid assets + DA client) so packs
 * dropped in while the app is running are picked up, then refresh the coverage
 * atoms. Fires whenever `open` transitions to true — wire it into any picker
 * dialog so opening it re-discovers newly-added packs without an app restart.
 */
export function useRescanPacksOnOpen(open) {
  const setActivePacks = useSetRecoilState(activePacksState)
  const setPackCoverage = useSetRecoilState(packCoverageState)
  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    ;(async () => {
      try {
        await window.electronAPI.reloadPacks()
      } catch {
        /* reload failed — fall through to whatever's already loaded */
      }
      const { packs, coverage } = await loadPackState()
      if (!cancelled) {
        setActivePacks(packs)
        setPackCoverage(coverage)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, setActivePacks, setPackCoverage])
}
