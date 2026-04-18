import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

const mockFs = {
  readdir: vi.fn(),
  readFile: vi.fn()
}

vi.mock('fs', () => ({ promises: mockFs }))

const { loadReference, SUPPORTED_REFERENCE_TYPES, REFERENCE_TYPE_LABELS } =
  await import('../referenceLoader.js')

beforeEach(() => {
  vi.clearAllMocks()
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
    expect(mockFs.readdir).not.toHaveBeenCalled() // skipped scan
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
    // Directory listing
    mockFs.readdir.mockResolvedValueOnce([
      { isFile: () => true, name: 'other.xml' },
      { isFile: () => true, name: 'wanted.xml' },
      { isFile: () => false, name: 'subdir' },
      { isFile: () => true, name: 'notes.txt' }
    ])
    // Scan reads — first other.xml (non-match), then wanted.xml (match)
    mockFs.readFile
      .mockResolvedValueOnce(castableXml('Other Spell'))
      .mockResolvedValueOnce(castableXml('Beag Srad'))

    const result = await loadReference('/world', 'castables', 'Beag Srad')
    expect(result.ok).toBe(true)
    expect(result.parsed.name).toBe('Beag Srad')
    expect(result.path).toBe(join('/world', 'castables', 'wanted.xml'))
  })

  it('skips files that fail to parse during scan', async () => {
    mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT')) // filename guess
    mockFs.readdir.mockResolvedValueOnce([
      { isFile: () => true, name: 'broken.xml' },
      { isFile: () => true, name: 'good.xml' }
    ])
    mockFs.readFile
      .mockResolvedValueOnce('<not xml>>>>')
      .mockResolvedValueOnce(castableXml('Wanted'))

    const result = await loadReference('/world', 'castables', 'Wanted')
    expect(result.ok).toBe(true)
    expect(result.parsed.name).toBe('Wanted')
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
    mockFs.readdir.mockRejectedValueOnce(new Error('ENOENT'))

    const result = await loadReference('/world', 'castables', 'Whatever')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Directory not found/)
  })

  it('returns error when no matching entity is found', async () => {
    mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT')) // filename guess
    mockFs.readdir.mockResolvedValueOnce([{ isFile: () => true, name: 'a.xml' }])
    mockFs.readFile.mockResolvedValueOnce(castableXml('Something Else'))

    const result = await loadReference('/world', 'castables', 'Missing')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/No Castable named "Missing"/)
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
