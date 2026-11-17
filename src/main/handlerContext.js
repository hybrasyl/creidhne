import { dirname, normalize } from 'path'
import {
  assertRealInsideAnyRoot,
  isFilesystemRoot,
  realContains,
  realpathAllowMissing
} from './pathSafety.js'
import {
  emptyGrants,
  isGranted,
  measureExecutable,
  settingsDirPaths,
  snapshotGrants,
  verifyExecutable
} from './grants.js'

// The authority model (HTOO-679, HTOO-681). Taliesin has the same model; its
// `docs/authority-model.md` explains it.
//
// Two root sets gate every Category-A handler (paths the renderer supplies as
// full absolute paths, no implicit parent):
//
// - `blessedRoots`: every path a native dialog returned this session, and the
//   Brigid assets folder that main suggests. They last until the process exits.
// - `settingsRoots`: the settings paths that a grant or a blessed root covers.
//
// The renderer writes settings.json, so a settings path alone gives no
// authority. Main keeps that record in grants.json (`grants.js`), and only main
// writes it. A settings save can keep or drop a grant. It cannot add one.

const settingsRoots = new Set()
const blessedRoots = new Set()
let grants = emptyGrants()
let settingsDir = null

/**
 * Set the grants loaded at boot and the settings folder, which no IPC path may
 * reach. Call before any IPC handler can fire.
 */
export function initAuthority({ grants: loaded, settingsDir: dir }) {
  grants = loaded ?? emptyGrants()
  settingsDir = dir ?? null
}

/** The live grant state. */
export function getGrants() {
  return grants
}

async function persistGrants() {
  await grants.persist?.(snapshotGrants(grants))
}

/**
 * Replace the settings-derived root set from a settings snapshot. Dialog
 * blessings are kept. A settings path becomes a root only when a grant or a
 * blessed root covers it; the rest are returned so the caller can log them.
 * A filesystem root (`/`, `C:\`) is never a root.
 */
export function applySettingsRoots(settings) {
  settingsRoots.clear()
  const refused = []
  const granted = (p) => {
    if (typeof p !== 'string' || !p) return false
    if (isGranted(grants, blessedRoots, p)) return true
    refused.push(p)
    return false
  }
  // libraryPath is conventionally <world>/xml; .creidhne/, scripts/,
  // localizations/, and friends live as siblings of the library at <world>/*.
  // Bless the world parent of every granted library so sibling paths resolve,
  // unless the parent is a drive root.
  for (const lib of Array.isArray(settings?.libraries) ? settings.libraries : []) {
    if (!granted(lib)) continue
    const normalized = normalize(lib)
    settingsRoots.add(normalized)
    const worldRoot = dirname(normalized)
    if (worldRoot && worldRoot !== normalized && !isFilesystemRoot(worldRoot)) {
      settingsRoots.add(worldRoot)
    }
  }
  if (granted(settings?.clientPath)) settingsRoots.add(normalize(settings.clientPath))
  if (granted(settings?.brigidAssetsPath)) settingsRoots.add(normalize(settings.brigidAssetsPath))
  return [...new Set(refused)]
}

/** True when `p` is a current settings root (a granted settings path). */
export function isSettingsRoot(p) {
  return typeof p === 'string' && p !== '' && settingsRoots.has(normalize(p))
}

// Add a path to the blessed (session-scoped) root set. Called by every
// dialog handler the moment the user picks a path. A filesystem root is not
// added: a picked drive does not give the renderer the whole volume.
export function bless(path) {
  if (typeof path === 'string' && path && !isFilesystemRoot(path)) {
    blessedRoots.add(normalize(path))
  }
}

// Iterable of all currently-allowed roots, in priority order: settings
// first (most stable), then dialog blessings.
export function* allRoots() {
  yield* settingsRoots
  yield* blessedRoots
}

/**
 * Check a renderer-supplied path before I/O, and return the path to use.
 *
 * 1. It must be inside an allowed root, as a string.
 * 2. Its real path must be inside the real path of an allowed root, so a
 *    junction or a symlink cannot lead out (HTOO-681).
 * 3. Its real path must not be main's own: the settings folder, which holds
 *    settings.json and grants.json, or the approved Taliesin program
 *    (HTOO-679). This holds also when the user chose a folder that contains
 *    them.
 */
export function authorizePath(candidate) {
  const { path, real } = assertRealInsideAnyRoot(allRoots(), candidate)
  if (settingsDir && realContains(realpathAllowMissing(settingsDir), real)) {
    throw new Error(`Path "${candidate}" is in Creidhne's own settings folder`)
  }
  const exe = grants.executables.taliesin
  if (exe) {
    let exeReal = exe.path
    try {
      exeReal = realpathAllowMissing(exe.path)
    } catch {
      /* compare the recorded path */
    }
    if (realContains(exeReal, real)) {
      throw new Error(`Path "${candidate}" is a program Creidhne runs`)
    }
  }
  return path
}

/**
 * Prepare a renderer settings payload for save (HTOO-679).
 *
 * - The grants are pruned to the folders the settings still name, so a removed
 *   folder loses its grant. A folder that no grant or blessed root covers is
 *   saved, but it is not a root.
 * - `taliesinPath` is main's record, not the renderer's. A null clears the
 *   approval; any other value is replaced by the approved path.
 *
 * Returns the settings to persist.
 */
export async function reconcileSettingsSave(settings) {
  const kept = settingsDirPaths(settings).filter((p) => isGranted(grants, blessedRoots, p))
  const before = [...grants.dirs].sort().join('\n')
  grants.dirs = new Set(kept)
  let changed = [...grants.dirs].sort().join('\n') !== before
  if (!settings.taliesinPath && grants.executables.taliesin) {
    delete grants.executables.taliesin
    changed = true
  }
  if (changed) await persistGrants()
  return { ...settings, taliesinPath: grants.executables.taliesin?.path ?? null }
}

/** Settings as loaded, with `taliesinPath` from main's record. */
export function withGrantedTaliesin(settings) {
  return { ...settings, taliesinPath: grants.executables.taliesin?.path ?? null }
}

/**
 * Record `path` as the approved Taliesin program. Only main calls this, with a
 * native dialog result: no IPC channel takes a program path.
 */
export async function grantTaliesin(path) {
  grants.executables.taliesin = await measureExecutable(path)
  await persistGrants()
}

/**
 * The approved Taliesin program, checked against the disk, or null when none
 * is approved. Throws when the approved file is missing or changed.
 */
export async function approvedTaliesin() {
  const grant = grants.executables.taliesin
  if (!grant) return null
  const { grant: next, changed } = await verifyExecutable(grant)
  if (changed) {
    grants.executables.taliesin = next
    await persistGrants()
  }
  return next.path
}

// Test-only: clear the state so each test starts from a known state.
export function _resetRootsForTests({ grants: g, settingsDir: dir } = {}) {
  settingsRoots.clear()
  blessedRoots.clear()
  grants = g ?? emptyGrants()
  settingsDir = dir ?? null
}
