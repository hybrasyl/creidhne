import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFs = { readdir: vi.fn() }
const mockUnzipper = { Open: { file: vi.fn() } }

vi.mock('fs', () => ({ promises: mockFs }))
vi.mock('unzipper', () => ({ default: mockUnzipper }))

const {
  loadPacksForClientPath,
  listActivePacks,
  listCoveredIds,
  resolveAsset,
  _resetForTests
} = await import('../assetPackLoader.js')

// Build a fake unzipper directory object. Entries are filename → buffer.
// `manifest` is stringified+encoded into _manifest.json unless `omitManifest` is set.
function fakeDirectory({ manifest, entries = {}, omitManifest = false } = {}) {
  const files = []
  if (!omitManifest) {
    files.push({
      path: '_manifest.json',
      type: 'File',
      buffer: () => Promise.resolve(Buffer.from(JSON.stringify(manifest)))
    })
  }
  for (const [name, bytes] of Object.entries(entries)) {
    files.push({
      path: name,
      type: 'File',
      buffer: () => Promise.resolve(bytes)
    })
  }
  return { files }
}

// Minimal manifest helper. Defaults are intentionally valid so tests can focus
// on the one field they're exercising.
function manifest(overrides = {}) {
  return {
    schema_version: 1,
    pack_id: 'test-pack',
    pack_version: '0.1.0',
    content_type: 'ability_icons',
    priority: 100,
    covers: { skill_icons: { dimensions: [32, 32] } },
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  _resetForTests()
})

describe('loadPacksForClientPath: happy path', () => {
  it('loads a single pack and indexes entries by subtype + id', async () => {
    mockFs.readdir.mockResolvedValueOnce(['hybicons.datf'])
    mockUnzipper.Open.file.mockResolvedValueOnce(
      fakeDirectory({
        manifest: manifest(),
        entries: {
          'skill0001.png': Buffer.from('fake-skill-1'),
          'skill0042.png': Buffer.from('fake-skill-42'),
          'spell0007.png': Buffer.from('fake-spell-7')
        }
      })
    )

    await loadPacksForClientPath('/fake/client')

    expect(await listActivePacks()).toHaveLength(1)
    expect(await listCoveredIds('skill')).toEqual([1, 42])
    expect(await listCoveredIds('spell')).toEqual([7])

    const skill42 = await resolveAsset('skill', 42)
    expect(skill42?.toString()).toBe('fake-skill-42')
  })

  it('returns null for ids no pack covers', async () => {
    mockFs.readdir.mockResolvedValueOnce(['hybicons.datf'])
    mockUnzipper.Open.file.mockResolvedValueOnce(
      fakeDirectory({
        manifest: manifest(),
        entries: { 'skill0001.png': Buffer.from('x') }
      })
    )
    await loadPacksForClientPath('/fake/client')

    expect(await resolveAsset('skill', 999)).toBeNull()
    expect(await resolveAsset('nation', 1)).toBeNull()
  })

  it('ignores non-matching filenames (no ID prefix)', async () => {
    mockFs.readdir.mockResolvedValueOnce(['weird.datf'])
    mockUnzipper.Open.file.mockResolvedValueOnce(
      fakeDirectory({
        manifest: manifest(),
        entries: {
          'skill0001.png': Buffer.from('ok'),
          'README.txt': Buffer.from('docs'),
          'notes.png': Buffer.from('no-id')
        }
      })
    )
    await loadPacksForClientPath('/fake/client')

    expect(await listCoveredIds('skill')).toEqual([1])
    // No phantom subtypes registered
    expect(await listCoveredIds('readme')).toEqual([])
    expect(await listCoveredIds('notes')).toEqual([])
  })
})

