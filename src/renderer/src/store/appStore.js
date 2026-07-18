import { create } from 'zustand'
import { useCallback } from 'react'

// App-wide state store (replaces the former Recoil atom layer). Each former atom
// is a field here. Consumers use the useStoreValue / useStoreState /
// useSetStoreValue hooks with the exported selector descriptors below, which
// preserves per-field subscription granularity — a component re-renders only
// when the field it selects changes (Object.is on the slice, like Recoil).

export const useAppStore = create((set) => ({
  theme: 'hybrasyl',
  settings: {},
  currentPage: 'dashboard',
  activeLibrary: null,
  clientPath: null,
  taliesinPath: null,
  brigidAssetsPath: null,
  npcPortraitPickerMode: 'vanilla',
  soundPickerMode: 'vanilla',
  creaturePickerMode: 'vanilla',
  libraries: [],
  libraryIndex: {},
  dirtyEditor: null,
  referencePanelOpen: false,
  referenceSelection: null,
  activePacks: [],
  packCoverage: {},
  iconPickerMode: 'vanilla',
  nationCrestPickerMode: 'vanilla',
  fileListViewMode: 'flat',
  reportIssueOpen: false,
  // Generic setter — accepts a value or an updater fn, matching Recoil setters
  // (e.g. setLibraryIndex(prev => ({ ...prev, ...section }))).
  _set: (key, value) => set((s) => ({ [key]: typeof value === 'function' ? value(s[key]) : value }))
}))

// ── Selector descriptors (former atoms) — names preserved for drop-in imports ──
export const themeState = { key: 'theme' }
export const settingsState = { key: 'settings' }
export const currentPageState = { key: 'currentPage' }
export const activeLibraryState = { key: 'activeLibrary' }
export const clientPathState = { key: 'clientPath' }
export const taliesinPathState = { key: 'taliesinPath' }
export const brigidAssetsPathState = { key: 'brigidAssetsPath' }
export const npcPortraitPickerModeState = { key: 'npcPortraitPickerMode' }
export const soundPickerModeState = { key: 'soundPickerMode' }
export const creaturePickerModeState = { key: 'creaturePickerMode' }
export const librariesState = { key: 'libraries' }
export const libraryIndexState = { key: 'libraryIndex' }
export const dirtyEditorState = { key: 'dirtyEditor' }
export const referencePanelOpenState = { key: 'referencePanelOpen' }
export const referenceSelectionState = { key: 'referenceSelection' }
export const activePacksState = { key: 'activePacks' }
export const packCoverageState = { key: 'packCoverage' }
export const iconPickerModeState = { key: 'iconPickerMode' }
export const nationCrestPickerModeState = { key: 'nationCrestPickerMode' }
// Folder-vs-flat for editor file lists. Read straight from the store by
// EditorFileListPanel, so the toggle needs no prop threading through the pages.
export const fileListViewModeState = { key: 'fileListViewMode' }
// Report Issue dialog visibility — opened from the toolbar bug button and the
// Settings About card, mounted once in App.
export const reportIssueOpenState = { key: 'reportIssueOpen' }

// ── Hooks mirroring the three Recoil shapes ───────────────────────────────────

/** Read a field (subscribes to just that field). Replaces useRecoilValue. */
export function useStoreValue(atom) {
  return useAppStore((s) => s[atom.key])
}

/** Stable setter for a field (accepts a value or updater fn). Replaces useSetRecoilState. */
export function useSetStoreValue(atom) {
  const set = useAppStore((s) => s._set)
  return useCallback((value) => set(atom.key, value), [set, atom.key])
}

/** [value, setter] for a field. Replaces useRecoilState. */
export function useStoreState(atom) {
  return [useStoreValue(atom), useSetStoreValue(atom)]
}
