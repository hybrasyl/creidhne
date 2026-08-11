/**
 * Resolve a Dark Ages client path to the casing it really has on disk.
 *
 * HTOO-287. The official installer writes `Legend.dat` with a capital L. Every
 * caller in this app names the client archives as lowercase literals, because
 * that is how the formats and the palette rules spell them. Windows folds case
 * on lookup, so the mismatch is invisible there and the app has always worked.
 * On Linux and macOS the read fails, and the failure is silent: these reads sit
 * behind a `catch` that means "the file is not present", which is exactly what a
 * wrong-cased name looks like. A stock install then shows a red client-path
 * indicator, and every sprite, icon and sound picker is empty.
 *
 * The rule is: **ask the directory instead of guessing at the casings seen in
 * the wild.** A list of candidate spellings (`Legend.dat`, `LEGEND.DAT`, …)
 * covers what somebody has met and nothing else. One `readdir` covers every
 * case, including the ones nobody has met yet.
 *
 * Two differences from Taliesin's `src/main/fsCase.ts`, which is the same rule:
 *
 *   - **It resolves every segment, not only the filename.** Creidhne asks for
 *     `npc/npcbase.dat`, so the directory needs the same treatment as the file
 *     inside it. Taliesin's callers pass bare names only.
 *   - **There is no renderer copy.** Taliesin's renderer has a `listDir` IPC and
 *     resolves its own paths; Creidhne's renderer has no directory listing at
 *     all, and every client read already goes through main. So main resolves,
 *     and the renderer keeps passing the lowercase literal it always passed.
 *     One implementation of the rule, not two.
 */
import { promises as fs } from 'fs'
import { join } from 'path'

/**
 * Pick `wanted` out of `names`, ignoring case. Returns `null` when nothing
 * matches.
 *
 * An exact match wins outright, so a directory that holds both `Legend.dat` and
 * `legend.dat` — possible on a case-sensitive filesystem — resolves to the one
 * that was asked for, and not to whichever entry `readdir` returned first.
 *
 * Pure, so the interesting cases are testable without a filesystem.
 */
export function matchNameIgnoringCase(names, wanted) {
  if (names.includes(wanted)) return wanted
  const lower = wanted.toLowerCase()
  return names.find((n) => n.toLowerCase() === lower) ?? null
}

/**
 * The absolute path to `relative` inside `root`, under the casing each directory
 * really uses.
 *
 * `relative` accepts either separator and may name a subdirectory
 * (`npc/npcbase.dat`). Each segment is resolved against its own parent, because
 * a client that capitalises `Legend.dat` can capitalise `NPC` too.
 *
 * **Each segment falls back to the requested spelling** when its parent cannot
 * be read or holds no match. That keeps this a resolution step and not an
 * existence check: the caller's own error handling still runs, and its error
 * message still names the file the caller asked for instead of one this function
 * invented.
 *
 * Callers must reject traversal in `relative` themselves — `join` collapses
 * `..`, so this function is not the guard. `fs:readClientFile` uses
 * `assertInside` for that, the same way `fs:listSection` does for its `type`.
 */
export async function resolveClientPath(root, relative) {
  const segments = String(relative || '')
    .split(/[\\/]+/)
    .filter(Boolean)
  let current = root
  for (const segment of segments) {
    let resolved = segment
    try {
      resolved = matchNameIgnoringCase(await fs.readdir(current), segment) ?? segment
    } catch {
      /* unreadable parent: keep the requested spelling and let the caller fail */
    }
    current = join(current, resolved)
  }
  return current
}