describe('loadPacksForClientPath: bad inputs', () => {
  it('is a no-op when clientPath is null', async () => {
    await loadPacksForClientPath(null)
    expect(await listActivePacks()).toEqual([])
    expect(mockFs.readdir).not.toHaveBeenCalled()
  })

  it('silently skips a pack with no manifest', async () => {
    mockFs.readdir.mockResolvedValueOnce(['broken.datf'])
    mockUnzipper.Open.file.mockResolvedValueOnce(
      fakeDirectory({ omitManifest: true, entries: { 'skill0001.png': Buffer.from('x') } })
    )
    await loadPacksForClientPath('/fake/client')
    expect(await listActivePacks()).toHaveLength(0)
  })

  it('silently skips a pack with malformed manifest JSON', async () => {
    mockFs.readdir.mockResolvedValueOnce(['malformed.datf'])
    mockUnzipper.Open.file.mockResolvedValueOnce({
      files: [
        {
          path: '_manifest.json',
          type: 'File',
          buffer: () => Promise.resolve(Buffer.from('{ this is not json'))
        }
      ]
    })
    await loadPacksForClientPath('/fake/client')
    expect(await listActivePacks()).toHaveLength(0)
  })

  it('skips packs with unknown schema_version', async () => {
    mockFs.readdir.mockResolvedValueOnce(['futuristic.datf'])
    mockUnzipper.Open.file.mockResolvedValueOnce(
      fakeDirectory({ manifest: manifest({ schema_version: 99 }) })
    )
    await loadPacksForClientPath('/fake/client')
    expect(await listActivePacks()).toHaveLength(0)
  })

  it('skips packs whose ZIP cannot be opened', async () => {
    mockFs.readdir.mockResolvedValueOnce(['corrupt.datf'])
    mockUnzipper.Open.file.mockRejectedValueOnce(new Error('bad zip'))
    await loadPacksForClientPath('/fake/client')
    expect(await listActivePacks()).toHaveLength(0)
  })

  it('returns empty when the client directory cannot be read', async () => {
    mockFs.readdir.mockRejectedValueOnce(new Error('ENOENT'))
    await loadPacksForClientPath('/missing/path')
    expect(await listActivePacks()).toEqual([])
  })
})

describe('priority ordering', () => {
  it('resolveAsset prefers higher-priority pack when multiple cover the same id', async () => {
    mockFs.readdir.mockResolvedValueOnce(['low.datf', 'high.datf'])
    mockUnzipper.Open.file
      .mockResolvedValueOnce(
        fakeDirectory({
          manifest: manifest({ pack_id: 'low', priority: 10 }),
          entries: { 'skill0001.png': Buffer.from('LOW') }
        })
      )
      .mockResolvedValueOnce(
        fakeDirectory({
          manifest: manifest({ pack_id: 'high', priority: 200 }),
          entries: { 'skill0001.png': Buffer.from('HIGH') }
        })
      )

    await loadPacksForClientPath('/fake/client')

    const buf = await resolveAsset('skill', 1)
    expect(buf?.toString()).toBe('HIGH')
  })

  it('listCoveredIds returns the sorted union across packs', async () => {
    mockFs.readdir.mockResolvedValueOnce(['a.datf', 'b.datf'])
    mockUnzipper.Open.file
      .mockResolvedValueOnce(
        fakeDirectory({
          manifest: manifest({ pack_id: 'a', priority: 50 }),
          entries: { 'skill0001.png': Buffer.from('x'), 'skill0003.png': Buffer.from('x') }
        })
      )
      .mockResolvedValueOnce(
        fakeDirectory({
          manifest: manifest({ pack_id: 'b', priority: 100 }),
          entries: { 'skill0002.png': Buffer.from('x'), 'skill0003.png': Buffer.from('x') }
        })
      )

    await loadPacksForClientPath('/fake/client')
    expect(await listCoveredIds('skill')).toEqual([1, 2, 3])
  })
})

describe('file-extension filtering', () => {
  it('only scans *.datf files in the client directory', async () => {
    mockFs.readdir.mockResolvedValueOnce([
      'hybicons.datf',
      'legend.dat', // not .datf
      'readme.txt',
      'hybnations.DATF' // case-insensitive
    ])
    mockUnzipper.Open.file
      .mockResolvedValueOnce(
        fakeDirectory({
          manifest: manifest({ pack_id: 'icons' }),
          entries: { 'skill0001.png': Buffer.from('x') }
        })
      )
      .mockResolvedValueOnce(
        fakeDirectory({
          manifest: manifest({ pack_id: 'nations', covers: { nation_badges: {} } }),
          entries: { 'nation0001.png': Buffer.from('x') }
        })
      )

    await loadPacksForClientPath('/fake/client')
    expect(mockUnzipper.Open.file).toHaveBeenCalledTimes(2)
    expect((await listActivePacks()).map((p) => p.manifest.pack_id).sort()).toEqual([
      'icons',
      'nations'
    ])
  })
})
