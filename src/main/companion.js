/**
 * Finding and launching Taliesin, Creidhne's companion application.
 *
 * HTOO-292. The previous version was Windows-shaped in three ways at once: the
 * renderer handed main an executable path, the settings picker filtered for
 * `exe`, and the launch was a bare `spawn`. So the setting could not even be
 * *populated* on macOS or Linux, where the companion is a `.app` bundle or an
 * AppImage or a desktop entry rather than a directly-spawnable file.
 *
 * **The renderer now names no path at all.** `spawn` has a far larger blast
 * radius than a file read, so what may be launched is decided here, from sources
 * this process controls. The old allowlist — permit exactly the configured string
 * — was the right instinct and survives as the `manual` branch; what it lacked
 * was any notion of a target that is not a binary.
 *
 * **Every platform probe is injected.** Registry queries, `.desktop` lookups and
 * Applications-folder scans cannot run in a unit test, and a resolver whose
 * precedence rules are only exercised on the author's own machine is a resolver
 * with one tested path. The probe object is the seam; `nodeProbe()` is the real
 * one.
 *
 * Ported from Taliesin's `src/main/companion.ts`, which is the same module with
 * the two candidate lists swapped. Change one, look at the other.
 */
import { basename, dirname, join } from 'path'
import { promises as fs, constants as fsConstants } from 'fs'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { matchNameIgnoringCase } from './fsCase.js'

const execFileAsync = promisify(execFile)

/**
 * Creidhne has exactly one companion. The id exists so the IPC carries an
 * identity rather than a path.
 *
 * @typedef {'taliesin'} CompanionId
 */

/**
 * How the target is started. A macOS bundle is a directory and a desktop entry is
 * a file describing a launch — neither can be handed to `spawn`.
 *
 * @typedef {'binary' | 'appBundle' | 'desktopEntry'} CompanionKind
 */

/**
 * Where the answer came from. Surfaced in Settings, because "it works" and "it
 * works for the reason you think" are different states.
 *
 * @typedef {'manual' | 'sibling' | 'installed'} CompanionSource
 */

/**
 * Why a launch did not happen. **Not collapsed to `false`**, per the card: every
 * one of these needs a different sentence in front of the user, and three of the
 * four are fixable by them.
 *
 * @typedef {'not-found' | 'stale-override' | 'not-executable' | 'launch-failed'} CompanionFailure
 */

/**
 * The names the companion ships under, per platform. Lowercase; every lookup
 * matches case-insensitively, because Linux is case-sensitive and the installer
 * casing is not ours to predict (HTOO-287).
 */
const CANDIDATES = {
  taliesin: {
    win32: ['taliesin.exe'],
    darwin: ['Taliesin.app'],
    linux: ['taliesin', 'taliesin.appimage', 'Taliesin.AppImage']
  }
}

/** Display name as the NSIS package and the desktop entry write it. */
const PRODUCT_NAME = { taliesin: 'Taliesin' }

function candidatesFor(id, platform) {
  return CANDIDATES[id][platform] ?? CANDIDATES[id].linux
}

/** A `.app` is a directory; anything else is started directly. */
function kindOf(target) {
  if (target.toLowerCase().endsWith('.app')) return 'appBundle'
  if (target.toLowerCase().endsWith('.desktop')) return 'desktopEntry'
  return 'binary'
}

/**
 * The directory to look beside for a colocated companion.
 *
 * **On a Windows portable build `process.execPath` is the WRONG answer.**
 * electron-builder's portable target self-extracts to `%TEMP%`, so `execPath`
 * points into the extraction directory — where nothing else is, and where a
 * sibling search would silently find nothing forever. electron-builder exposes
 * the real launcher directory as `PORTABLE_EXECUTABLE_DIR`.
 *
 * That variable name is **read out of the shipped template**, not guessed:
 * `portable.nsi` sets it explicitly to `$EXEDIR`, which is the launcher's own
 * directory and not the `$TEMP` extraction directory. It also sets
 * `PORTABLE_EXECUTABLE_FILE` and `PORTABLE_EXECUTABLE_APP_FILENAME` beside it.
 * Creidhne ships portable-only on Windows, so this branch is the normal one here
 * rather than the exception.
 */
export function launcherDir(probe) {
  const portable = probe.env.PORTABLE_EXECUTABLE_DIR
  if (probe.platform === 'win32' && portable) return portable
  return dirname(probe.execPath)
}

