import { describe, it, expect, vi } from 'vitest'
import { join } from 'path'
import {
  resolveCompanion,
  launchCompanion,
  launcherDir,
  parseInstallLocations,
  pickerFilters
} from '../companion.js'

/**
 * HTOO-292. Every platform probe is injected, which is the point of the module's
 * shape: registry queries, Applications scans and `.desktop` lookups cannot run in
 * a suite, and a resolver whose precedence is only exercised on the author's own
 * machine has exactly one tested path.
 *
 * The card asks for coverage of precedence and of stale or hostile candidates
 * without touching the real registry, Launch Services or desktop database.
 *
 * Ported from Taliesin's `companion.test.ts` with the two roles swapped. Creidhne
 * looks for Taliesin; Taliesin looks for Creidhne.
 */
// Paths are built with `path.join`, so expectations use it too: this suite runs on
// whatever the developer or the runner is, while the code under test always runs on
// the platform whose separators it is producing.
function makeProbe(over = {}) {
  return {
    platform: 'win32',
    execPath: join('C:', 'Program Files', 'Creidhne', 'creidhne.exe'),
    env: {},
    exists: async () => false,
    isExecutable: async () => true,
    readdir: async () => [],
    runCommand: async () => null,
    launch: vi.fn(async () => undefined),
    ...over
  }
}

// ─── launcherDir ─────────────────────────────────────────────────────────────

describe('launcherDir', () => {
  it('uses the portable launcher directory, not the extraction directory', () => {
    // The trap this card names explicitly, and Creidhne ships portable-only on
    // Windows so it is the normal path here rather than the exception.
    // electron-builder's portable target self-extracts to %TEMP%, so execPath
    // points somewhere Taliesin will never be — a sibling search there finds
    // nothing, forever and silently.
    const probe = makeProbe({
      execPath: 'C:\\Users\\a\\AppData\\Local\\Temp\\2H8x\\creidhne.exe',
      env: { PORTABLE_EXECUTABLE_DIR: 'D:\\tools' }
    })
    expect(launcherDir(probe)).toBe('D:\\tools')
  })

  it('falls back to the real executable directory for installed builds', () => {
    expect(launcherDir(makeProbe())).toBe(join('C:', 'Program Files', 'Creidhne'))
  })

  it('ignores the portable variable off Windows', () => {
    // It is an electron-builder Windows signal. Honouring it elsewhere would trust
    // an environment variable anyone can set, on a platform that never sets it.
    const probe = makeProbe({
      platform: 'linux',
      execPath: '/opt/creidhne/creidhne',
      env: { PORTABLE_EXECUTABLE_DIR: '/tmp/attacker' }
    })
    expect(launcherDir(probe)).toBe('/opt/creidhne')
  })
})

// ─── resolution precedence ───────────────────────────────────────────────────

