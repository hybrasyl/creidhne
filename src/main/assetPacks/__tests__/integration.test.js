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
} = await import('../index.js')

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

describe('content_type dispatch', () => {
  it('loads a nation_badges pack and indexes under subtype "nation"', async () => {
    mockFs.readdir.mockResolvedValueOnce(['hybnations.datf'])
    mockUnzipper.Open.file.mockResolvedValueOnce(
      fakeDirectory({
        manifest: manifest({
          pack_id: 'nations',
          content_type: 'nation_badges',
          covers: { nation_badges: {} }
        }),
        entries: {
          'nation0001.png': Buffer.from('flag-1'),
          'nation0042.png': Buffer.from('flag-42')
        }
      })
    )

    await loadPacksForClientPath('/fake/client')
    expect(await listCoveredIds('nation')).toEqual([1, 42])
    expect((await resolveAsset('nation', 42))?.toString()).toBe('flag-42')
  })

  it('loads a legend_mark_icons pack and indexes under subtype "legend"', async () => {
    mockFs.readdir.mockResolvedValueOnce(['hyblegends.datf'])
    mockUnzipper.Open.file.mockResolvedValueOnce(
      fakeDirectory({
        manifest: manifest({
          pack_id: 'legends',
          content_type: 'legend_mark_icons',
          covers: { legend_mark_icons: {} }
        }),
        entries: { 'legend0000.png': Buffer.from('mark-0') }
      })
    )

    await loadPacksForClientPath('/fake/client')
    expect(await listCoveredIds('legend')).toEqual([0])
    expect((await resolveAsset('legend', 0))?.toString()).toBe('mark-0')
  })

  it('skips packs whose content_type is registered but planned (not yet implemented)', async () => {
    mockFs.readdir.mockResolvedValueOnce(['future.datf'])
    mockUnzipper.Open.file.mockResolvedValueOnce(
      fakeDirectory({
        manifest: manifest({
          pack_id: 'future-creatures',
          content_type: 'creatures',
          covers: { creatures: {} }
        }),
        entries: { 'creature00001.png': Buffer.from('placeholder') }
      })
    )
    await loadPacksForClientPath('/fake/client')
    expect(await listActivePacks()).toHaveLength(0)
  })

  it('loads an item_icons pack with 5-digit IDs under subtype "item"', async () => {
    mockFs.readdir.mockResolvedValueOnce(['items_001-005.datf'])
    mockUnzipper.Open.file.mockResolvedValueOnce(
      fakeDirectory({
        manifest: manifest({
          pack_id: 'items-001-005',
          content_type: 'item_icons',
          covers: { item_icons: {} }
        }),
        entries: {
          'item00001.png': Buffer.from('item-1'),
          'item00095.png': Buffer.from('item-95'),
          'item13688.png': Buffer.from('item-13688')
        }
      })
    )

    await loadPacksForClientPath('/fake/client')
    expect(await listCoveredIds('item')).toEqual([1, 95, 13688])
    expect((await resolveAsset('item', 95))?.toString()).toBe('item-95')
    expect((await resolveAsset('item', 13688))?.toString()).toBe('item-13688')
  })

  it('merges multiple item_icons packs covering disjoint sheet ranges', async () => {
    mockFs.readdir.mockResolvedValueOnce(['items_001-005.datf', 'items_042-061.datf'])
    mockUnzipper.Open.file
      .mockResolvedValueOnce(
        fakeDirectory({
          manifest: manifest({
            pack_id: 'items-001-005',
            content_type: 'item_icons',
            priority: 100
          }),
          entries: { 'item00001.png': Buffer.from('low-range') }
        })
      )
      .mockResolvedValueOnce(
        fakeDirectory({
          manifest: manifest({
            pack_id: 'items-042-061',
            content_type: 'item_icons',
            priority: 100
          }),
          entries: { 'item11000.png': Buffer.from('high-range') }
        })
      )

    await loadPacksForClientPath('/fake/client')
    expect(await listCoveredIds('item')).toEqual([1, 11000])
    expect((await resolveAsset('item', 1))?.toString()).toBe('low-range')
    expect((await resolveAsset('item', 11000))?.toString()).toBe('high-range')
  })

  it('skips packs whose content_type is not registered at all', async () => {
    mockFs.readdir.mockResolvedValueOnce(['weird.datf'])
    mockUnzipper.Open.file.mockResolvedValueOnce(
      fakeDirectory({
        manifest: manifest({
          pack_id: 'weird',
          content_type: 'not_a_real_type',
          covers: {}
        })
      })
    )
    await loadPacksForClientPath('/fake/client')
    expect(await listActivePacks()).toHaveLength(0)
  })

  it('silently skips out_of_scope packs without a warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockFs.readdir.mockResolvedValueOnce(['ui-sprite-overrides-smoke.datf'])
    mockUnzipper.Open.file.mockResolvedValueOnce(
      fakeDirectory({
        manifest: manifest({
          pack_id: 'ui-overrides',
          content_type: 'ui_sprite_overrides',
          covers: { ui_sprite_overrides: {} }
        }),
        entries: { 'butt001.epf/0015.png': Buffer.from('ok-button') }
      })
    )
    await loadPacksForClientPath('/fake/client')

    expect(await listActivePacks()).toHaveLength(0)
    // No "unknown content_type" or "not yet implemented" warning for a
    // valid Comhaigne type that Creidhne doesn't consume.
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
