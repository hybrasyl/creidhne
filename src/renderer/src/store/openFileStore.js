import { create } from 'zustand'

// A request to open one file on its editor page (HTOO-625). A report leaves the
// request and goes to the page; the page takes it with `useOpenFileRequest`
// once its file list has loaded. The page keeps its own selection state, so
// nothing about a page's editor moves out of it for a report's sake.
//
// A request is a counter, so a repeat of the same file is a new value.

let seq = 0

export const useOpenFileStore = create((set, get) => ({
  request: null,
  /** Ask the page for `type` to open the file `rel`. */
  open: (type, rel) => set({ request: { type, rel, seq: ++seq } }),
  /** Drop the request for `type`. True when there was one. */
  take: (type) => {
    if (get().request?.type !== type) return false
    set({ request: null })
    return true
  }
}))
