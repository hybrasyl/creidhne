import { create } from 'zustand'
import { createContext, useCallback, useContext } from 'react'

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
  // The staged index (HTOO-453): `{ [type]: { names, namesByFilename,
  // duplicateNames } }` for the files in <world>/.staging. Creidhne's alone —
  // built in the worker, never saved. See src/shared/staging.js.
  stagedIndex: {},
  // The one confirm dialog, mounted in App: { title, message, items, choices,
  // resolve } or null. See hooks/useConfirm.js.
  confirmDialog: null,
  dirtyEditor: null,
  referencePanelOpen: false,
  referenceSelection: null,
  activePacks: [],
  packCoverage: {},
  iconPickerMode: 'vanilla',
  nationCrestPickerMode: 'vanilla',
  fileListViewMode: 'flat',
  reportIssueOpen: false,
  // Bumped after each settings write is acknowledged by main. Anything that asks
  // main a question about what settings now say must wait for this, not for the
  // state change that caused the write. See useCompanionStatus.
  settingsSavedNonce: 0,
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
export const stagedIndexState = { key: 'stagedIndex' }
export const confirmDialogState = { key: 'confirmDialog' }
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
// See the field comment: the acknowledgement, not the intent.
export const settingsSavedNonceState = { key: 'settingsSavedNonce' }
// Report Issue dialog visibility — opened from the toolbar bug button and the
// Settings About card, mounted once in App.
export const reportIssueOpenState = { key: 'reportIssueOpen' }

// ── Hooks mirroring the three Recoil shapes ───────────────────────────────────

/**
 * The index a subtree sees in place of the live one, or null for the live one.
 * A staged editor sees the live names plus the staged names (HTOO-453), and
 * `components/shared/StagingScope.jsx` is the only provider. It is read here,
 * in the one accessor, so the fifty-odd components that read the index from
 * the store each get the right one without a change.
 */
export const IndexViewContext = createContext(null)

/** Read a field (subscribes to just that field). Replaces useRecoilValue. */
export function useStoreValue(atom) {
  const value = useAppStore((s) => s[atom.key])
  const view = useContext(IndexViewContext)
  return atom === libraryIndexState && view ? view : value
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