describe('resolution precedence', () => {
  it('prefers an override that still exists', async () => {
    const probe = makeProbe({
      exists: async (p) => p === 'D:\\custom\\taliesin.exe',
      readdir: async () => ['taliesin.exe']
    })
    const status = await resolveCompanion(probe, 'taliesin', 'D:\\custom\\taliesin.exe')
    expect(status.resolved).toEqual({
      target: 'D:\\custom\\taliesin.exe',
      kind: 'binary',
      source: 'manual'
    })
    expect(status.staleOverride).toBe(false)
  })

  it('degrades a stale override into discovery, and says so', async () => {
    // The card's rule: report that the override needs attention rather than
    // failing silently. A moved install must not leave the button dead with no
    // explanation. Creidhne's old module returned a bare `false` here.
    const probe = makeProbe({ readdir: async () => ['creidhne.exe', 'taliesin.exe'] })
    const status = await resolveCompanion(probe, 'taliesin', 'D:\\gone\\taliesin.exe')
    expect(status.staleOverride).toBe(true)
    expect(status.resolved?.source).toBe('sibling')
  })

  it('finds a colocated sibling whatever its casing', async () => {
    // Ties to HTOO-287: the installer's casing is not ours to predict, and a
    // case-sensitive filesystem is where a literal match silently fails.
    const probe = makeProbe({
      platform: 'linux',
      execPath: '/opt/creidhne/creidhne',
      readdir: async () => ['Taliesin.AppImage']
    })
    const status = await resolveCompanion(probe, 'taliesin', null)
    expect(status.resolved).toEqual({
      target: join('/opt/creidhne', 'Taliesin.AppImage'),
      kind: 'binary',
      source: 'sibling'
    })
  })

  it('falls through to installation registration when nothing is colocated', async () => {
    const probe = makeProbe({
      readdir: async (dir) => (dir === 'C:\\Program Files\\Taliesin' ? ['Taliesin.exe'] : []),
      exists: async () => false,
      runCommand: async (file, args) =>
        file === 'reg' && args[1].startsWith('HKCU')
          ? 'HKEY_CURRENT_USER\\...\\Taliesin\r\n    DisplayName    REG_SZ    Taliesin\r\n    InstallLocation    REG_SZ    C:\\Program Files\\Taliesin\r\n'
          : null
    })
    const status = await resolveCompanion(probe, 'taliesin', null)
    expect(status.resolved).toEqual({
      target: join('C:\\Program Files\\Taliesin', 'Taliesin.exe'),
      kind: 'binary',
      source: 'installed'
    })
  })

  it('reports not-found as a state rather than an error', async () => {
    // Step 4 of the contract: the caller offers a picker. Nothing throws.
    const status = await resolveCompanion(makeProbe(), 'taliesin', null)
    expect(status).toEqual({ resolved: null, staleOverride: false })
  })

  it('recognises a macOS bundle as a bundle, not a binary', async () => {
    // A `.app` is a DIRECTORY. Spawning it, or spawning Contents/MacOS/*, is what
    // loses activation of an already-running instance.
    const probe = makeProbe({
      platform: 'darwin',
      execPath: '/Applications/Creidhne.app/Contents/MacOS/Creidhne',
      env: { HOME: '/Users/a' },
      readdir: async (dir) => (dir === '/Applications' ? ['Taliesin.app'] : [])
    })
    const status = await resolveCompanion(probe, 'taliesin', null)
    expect(status.resolved).toEqual({
      target: join('/Applications', 'Taliesin.app'),
      kind: 'appBundle',
      source: 'installed'
    })
  })

  it('resolves a Linux desktop entry from the XDG search path', async () => {
    const probe = makeProbe({
      platform: 'linux',
      execPath: '/opt/creidhne/creidhne',
      env: { HOME: '/home/a', XDG_DATA_DIRS: '/usr/share' },
      // join() again: the XDG directories are built with it, so the mock has to
      // compare the same way to run on a Windows developer machine.
      readdir: async (dir) =>
        dir === join('/usr/share', 'applications') ? ['taliesin.desktop'] : []
    })
    const status = await resolveCompanion(probe, 'taliesin', null)
    expect(status.resolved).toEqual({
      target: join('/usr/share/applications', 'taliesin.desktop'),
      kind: 'desktopEntry',
      source: 'installed'
    })
  })
})

// ─── parseInstallLocations ───────────────────────────────────────────────────

describe('parseInstallLocations', () => {
  const BLOCK = [
    'HKEY_CURRENT_USER\\Software\\...\\Uninstall\\Notepad++',
    '    DisplayName    REG_SZ    Notepad++',
    '    InstallLocation    REG_SZ    C:\\Program Files\\Notepad++',
    '',
    'HKEY_CURRENT_USER\\Software\\...\\Uninstall\\co.eris.taliesin',
    '    DisplayName    REG_SZ    Taliesin',
    '    InstallLocation    REG_SZ    C:\\Users\\a b\\AppData\\Local\\Programs\\Taliesin',
    ''
  ].join('\r\n')

  it('takes only the block whose DisplayName matches, spaces and all', () => {
    // An uninstall subtree holds hundreds of unrelated blocks, and install paths
    // routinely contain spaces — the user's own name is in this one.
    expect(parseInstallLocations(BLOCK, 'Taliesin')).toEqual([
      'C:\\Users\\a b\\AppData\\Local\\Programs\\Taliesin'
    ])
  })

  it('does not match a product whose name merely CONTAINS the one asked for', () => {
    // `Taliesin Helper` is not Taliesin. Registry values are untrusted input, and a
    // loose match here would hand an arbitrary install path to the launcher.
    const other =
      'HKEY...\\x\r\n    DisplayName    REG_SZ    Taliesin Helper\r\n    InstallLocation    REG_SZ    C:\\evil\r\n'
    expect(parseInstallLocations(other, 'Taliesin')).toEqual([])
  })

  it('falls back to DisplayIcon and strips its icon index', () => {
    const icon =
      'HKEY...\\c\r\n    DisplayName    REG_SZ    Taliesin\r\n    DisplayIcon    REG_SZ    C:\\Apps\\Taliesin\\taliesin.exe,0\r\n'
    expect(parseInstallLocations(icon, 'Taliesin')).toEqual(['C:\\Apps\\Taliesin\\taliesin.exe'])
  })
})

