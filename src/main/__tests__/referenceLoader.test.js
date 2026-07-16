import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

const mockFs = {
  readdir: vi.fn(),
  readFile: vi.fn(),
  access: vi.fn()
}

vi.mock('fs', () => ({ promises: mockFs }))

// loadIndex is consulted between the filename guess and the full-dir scan.
// Default: no index (returns null) so the existing scan tests are unaffected.
const mockLoadIndex = vi.fn()
vi.mock('../indexService.js', () => ({ loadIndex: (...a) => mockLoadIndex(...a) }))

// The full scan enumerates via listSection (hybindex-backed, recursive,
// archive-excluding) rather than its own readdir. Mock at that boundary so
// these tests drive the file set directly and never reach the real package.
const mockListSection = vi.fn()
vi.mock('../fsHandlers.js', () => ({ listSection: (...a) => mockListSection(...a) }))

const { loadReference, SUPPORTED_REFERENCE_TYPES, REFERENCE_TYPE_LABELS } =
  await import('../referenceLoader.js')

// Helper: the scan sees exactly these type-relative paths.
const scanFinds = (...rels) =>
  mockListSection.mockResolvedValue({ dir: '', active: rels, archived: [] })

beforeEach(() => {
  vi.clearAllMocks()
  mockLoadIndex.mockResolvedValue(null)
  scanFinds()
  mockFs.access.mockResolvedValue(undefined) // type dir exists unless a test says otherwise
})

const castableXml = (name) => `<?xml version="1.0" encoding="utf-8"?>
<Castable xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02"
          Book="PrimarySpell" Elements="Fire" Class="Wizard"
          IsAssail="false" Reflectable="false" BreakStealth="false"
          IncludeInMetafile="true" PvpOnly="false">
  <Name>${name}</Name>
</Castable>`

const localizationXml = (locale) => `<?xml version="1.0" encoding="utf-8"?>
<Localization xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Locale="${locale}">
</Localization>`

// ─── Happy path ──────────────────────────────────────────────────────────────

describe('loadReference: happy path', () => {
  it('finds the entity via filename-first guess', async () => {
    mockFs.readFile.mockResolvedValueOnce(castableXml('Ard Srad'))
    const result = await loadReference('/world', 'castables', 'Ard Srad')
    expect(result.ok).toBe(true)
    expect(result.parsed.name).toBe('Ard Srad')
    expect(result.path).toBe(join('/world', 'castables', 'Ard Srad.xml'))
    expect(mockListSection).not.toHaveBeenCalled() // skipped scan
  })

  it('matches case-insensitively', async () => {
    mockFs.readFile.mockResolvedValueOnce(castableXml('Ard Srad'))
    const result = await loadReference('/world', 'castables', 'ARD SRAD')
    expect(result.ok).toBe(true)
  })
})

// ─── Fallback scan when filename differs from Name ───────────────────────────

describe('loadReference: fallback scan', () => {
  it('scans directory when filename guess does not match', async () => {
    // First read (filename guess) — returns XML with a *different* name
    mockFs.readFile.mockResolvedValueOnce(castableXml('Other Spell'))
    // listSection filters to .xml and drops directories itself, so the scan
    // sees only real section files.
    scanFinds('other.xml', 'wanted.xml')
    // Scan reads — first other.xml (non-match), then wanted.xml (match)
    mockFs.readFile
      .mockResolvedValueOnce(castableXml('Other Spell'))
      .mockResolvedValueOnce(castableXml('Beag Srad'))

    const result = await loadReference('/world', 'castables', 'Beag Srad')
    expect(result.ok).toBe(true)
    expect(result.parsed.name).toBe('Beag Srad')
    expect(result.path).toBe(join('/world', 'castables', 'wanted.xml'))
  })

  it('finds an entity inside a subdirectory', async () => {
    mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT')) // filename guess
    scanFinds('universal/dachaidh.xml')
    mockFs.readFile.mockResolvedValueOnce(castableXml('Dachaidh'))

    const result = await loadReference('/world', 'castables', 'Dachaidh')
    expect(result.ok).toBe(true)
    expect(result.path).toBe(join('/world', 'castables', 'universal/dachaidh.xml'))
  })

  it('skips files that fail to parse during scan', async () => {
    mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT')) // filename guess
    scanFinds('broken.xml', 'good.xml')
    mockFs.readFile
      .mockResolvedValueOnce('<not xml>>>>')
      .mockResolvedValueOnce(castableXml('Wanted'))

    const result = await loadReference('/world', 'castables', 'Wanted')
    expect(result.ok).toBe(true)
    expect(result.parsed.name).toBe('Wanted')
  })
})

