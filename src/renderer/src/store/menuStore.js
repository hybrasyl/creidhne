import { create } from 'zustand'

// The menu commands whose action a component holds in its own state. About and
// What's New are dialogs in SettingsPage's `useState`. The menu goes to Settings
// and leaves a pending request here, and SettingsPage takes it with
// `useMenuRequest`, also when it mounts after the request. No dialog moves out of
// its component for the menu's sake.
//
// A request is a counter, so a repeat is a new value.

let seq = 0

export const useMenuStore = create((set, get) => ({
  pending: {},
  request: (command) => set((s) => ({ pending: { ...s.pending, [command]: ++seq } })),
  /** Drop a request. True when there was one. */
  take: (command) => {
    if (get().pending[command] === undefined) return false
    set((s) => {
      const pending = { ...s.pending }
      delete pending[command]
      return { pending }
    })
    return true
  },
  /**
   * Drop every request. A request waits for its page, and the page can be refused:
   * Cancel in the unsaved-changes dialog. A request left behind would open its
   * dialog at the next visit to Settings, which nobody asked for then.
   */
  clear: () => set({ pending: {} })
}))
