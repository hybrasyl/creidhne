import { describe, it, expect, vi, beforeEach } from 'vitest'

// DataArchive.fromBuffer is called by loadArchive; stub the native parser.
const mockFromBuffer = vi.fn()
vi.mock('@eriscorp/dalib-ts', () => ({
  DataArchive: { fromBuffer: (...a) => mockFromBuffer(...a) }
}))

import {
  joinPath,
  readClientFile,
  loadArchive,
  clearArchiveCache,
  registerCacheClearer,
  clearAllClientCaches
} from '../utils/daClient'

beforeEach(() => {
  vi.clearAllMocks()
  clearArchiveCache()
  globalThis.window = globalThis.window || {}
})

// joinPath builds cache keys, not paths to read with. HTOO-287 moved the read
// itself onto `readClientFile(clientPath, rel)`, so main can resolve the on-disk
// casing; the key stays built from the lowercase literal so one archive keeps one
// cache entry whatever the install capitalises it as.
describe('joinPath', () => {
  it('joins with a backslash when clientPath uses backslashes', () => {
    expect(joinPath('C:\\DA', 'legend.dat')).toBe('C:\\DA\\legend.dat')
  })

  it('joins with a forward slash otherwise', () => {
    expect(joinPath('/opt/da', 'npc/npc.dat')).toBe('/opt/da/npc/npc.dat')
  })

  it('normalizes mixed separators in the relative part to the clientPath style', () => {
    expect(joinPath('C:\\DA', 'npc/npc.dat')).toBe('C:\\DA\\npc\\npc.dat')
  })

  it('trims trailing separators on clientPath', () => {
    expect(joinPath('/opt/da/', 'a.dat')).toBe('/opt/da/a.dat')
    expect(joinPath('C:\\DA\\\\', 'a.dat')).toBe('C:\\DA\\a.dat')
  })
})

describe('readClientFile', () => {
  it('throws when clientPath is missing', async () => {
    await expect(readClientFile('', 'a.dat')).rejects.toThrow('client path')
  })

  it('wraps the IPC buffer as a Uint8Array over the same bytes', async () => {
    const buf = Buffer.from([1, 2, 3])
    window.electronAPI = { readClientFile: vi.fn().mockResolvedValue(buf) }
    const out = await readClientFile('/da', 'a.dat')
    expect(out).toBeInstanceOf(Uint8Array)
    expect(Array.from(out)).toEqual([1, 2, 3])
  })

  it('passes the root and the relative name separately, not a joined path', async () => {
    // The whole of HTOO-287's renderer half. A joined path cannot be
    // case-resolved, because only main can read the directory — so a renderer
    // that hands over `/da/legend.dat` has already lost the information main
    // needs. Sending the two halves is what keeps the resolution possible.
    window.electronAPI = { readClientFile: vi.fn().mockResolvedValue(Buffer.from([0])) }
    await readClientFile('/da', 'npc/npcbase.dat')
    expect(window.electronAPI.readClientFile).toHaveBeenCalledWith('/da', 'npc/npcbase.dat')
  })
})

describe('loadArchive', () => {
  it('throws when clientPath is missing', async () => {
    await expect(loadArchive('', 'legend.dat')).rejects.toThrow('client path')
  })

  it('parses once and returns the cached instance by full path', async () => {
    window.electronAPI = { readClientFile: vi.fn().mockResolvedValue(Buffer.from([9])) }
    const archive = { id: 'A' }
    mockFromBuffer.mockReturnValue(archive)

    const a = await loadArchive('/da', 'legend.dat')
    const b = await loadArchive('/da', 'legend.dat')
    expect(a).toBe(archive)
    expect(b).toBe(archive)
    expect(mockFromBuffer).toHaveBeenCalledTimes(1)
    expect(window.electronAPI.readClientFile).toHaveBeenCalledTimes(1)
  })

  it('re-parses after clearArchiveCache', async () => {
    window.electronAPI = { readClientFile: vi.fn().mockResolvedValue(Buffer.from([1])) }
    mockFromBuffer.mockReturnValue({})
    await loadArchive('/da', 'x.dat')
    clearArchiveCache()
    await loadArchive('/da', 'x.dat')
    expect(mockFromBuffer).toHaveBeenCalledTimes(2)
  })
})

describe('cache clearer registry', () => {
  it('invokes registered clearers on clearAllClientCaches; unregister removes one', () => {
    const a = vi.fn()
    const b = vi.fn()
    const unregA = registerCacheClearer(a)
    const unregB = registerCacheClearer(b)

    clearAllClientCaches()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)

    unregA()
    clearAllClientCaches()
    expect(a).toHaveBeenCalledTimes(1) // no longer registered
    expect(b).toHaveBeenCalledTimes(2)

    unregB()
  })

  it('keeps flushing other clearers when one throws', () => {
    const bad = vi.fn(() => {
      throw new Error('boom')
    })
    const good = vi.fn()
    const unregBad = registerCacheClearer(bad)
    const unregGood = registerCacheClearer(good)

    expect(() => clearAllClientCaches()).not.toThrow()
    expect(good).toHaveBeenCalledTimes(1)

    unregBad()
    unregGood()
  })
})
