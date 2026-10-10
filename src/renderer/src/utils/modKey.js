// The platform's command key. Pure: callers pass `window.electronAPI.platform`,
// so this tests in the node environment.
//
// On macOS the command key is ⌘ alone. Control belongs to the text system there
// (⌃K deletes to the end of the line, ⌃P moves up a line), and a Control-click is
// a right-click. So a Control chord is never Creidhne's on macOS. Elsewhere Ctrl
// and ⌘ are interchangeable, as they always were.

/** Is the platform's command key held? */
export function isModKey(e, platform) {
  return platform === 'darwin' ? e.metaKey && !e.ctrlKey : e.ctrlKey || e.metaKey
}

/** A Control chord on macOS: the text system's, so Creidhne leaves it alone. */
export function isForeignChord(e, platform) {
  return platform === 'darwin' && e.ctrlKey
}
