// Remove the unpack folders that killed portable launches left in %TEMP% (HTOO-494).
//
// The portable exe is an NSIS stub. It unpacks the app into its own
// `%TEMP%\ns*.tmp` folder, runs it with `ExecWait`, and deletes that folder when
// the app exits. It cleans up after a normal close, after a second launch that
// loses the single-instance lock, and after the app crashes or is killed. The
// stub waits on the app in all three cases. This was measured on oghma's exe on
// 2026-09-27.
//
// **If the STUB itself is killed, nothing runs its `RMDir`.** The folder stays
// under a random name that no later launch uses again. It holds the package, the
// scratch that the extraction wrote, and the unpacked app. Creidhne sets
// `portable.unpackDirName: true` (HTOO-351, fault 2), so each launch gets its own
// unpack folder, not each build. That stops a second launch from deleting the
// folder of the running copy. It is also the reason that no later launch removes
// the folder of a killed launch by name. This sweep exists for that reason.
//
// So a portable launch removes what earlier launches left. Each rule below is
// part of the safety case. Do not remove a rule to make the code shorter.
//
//   - Run only as the portable exe, and only when this process can find its OWN
//     unpack folder. A process that cannot identify itself cannot be sure that
//     it does not delete itself, so it does nothing.
//   - Touch only `ns*.tmp` folders that hold `app\<our exe>` and
//     `app\resources\app.asar`. The leftovers of another app are not ours.
//   - Touch only folders older than `MIN_AGE_MS`. A second launch unpacks for
//     some seconds before anything in its folder is locked.
//   - RENAME first, then delete. Windows refuses to rename a folder while the exe
//     of a running app is mapped from it (EBUSY) or its stub holds it (EPERM).
//     This was measured on the real exe. A refused rename means "in use", and
//     the sweep skips the folder. A direct delete can half-delete a running copy.
//
// The sweep runs in the background after boot and never throws. A sweep that
// fails costs disk space, not a working app.
//
// **In Electron, pass `original-fs`, never the patched `fs`.** Electron's `fs`
// treats each path that ends in `app.asar` as an archive. When it touches the
// `app.asar` of a leftover, it opens the file and keeps the handle. Windows then
// refuses the rename, because this process holds the file. Oghma's first
// packaged build of this sweep skipped each real leftover as "in use" for that
// reason, and each unit test passed under plain Node, which has no asar patch.
// The signature check below reads directory listings only. Thus it never opens
// `app.asar`, also under the patched `fs`.

import { promises as nodeFs } from 'fs'
import { basename, dirname, join } from 'path'

/**
 * The file operations that the sweep uses. The promises API of Electron's
 * `original-fs` and Node's `fs.promises` both fit, so a test can supply its own.
 *
 * @typedef {object} SweepFs
 * @property {(path: string) => Promise<string[]>} readdir
 * @property {(path: string) => Promise<{ isDirectory(): boolean, isSymbolicLink(): boolean, mtimeMs: number }>} lstat
 * @property {(from: string, to: string) => Promise<void>} rename
 * @property {(path: string, opts: { recursive: boolean, force: boolean, maxRetries: number, retryDelay: number }) => Promise<void>} rm
 */

/**
 * @typedef {object} SweepOptions
 * @property {string} execPath `process.execPath`: `<TEMP>\nsXXXX.tmp\app\creidhne.exe` in a portable run.
 * @property {boolean} isPortable True when the NSIS stub started this process. The stub sets `PORTABLE_EXECUTABLE_DIR`.
 * @property {number} [now]
 * @property {SweepFs} [fs] `original-fs` in Electron (see above). Node's `fs.promises` by default.
 * @property {(message: string) => void} [onError]
 */

/**
 * @typedef {object} SweepResult
 * @property {string[]} removed
 * @property {string[]} skipped Folders that matched, but were in use or too new.
 */

/**
 * NSIS names the folder `ns` + some hex digits + `.tmp`. The number of digits
 * changes (`nskBBD.tmp` and `nsm78D5.tmp` were both seen), so the pattern does
 * not fix it.
 */
