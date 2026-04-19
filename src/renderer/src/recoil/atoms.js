import { atom } from 'recoil'

export const themeState = atom({
  key: 'themeState',
  default: 'hybrasyl'
})

export const settingsState = atom({
  key: 'settingsState',
  default: {
    // Your default settings
  }
})

export const currentPageState = atom({
  key: 'currentPageState',
  default: 'dashboard' // Set the default page
})

export const activeLibraryState = atom({
  key: 'activeLibraryState',
  default: null // Default to no active library
})

export const clientPathState = atom({
  key: 'clientPathState',
  default: null // Path to Dark Ages client install directory
})

export const taliesinPathState = atom({
  key: 'taliesinPathState',
  default: null // Path to companion app (Taliesin.exe)
})

export const librariesState = atom({
  key: 'librariesState',
  default: []
})

export const libraryIndexState = atom({
  key: 'libraryIndexState',
  default: {}
})

export const dirtyEditorState = atom({
  key: 'dirtyEditorState',
  default: null // null | { label: string, onSave: () => Promise<void> }
})

export const recentPagesState = atom({
  key: 'recentPagesState',
  default: (() => {
    try {
      return JSON.parse(localStorage.getItem('recentPages') || '[]')
    } catch {
      return []
    }
  })()
})

export const referencePanelOpenState = atom({
  key: 'referencePanelOpenState',
  default: false
})

export const referenceSelectionState = atom({
  key: 'referenceSelectionState',
  default: null // null | { type: 'castable'|'status'|'item'|'creature', name: string }
})

// Hybrasyl .datf asset pack state. Loaded from main at app start and whenever
// clientPath changes. Shape matches listActivePacks()'s IPC return.
// [{ fileName, manifest, coveredSubtypes: string[] }, ...]
export const activePacksState = atom({
  key: 'activePacksState',
  default: []
})

// Per-subtype covered-id set, derived from activePacks. Populated by App
// whenever activePacks changes. Example: { skill: Set<number>, spell: Set<number>, nation: Set<number> }.
// Consumed by DualIconView / picker dialogs to answer "does Hybrasyl cover id X?"
// in O(1).
export const packCoverageState = atom({
  key: 'packCoverageState',
  default: {}
})

// 'vanilla' | 'hybrasyl'. Synced to settings on change so selection persists
// across sessions. See the useSyncPickerMode hook in hooks/usePickerMode.js.
export const iconPickerModeState = atom({
  key: 'iconPickerModeState',
  default: 'vanilla'
})

export const nationCrestPickerModeState = atom({
  key: 'nationCrestPickerModeState',
  default: 'vanilla'
})