/** A file in `dir` matching one of `names`, whatever its casing. */
async function findIn(probe, dir, names) {
  let entries
  try {
    entries = await probe.readdir(dir)
  } catch {
    return null
  }
  for (const name of names) {
    const hit = matchNameIgnoringCase(entries, name)
    if (hit) return join(dir, hit)
  }
  return null
}

/**
 * Parse `reg query … /s` output for an install location.
 *
 * Exported because this is the one piece of Windows discovery that is pure text
 * handling, and it is the piece most likely to be wrong: the output is
 * whitespace-aligned, values can contain spaces, and an uninstall subtree
 * contains hundreds of unrelated blocks. **Registry values are untrusted input**
 * — the caller checks the path exists before anything is launched.
 */
export function parseInstallLocations(stdout, productName) {
  const found = []
  // Blocks are separated by blank lines and headed by the key path.
  for (const block of stdout.split(/\r?\n\r?\n/)) {
    if (!new RegExp(`DisplayName\\s+REG_SZ\\s+${productName}\\s*$`, 'im').test(block)) continue
    const install = /InstallLocation\s+REG_SZ\s+(.+?)\s*$/im.exec(block)
    if (install?.[1]) {
      found.push(install[1].trim())
      continue
    }
    // DisplayIcon points AT the executable rather than at its directory, and it
    // may carry a `,0` icon index. Second choice, because InstallLocation is the
    // value the installer is meant to write.
    const icon = /DisplayIcon\s+REG_SZ\s+(.+?)\s*$/im.exec(block)
    if (icon?.[1]) found.push(icon[1].replace(/,\d+\s*$/, '').trim())
  }
  return found
}

/** Windows: the per-user and machine uninstall registrations, both views. */
async function discoverWindows(probe, id) {
  const roots = [
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    // The 32-bit view on a 64-bit machine. A per-user install lands in the first
    // root; this one is why the list is not just HKLM.
    'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
  ]
  // Per-user first: if a machine-wide and a per-user install both survive
  // validation, the user's own is the one they are more likely to have meant.
  for (const root of roots) {
    const out = await probe.runCommand('reg', ['query', root, '/s'])
    if (!out) continue
    for (const location of parseInstallLocations(out, PRODUCT_NAME[id])) {
      // The value may be the directory or the executable itself.
      if (location.toLowerCase().endsWith('.exe')) {
        if (await probe.exists(location)) return location
        continue
      }
      const hit = await findIn(probe, location, candidatesFor(id, 'win32'))
      if (hit) return hit
    }
  }
  return null
}

/** macOS: the conventional Applications locations. */
async function discoverDarwin(probe, id) {
  const home = probe.env.HOME ?? ''
  const dirs = ['/Applications', home ? join(home, 'Applications') : null].filter(Boolean)
  for (const dir of dirs) {
    const hit = await findIn(probe, dir, candidatesFor(id, 'darwin'))
    if (hit) return hit
  }
  return null
}

/**
 * Linux: an installed `.desktop` entry, launched through the desktop environment.
 * Absence is normal for a standalone AppImage and is not an error — resolution
 * simply moves on.
 */
async function discoverLinux(probe, id) {
  const home = probe.env.HOME ?? ''
  const xdg = probe.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share'
  const dirs = [
    ...(home ? [join(home, '.local', 'share', 'applications')] : []),
    ...xdg
      .split(':')
      .filter(Boolean)
      .map((d) => join(d, 'applications'))
  ]
  const names = [`${id}.desktop`, `${PRODUCT_NAME[id]}.desktop`]
  for (const dir of dirs) {
    const hit = await findIn(probe, dir, names)
    if (hit) return hit
  }
  return null
}

/**
 * Resolve the companion by identity.
 *
 * Precedence, and the ordering is the contract:
 *
 * 1. **Explicit override** the user deliberately chose. A stale one does not fail
 *    the whole resolution — it is reported and discovery continues, because a
 *    moved install should not leave the button dead with no explanation.
 * 2. **Colocated sibling**, beside the launcher directory rather than beside
 *    `execPath` — see `launcherDir`.
 * 3. **Platform installation registration.** The OS's own record, never a scan of
 *    the disk and never `PATH`.
 * 4. **Nothing**, which is a state rather than an error: the caller offers a
 *    picker.
 *
 * @returns {Promise<{ resolved: { target: string, kind: CompanionKind, source: CompanionSource } | null, staleOverride: boolean }>}
 */