// ─── Index name→filename map (avoids the full scan) ──────────────────────────

describe('loadReference: index filename map', () => {
  it('resolves via the index name→filename map without scanning the directory', async () => {
    // Filename guess (Beag Srad.xml) returns a non-matching entity.
    mockFs.readFile.mockResolvedValueOnce(castableXml('Other Spell'))
    mockLoadIndex.mockResolvedValue({
      castablesNamesByFilename: { '1test_beag.xml': 'Beag Srad' }
    })
    // Only the single indexed file is read.
    mockFs.readFile.mockResolvedValueOnce(castableXml('Beag Srad'))

    const result = await loadReference('/world', 'castables', 'Beag Srad')
    expect(result.ok).toBe(true)
    expect(result.parsed.name).toBe('Beag Srad')
    expect(result.path).toBe(join('/world', 'castables', '1test_beag.xml'))
    expect(mockListSection).not.toHaveBeenCalled() // no directory scan
  })

  it('resolves a subdirectory key from the index map', async () => {
    mockFs.readFile.mockResolvedValueOnce(castableXml('Other Spell')) // guess misses
    mockLoadIndex.mockResolvedValue({
      castablesNamesByFilename: { 'universal/all_psp_dachaidh.xml': 'Dachaidh' }
    })
    mockFs.readFile.mockResolvedValueOnce(castableXml('Dachaidh'))

    const result = await loadReference('/world', 'castables', 'Dachaidh')
    expect(result.ok).toBe(true)
    expect(result.path).toBe(join('/world', 'castables', 'universal/all_psp_dachaidh.xml'))
    expect(mockListSection).not.toHaveBeenCalled()
  })

  it('never resolves a reference to archived content', async () => {
    // Same <Name> live under .ignore/ — the server never loads it, so the
    // lookup must skip the archived key and fall through to the live file.
    mockFs.readFile.mockResolvedValueOnce(castableXml('Other Spell')) // guess misses
    mockLoadIndex.mockResolvedValue({
      castablesNamesByFilename: {
        '.ignore/old_beag.xml': 'Beag Srad',
        'live_beag.xml': 'Beag Srad'
      }
    })
    mockFs.readFile.mockResolvedValueOnce(castableXml('Beag Srad'))

    const result = await loadReference('/world', 'castables', 'Beag Srad')
    expect(result.ok).toBe(true)
    expect(result.path).toBe(join('/world', 'castables', 'live_beag.xml'))
  })

  it('falls back to the scan when the indexed file no longer matches (stale index)', async () => {
    mockFs.readFile.mockResolvedValueOnce(castableXml('Other Spell')) // guess
    mockLoadIndex.mockResolvedValue({
      castablesNamesByFilename: { 'stale.xml': 'Beag Srad' }
    })
    mockFs.readFile.mockResolvedValueOnce(castableXml('Renamed Away')) // indexed file — no match
    scanFinds('real.xml')
    mockFs.readFile.mockResolvedValueOnce(castableXml('Beag Srad')) // scan hit

    const result = await loadReference('/world', 'castables', 'Beag Srad')
    expect(result.ok).toBe(true)
    expect(result.path).toBe(join('/world', 'castables', 'real.xml'))
  })
})

