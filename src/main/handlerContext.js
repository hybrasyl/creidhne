import { normalize } from 'path'

// Two root sets gate every Category-A handler (paths the renderer supplies
// as full absolute paths, no implicit parent). The split lets settings
// reloads refresh `settingsRoots` without dropping the dialog blessings the
// user just made — those live in `blessedRoots` until the process exits.

const settingsRoots = new Set()
const blessedRoots = new Set()

// Refresh `settingsRoots` from the current settings shape. Called at app
// startup and again after every `settings:save`. Any path the user has
// configured (libraries + DA client install) becomes an allowed root.
// `taliesinPath` is intentionally excluded — it's locked separately by the
// §11 spawn whitelist and doesn't need read/write access through fs handlers.
export function applySettingsRoots(settings) {
  settingsRoots.clear()
  if (Array.isArray(settings?.libraries)) {
    for (const lib of settings.libraries) {
      if (typeof lib === 'string' && lib) settingsRoots.add(normalize(lib))
    }
  }
  if (typeof settings?.clientPath === 'string' && settings.clientPath) {
    settingsRoots.add(normalize(settings.clientPath))
  }
}

// Add a path to the blessed (session-scoped) root set. Called by every
// dialog handler the moment the user picks a path — this matches the user's
// mental model ("I picked it, of course I can read it").
export function bless(path) {
  if (typeof path === 'string' && path) blessedRoots.add(normalize(path))
}

// Iterable of all currently-allowed roots, in priority order: settings
// first (most stable), then dialog blessings.
export function* allRoots() {
  yield* settingsRoots
  yield* blessedRoots
}

// Test-only: clear both sets so each test starts from a known state.
// Production code never imports this — the harness wipes itself between
// tests. Exported (vs. closure-scoped) so test setup can reach it.
export function _resetRootsForTests() {
  settingsRoots.clear()
  blessedRoots.clear()
}