const NS_DIR = /^ns[0-9a-z]+\.tmp$/i

/** A folder younger than this can belong to a launch that still unpacks. */
export const MIN_AGE_MS = 10 * 60 * 1000

/** The suffix that a folder gets after the rename proves that nothing uses it. */
const SWEEP_SUFFIX = '.creidhne-sweep'

/**
 * The unpack folder of this process, or null when the path does not have the
 * shape of a portable launch.
 *
 * @param {string} execPath
 * @returns {string | null}
 */
export function ownUnpackDir(execPath) {
  const appDir = dirname(execPath)
  if (basename(appDir).toLowerCase() !== 'app') return null
  const nsDir = dirname(appDir)
  return NS_DIR.test(basename(nsDir)) ? nsDir : null
}

/**
 * The names in a folder, in lower case, or none when the folder cannot be read.
 *
 * @param {SweepFs} fs
 * @param {string} dir
 * @returns {Promise<Set<string>>}
 */
async function namesIn(fs, dir) {
  try {
    return new Set((await fs.readdir(dir)).map((name) => name.toLowerCase()))
  } catch {
    return new Set()
  }
}

/**
 * True when the folder holds a copy of THIS app, not the unpack of another app.
 * Directory listings only: nothing here stats or opens `app.asar` itself.
 *
 * @param {SweepFs} fs
 * @param {string} dir
 * @param {string} exeName
 * @returns {Promise<boolean>}
 */
async function isOurUnpack(fs, dir, exeName) {
  return (
    (await namesIn(fs, join(dir, 'app'))).has(exeName.toLowerCase()) &&
    (await namesIn(fs, join(dir, 'app', 'resources'))).has('app.asar')
  )
}

/**
 * @param {SweepOptions} options
 * @returns {Promise<SweepResult>}
 */
export async function sweepPortableLeftovers(options) {
  /** @type {SweepResult} */
  const result = { removed: [], skipped: [] }
  if (!options.isPortable) return result
  const own = ownUnpackDir(options.execPath)
  if (own === null) return result

  const now = options.now ?? Date.now()
  const fs = options.fs ?? nodeFs
  const report = options.onError ?? (() => undefined)
  const temp = dirname(own)
  const exeName = basename(options.execPath)

  let entries
  try {
    entries = await fs.readdir(temp)
  } catch (error) {
    report(`cannot read ${temp}: ${error?.message ?? error}`)
    return result
  }

  for (const name of entries) {
    if (!NS_DIR.test(name)) continue
    const dir = join(temp, name)
    if (dir.toLowerCase() === own.toLowerCase()) continue
    try {
      const stat = await fs.lstat(dir)
      // A link can point to any location, so only a real folder is a leftover.
      if (!stat.isDirectory() || stat.isSymbolicLink()) continue
      if (!(await isOurUnpack(fs, dir, exeName))) continue
      if (now - stat.mtimeMs < MIN_AGE_MS) {
        result.skipped.push(dir)
        continue
      }
      const claimed = dir + SWEEP_SUFFIX
      try {
        await fs.rename(dir, claimed)
      } catch {
        // In use: a running copy, or a stub that is still alive.
        result.skipped.push(dir)
        continue
      }
      await fs.rm(claimed, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
      result.removed.push(dir)
    } catch (error) {
      report(`${dir}: ${error?.message ?? error}`)
    }
  }

  // A sweep that stopped after its rename leaves `<name>.creidhne-sweep`. Nothing
  // runs from a renamed folder, so a later launch can complete the removal.
  for (const name of entries) {
    if (!name.endsWith(SWEEP_SUFFIX) || !NS_DIR.test(name.slice(0, -SWEEP_SUFFIX.length))) continue
    const dir = join(temp, name)
    try {
      const stat = await fs.lstat(dir)
      if (!stat.isDirectory() || stat.isSymbolicLink()) continue
      await fs.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
      result.removed.push(dir)
    } catch (error) {
      report(`${dir}: ${error?.message ?? error}`)
    }
  }
  return result
}