// ─── Error cases ─────────────────────────────────────────────────────────────

describe('loadReference: errors', () => {
  it('returns error for unsupported type', async () => {
    const result = await loadReference('/world', 'foobar', 'Whatever')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Unsupported type/)
  })

  it('returns error when libraryPath or name missing', async () => {
    expect((await loadReference('', 'castables', 'X')).ok).toBe(false)
    expect((await loadReference('/world', 'castables', '')).ok).toBe(false)
  })

  it('returns error when directory does not exist', async () => {
    mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT')) // filename guess
    // listSectionFiles swallows a missing dir into an empty list, so the
    // access() probe is what distinguishes this from an empty directory.
    scanFinds()
    mockFs.access.mockRejectedValueOnce(new Error('ENOENT'))

    const result = await loadReference('/world', 'castables', 'Whatever')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Directory not found/)
  })

  it('reports no-match (not a missing dir) when the directory is merely empty', async () => {
    mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT')) // filename guess
    scanFinds()
    mockFs.access.mockResolvedValueOnce(undefined) // dir exists, just empty

    const result = await loadReference('/world', 'castables', 'Whatever')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/No Castable named "Whatever"/)
  })

  it('returns error when no matching entity is found', async () => {
    mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT')) // filename guess
    scanFinds('a.xml')
    mockFs.readFile.mockResolvedValueOnce(castableXml('Something Else'))

    const result = await loadReference('/world', 'castables', 'Missing')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/No Castable named "Missing"/)
  })
})

// ─── Path-traversal guard (Category-B) ───────────────────────────────────────

describe('loadReference: traversal guard on name', () => {
  it('falls back to scan when name attempts ../ escape', async () => {
    // The filename-first guess would compose to /escape.xml; assertInside
    // rejects it, and the scan path takes over as the only avenue. The scan
    // reads only paths listSection enumerated under dir — never the
    // renderer-supplied name — so a traversal can't reach a file outside
    // the type subdir.
    scanFinds('a.xml')
    mockFs.readFile.mockResolvedValueOnce(castableXml('Something Else'))

    const result = await loadReference('/world', 'castables', '../escape')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/No Castable named/)
    // Critical: the readFile for the filename guess MUST NOT have been called
    // with a path outside /world/castables — only the scan's readFile fires.
    expect(mockFs.readFile).toHaveBeenCalledTimes(1)
    const calledPath = mockFs.readFile.mock.calls[0][0]
    expect(calledPath).toBe(join('/world', 'castables', 'a.xml'))
  })
})

// ─── Localization uses locale, not name ──────────────────────────────────────

describe('loadReference: localization id field', () => {
  it('matches against locale for localization type', async () => {
    mockFs.readFile.mockResolvedValueOnce(localizationXml('en_US'))
    const result = await loadReference('/world', 'localizations', 'en_US')
    expect(result.ok).toBe(true)
    expect(result.parsed.locale).toBe('en_US')
  })
})

// ─── Type config coverage ────────────────────────────────────────────────────

describe('type config completeness', () => {
  it('exposes 13 supported types (all XML editors except serverconfigs)', () => {
    expect(SUPPORTED_REFERENCE_TYPES).toHaveLength(13)
    expect(SUPPORTED_REFERENCE_TYPES).not.toContain('serverconfigs')
  })

  it('provides a label for every supported type', () => {
    for (const type of SUPPORTED_REFERENCE_TYPES) {
      expect(REFERENCE_TYPE_LABELS[type]).toBeTruthy()
    }
  })

  it('every supported type is rejected when name is empty (sanity: config is loaded, not crashed)', async () => {
    for (const type of SUPPORTED_REFERENCE_TYPES) {
      const r = await loadReference('/world', type, '')
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/Missing libraryPath or name/)
    }
  })
})