export async function resolveCompanion(probe, id, override) {
  let staleOverride = false
  if (override) {
    if (await probe.exists(override)) {
      return {
        resolved: { target: override, kind: kindOf(override), source: 'manual' },
        staleOverride: false
      }
    }
    staleOverride = true
  }

  const sibling = await findIn(probe, launcherDir(probe), candidatesFor(id, probe.platform))
  if (sibling) {
    return {
      resolved: { target: sibling, kind: kindOf(sibling), source: 'sibling' },
      staleOverride
    }
  }

  const installed =
    probe.platform === 'win32'
      ? await discoverWindows(probe, id)
      : probe.platform === 'darwin'
        ? await discoverDarwin(probe, id)
        : await discoverLinux(probe, id)
  if (installed) {
    return {
      resolved: { target: installed, kind: kindOf(installed), source: 'installed' },
      staleOverride
    }
  }

  return { resolved: null, staleOverride }
}

/**
 * Resolve, check, then launch.
 *
 * The check is not ceremony: discovery reads registry values, desktop entries and
 * settings, all of which are **untrusted until checked**. A target that vanished
 * between resolution and launch, or that is not executable, produces a named
 * reason rather than a bare failure.
 *
 * @returns {Promise<{ ok: true, source: CompanionSource, target: string } | { ok: false, reason: CompanionFailure, target?: string, message?: string }>}
 */
export async function launchCompanion(probe, id, override) {
  const { resolved, staleOverride } = await resolveCompanion(probe, id, override)
  if (!resolved) {
    return { ok: false, reason: staleOverride ? 'stale-override' : 'not-found' }
  }
  // A `.app` is a directory and a `.desktop` is a text file; neither is executable
  // and neither is run directly, so the bit is only meaningful for a binary.
  if (resolved.kind === 'binary' && !(await probe.isExecutable(resolved.target))) {
    return { ok: false, reason: 'not-executable', target: resolved.target }
  }
  try {
    await probe.launch(resolved.kind, resolved.target)
    return { ok: true, source: resolved.source, target: resolved.target }
  } catch (err) {
    return {
      ok: false,
      reason: 'launch-failed',
      target: resolved.target,
      message: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * File filters for the "Change Path" picker, so a `.app` bundle or an AppImage can
 * actually be selected. The old picker filtered for `exe` on every platform, which
 * is why the setting could not be populated off Windows.
 */
export function pickerFilters(platform) {
  if (platform === 'win32') {
    return [
      { name: 'Executable', extensions: ['exe'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }
  if (platform === 'darwin') {
    return [
      { name: 'Application', extensions: ['app'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }
  return [
    { name: 'Application', extensions: ['AppImage', 'appimage', 'desktop'] },
    { name: 'All Files', extensions: ['*'] }
  ]
}

/** The real probe. Everything platform-specific is in here and nowhere else. */
export function nodeProbe() {
  return {
    platform: process.platform,
    execPath: process.execPath,
    env: process.env,
    exists: async (p) => {
      try {
        await fs.stat(p)
        return true
      } catch {
        return false
      }
    },
    isExecutable: async (p) => {
      // Windows has no execute bit; reaching the file is the whole check there.
      const mode = process.platform === 'win32' ? fsConstants.F_OK : fsConstants.X_OK
      try {
        await fs.access(p, mode)
        return true
      } catch {
        return false
      }
    },
    readdir: (dir) => fs.readdir(dir),
    runCommand: async (file, args) => {
      try {
        // `shell: false` is execFile's default and is the point of using it:
        // nothing here is ever handed to a command interpreter.
        const { stdout } = await execFileAsync(file, args, { maxBuffer: 8 * 1024 * 1024 })
        return stdout
      } catch {
        return null
      }
    },
    launch: async (kind, target) => {
      if (kind === 'appBundle') {
        // `open -a` activates an already-running instance rather than starting a
        // second copy, which is the behaviour the card asks for and which a direct
        // spawn of Contents/MacOS/* would lose.
        await execFileAsync('open', ['-a', target])
        return
      }
      if (kind === 'desktopEntry') {
        // Through the desktop environment, so the entry's own Exec line, working
        // directory and StartupWMClass apply.
        try {
          await execFileAsync('gio', ['launch', target])
        } catch {
          await execFileAsync('gtk-launch', [basename(target, '.desktop')])
        }
        return
      }
      // Detached with stdio ignored so the companion outlives this process, and as
      // an argument array with no shell.
      spawn(target, [], { detached: true, stdio: 'ignore', shell: false }).unref()
    }
  }
}