// ─── launchCompanion ─────────────────────────────────────────────────────────

describe('launchCompanion', () => {
  it('launches what was resolved and reports the source', async () => {
    const launch = vi.fn(async () => undefined)
    const probe = makeProbe({ readdir: async () => ['taliesin.exe'], launch })
    await expect(launchCompanion(probe, 'taliesin', null)).resolves.toEqual({
      ok: true,
      source: 'sibling',
      target: join('C:', 'Program Files', 'Creidhne', 'taliesin.exe')
    })
    expect(launch).toHaveBeenCalledWith(
      'binary',
      join('C:', 'Program Files', 'Creidhne', 'taliesin.exe')
    )
  })

  it('names a stale override rather than collapsing it to "not found"', async () => {
    // Different sentence, different fix: one asks the user to re-select, the other
    // tells them nothing is installed. The old module returned `false` for both.
    await expect(launchCompanion(makeProbe(), 'taliesin', 'D:\\gone.exe')).resolves.toEqual({
      ok: false,
      reason: 'stale-override'
    })
  })

  it('names a found-but-not-executable target', async () => {
    const probe = makeProbe({
      platform: 'linux',
      execPath: '/opt/creidhne/creidhne',
      readdir: async () => ['taliesin'],
      isExecutable: async () => false
    })
    await expect(launchCompanion(probe, 'taliesin', null)).resolves.toEqual({
      ok: false,
      reason: 'not-executable',
      target: join('/opt/creidhne', 'taliesin')
    })
  })

  it('does not ask for an execute bit on a bundle or a desktop entry', async () => {
    // Neither is executable and neither is run directly, so the check would be a
    // false negative on both of the non-Windows platforms.
    const isExecutable = vi.fn(async () => false)
    const probe = makeProbe({
      platform: 'darwin',
      execPath: '/Applications/Creidhne.app/Contents/MacOS/Creidhne',
      env: { HOME: '/Users/a' },
      readdir: async (dir) => (dir === '/Applications' ? ['Taliesin.app'] : []),
      isExecutable
    })
    const result = await launchCompanion(probe, 'taliesin', null)
    expect(result.ok).toBe(true)
    expect(isExecutable).not.toHaveBeenCalled()
  })

  it('reports an OS launch failure with its message', async () => {
    const probe = makeProbe({
      readdir: async () => ['taliesin.exe'],
      launch: async () => {
        throw new Error('EACCES')
      }
    })
    const result = await launchCompanion(probe, 'taliesin', null)
    expect(result).toMatchObject({ ok: false, reason: 'launch-failed', message: 'EACCES' })
  })

  it('still refuses a path the user never chose', async () => {
    // What the old allowlist was for, and it survives: an override is honoured only
    // because the user stored it in Settings, and the renderer no longer supplies a
    // path at all. Nothing outside the override or discovery can become a target.
    const launch = vi.fn(async () => undefined)
    const probe = makeProbe({
      exists: async (p) => p === 'D:\\Downloads\\malware.exe',
      launch
    })
    // Discovery finds nothing, and the attacker's path is not the override.
    await expect(launchCompanion(probe, 'taliesin', null)).resolves.toEqual({
      ok: false,
      reason: 'not-found'
    })
    expect(launch).not.toHaveBeenCalled()
  })
})

// ─── pickerFilters ───────────────────────────────────────────────────────────

describe('pickerFilters', () => {
  it('offers each platform something it can actually select', () => {
    // The old picker filtered for `exe` everywhere, which is why the setting could
    // not be POPULATED on macOS or Linux — a `.app` is a directory and an AppImage
    // has no `.exe` in sight.
    expect(pickerFilters('win32')[0].extensions).toContain('exe')
    expect(pickerFilters('darwin')[0].extensions).toContain('app')
    expect(pickerFilters('linux')[0].extensions).toContain('AppImage')
  })

  it('keeps an all-files escape hatch on every platform', () => {
    // A Linux install can be a bare binary with no extension at all, and an
    // unusual install is the only reason to reach this picker.
    for (const p of ['win32', 'darwin', 'linux']) {
      expect(pickerFilters(p).at(-1).extensions).toEqual(['*'])
    }
  })
})
