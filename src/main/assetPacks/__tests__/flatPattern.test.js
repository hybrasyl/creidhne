import { describe, it, expect } from 'vitest'
import { makeFlatPatternHandler } from '../handlers/flatPattern.js'

const ability = makeFlatPatternHandler({
  contentType: 'ability_icons',
  subtypes: ['skill', 'spell'],
  padding: 4
})

describe('makeFlatPatternHandler: parseEntry', () => {
  it('parses subtype + id from a flat filename', () => {
    expect(ability.parseEntry('skill0001.png')).toEqual({
      subtype: 'skill',
      id: 1,
      key: 'skill:1'
    })
    expect(ability.parseEntry('spell0042.png')).toEqual({
      subtype: 'spell',
      id: 42,
      key: 'spell:42'
    })
  })

  it('flattens subdirectories before parsing', () => {
    expect(ability.parseEntry('subdir/skill0001.png')).toEqual({
      subtype: 'skill',
      id: 1,
      key: 'skill:1'
    })
  })

  it('is case-insensitive on extension and prefix', () => {
    expect(ability.parseEntry('SKILL0001.PNG')?.subtype).toBe('skill')
    expect(ability.parseEntry('Skill0001.Png')?.subtype).toBe('skill')
  })

  it('accepts both .png and .webp extensions', () => {
    expect(ability.parseEntry('skill0001.png')?.id).toBe(1)
    expect(ability.parseEntry('skill0001.webp')?.id).toBe(1)
  })

  it('rejects unknown subtypes for this content type', () => {
    expect(ability.parseEntry('nation0001.png')).toBeNull()
    expect(ability.parseEntry('legend0001.png')).toBeNull()
  })

  it('rejects filenames without a numeric id', () => {
    expect(ability.parseEntry('readme.txt')).toBeNull()
    expect(ability.parseEntry('skill.png')).toBeNull()
    expect(ability.parseEntry('notes.png')).toBeNull()
  })

  it('rejects unsupported extensions', () => {
    expect(ability.parseEntry('skill0001.jpg')).toBeNull()
    expect(ability.parseEntry('skill0001.gif')).toBeNull()
  })

  it('tolerates non-canonical zero-pad widths (3-digit, 5-digit)', () => {
    // Padding is informational — we don't reject mis-padded entries.
    expect(ability.parseEntry('skill001.png')?.id).toBe(1)
    expect(ability.parseEntry('skill12345.png')?.id).toBe(12345)
  })
})

describe('makeFlatPatternHandler: keyFor', () => {
  it('builds the entry-cache key for a known subtype', () => {
    expect(ability.keyFor('skill', 1)).toBe('skill:1')
    expect(ability.keyFor('spell', 42)).toBe('spell:42')
  })

  it('is case-insensitive on the subtype', () => {
    expect(ability.keyFor('SKILL', 1)).toBe('skill:1')
  })

  it('returns null for subtypes this handler does not claim', () => {
    expect(ability.keyFor('nation', 1)).toBeNull()
    expect(ability.keyFor('', 1)).toBeNull()
    expect(ability.keyFor(null, 1)).toBeNull()
  })
})

describe('makeFlatPatternHandler: validation', () => {
  it('throws when contentType is missing', () => {
    expect(() => makeFlatPatternHandler({ subtypes: ['x'] })).toThrow(/contentType/)
  })

  it('throws when subtypes is missing or empty', () => {
    expect(() => makeFlatPatternHandler({ contentType: 'x' })).toThrow(/subtypes/)
    expect(() => makeFlatPatternHandler({ contentType: 'x', subtypes: [] })).toThrow(/subtypes/)
  })

  it('reports status "implemented" and exposes subtype list', () => {
    expect(ability.status).toBe('implemented')
    expect(ability.subtypes.sort()).toEqual(['skill', 'spell'])
  })
})
