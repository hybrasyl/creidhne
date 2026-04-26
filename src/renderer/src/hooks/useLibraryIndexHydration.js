import { useCallback } from 'react'
import { useSetRecoilState } from 'recoil'
import { libraryIndexState } from '../recoil/atoms'

const dedup = (a, b) => [...new Set([...(a || []), ...(b || [])])].sort()

/**
 * Single source of truth for hydrating the libraryIndex Recoil atom.
 *
 * libraryIndex is a merge of two sources:
 *  1. The persisted index built by hybindex-ts (loadIndex) — castables,
 *     items, statuses, etc. plus aggregate fields like itemWeaponDamage.
 *  2. The user's constants.json (loadUserConstants) — vendorTabs,
 *     npcJobs, motions, weapons, and the per-category dedup overlays.
 *
 * Callers that only re-load the index (rebuild buttons) used to do
 * `setLibraryIndex(index || {})`, which silently dropped every constants-
 * derived field — invisible until the editor started reading one of them.
 * Routing all callers through this hook keeps the merge consistent.
 */
export function useLibraryIndexHydration() {
  const setLibraryIndex = useSetRecoilState(libraryIndexState)

  return useCallback(
    async (libraryPath) => {
      if (!libraryPath) {
        setLibraryIndex({})
        return
      }
      const [index, constants] = await Promise.all([
        window.electronAPI.loadIndex(libraryPath),
        window.electronAPI.loadUserConstants(libraryPath)
      ])
      setLibraryIndex({
        ...(index || {}),
        vendorTabs: dedup(index?.vendorTabs, constants?.vendorTabs),
        npcJobs: dedup(index?.npcJobs, constants?.npcJobs),
        itemCategories: dedup(index?.itemCategories, constants?.itemCategories),
        castableCategories: dedup(index?.castableCategories, constants?.castableCategories),
        statusCategories: dedup(index?.statusCategories, constants?.statusCategories),
        cookieNames: dedup(
          index?.cookieNames,
          (constants?.cookies || []).map((c) => c.name)
        ),
        motions: constants?.motions || [],
        weapons: constants?.weapons || []
      })
    },
    [setLibraryIndex]
  )
}
