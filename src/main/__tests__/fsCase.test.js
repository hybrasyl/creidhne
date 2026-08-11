import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

// HTOO-287. `readdir` is stubbed rather than run against a real directory, and
// that is the only way these tests can mean anything: **every case below is the
// case-SENSITIVE filesystem**, which is Linux and macOS. On the real Windows
// filesystem `readdir` reports the true casing but `access` and `readFile` fold
// it, so a Windows run passes with or without the code under test. A stub is what
// makes the assertions platform-independent.
const mockFs = { readdir: vi.fn() }
vi.mock('fs', () => ({ promises: mockFs }))

const { matchNameIgnoringCase, resolveClientPath } = await import('../fsCase.js')

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── matchNameIgnoringCase ───────────────────────────────────────────────────

describe('matchNameIgnoringCase', () => {
  it('finds a name whatever its casing', () => {
    expect(matchNameIgnoringCase(['Legend.dat'], 'legend.dat')).toBe('Legend.dat')
    expect(matchNameIgnoringCase(['LEGEND.DAT'], 'legend.dat')).toBe('LEGEND.DAT')
    expect(matchNameIgnoringCase(['legend.dat'], 'legend.dat')).toBe('legend.dat')
  })

  it('prefers an exact match over a case-folded one', () => {
    // Both spellings can exist side by side on a case-sensitive filesystem, and
    // the order `readdir` returns them in is not something to depend on. Asking
    // for `legend.dat` must get `legend.dat`.
    expect(matchNameIgnoringCase(['Legend.dat', 'legend.dat'], 'legend.dat')).toBe('legend.dat')
    expect(matchNameIgnoringCase(['legend.dat', 'Legend.dat'], 'Legend.dat')).toBe('Legend.dat')
  })

  it('returns null rather than a near miss', () => {
    expect(matchNameIgnoringCase(['khanpal.dat'], 'legend.dat')).toBeNull()
    expect(matchNameIgnoringCase(['legend.data'], 'legend.dat')).toBeNull()
    expect(matchNameIgnoringCase([], 'legend.dat')).toBeNull()
  })
})

// ─── resolveClientPath ───────────────────────────────────────────────────────

describe('resolveClientPath', () => {
  it("resolves the installer's mixed-case name", async () => {
    // The measured case. A stock 7.41 install writes `Legend.dat` capitalised
    // while `khanpal.dat`, `national.dat`, `misc.dat`, `roh.dat` and `setoa.dat`
    // are lowercase, so no single spelling rule covers the directory.
    mockFs.readdir.mockResolvedValue(['Legend.dat', 'khanpal.dat', 'hades.dat'])
    expect(await resolveClientPath('/client', 'legend.dat')).toBe(join('/client', 'Legend.dat'))
  })

  it('leaves an already-correct name alone', async () => {
    mockFs.readdir.mockResolvedValue(['Legend.dat', 'khanpal.dat'])
    expect(await resolveClientPath('/client', 'khanpal.dat')).toBe(join('/client', 'khanpal.dat'))
  })

  it('resolves the directory as well as the file inside it', async () => {
    // Creidhne's one nested archive, `npc/npcbase.dat`. This is the difference
    // from Taliesin's resolver, whose callers pass bare names: a client that
    // capitalises `Legend.dat` can capitalise `NPC` too, so a resolver that only
    // fixed the last segment would still fail here.
    mockFs.readdir.mockImplementation((dir) =>
      dir === '/client'
        ? Promise.resolve(['NPC', 'Legend.dat'])
        : Promise.resolve(['NpcBase.dat', 'npc.dat'])
    )
    expect(await resolveClientPath('/client', 'npc/npcbase.dat')).toBe(
      join('/client', 'NPC', 'NpcBase.dat')
    )
  })

  it('accepts either separator in the relative name', async () => {
    mockFs.readdir.mockImplementation((dir) =>
      dir === '/client' ? Promise.resolve(['npc']) : Promise.resolve(['NpcBase.dat'])
    )
    expect(await resolveClientPath('/client', 'npc\\npcbase.dat')).toBe(
      join('/client', 'npc', 'NpcBase.dat')
    )
  })

  it('falls back to the requested name when the directory holds no match', async () => {
    // A resolution step, not an existence check. The caller's own error handling
    // still runs, and its message still names the file the caller asked for
    // rather than one this function invented.
    mockFs.readdir.mockResolvedValue(['khanpal.dat'])
    expect(await resolveClientPath('/client', 'legend.dat')).toBe(join('/client', 'legend.dat'))
  })

  it('falls back when the directory cannot be read at all', async () => {
    mockFs.readdir.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
    expect(await resolveClientPath('/nowhere', 'legend.dat')).toBe(join('/nowhere', 'legend.dat'))
  })

  it('falls back segment by segment, so one unreadable level does not lose the rest', async () => {
    // The root resolves, the subdirectory cannot be listed. The remaining segment
    // keeps its requested spelling instead of being dropped.
    mockFs.readdir.mockImplementation((dir) =>
      dir === '/client'
        ? Promise.resolve(['NPC'])
        : Promise.reject(Object.assign(new Error('EACCES'), { code: 'EACCES' }))
    )
    expect(await resolveClientPath('/client', 'npc/npcbase.dat')).toBe(
      join('/client', 'NPC', 'npcbase.dat')
    )
  })

  it('returns the root unchanged for an empty relative name', async () => {
    expect(await resolveClientPath('/client', '')).toBe('/client')
    expect(mockFs.readdir).not.toHaveBeenCalled()
  })
})
