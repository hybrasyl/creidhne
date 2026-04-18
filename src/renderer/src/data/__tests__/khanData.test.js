import { describe, it, expect } from 'vitest'
import {
  khanArchiveName,
  entryName,
  categoriesFor,
  defaultsFor,
  SLOT_TO_CATEGORY,
  CATEGORY_DEFAULTS
} from '../khanData.js'

describe('khanArchiveName', () => {
  it('routes A–D letters to the *ad archive', () => {
    expect(khanArchiveName('A', 'M')).toBe('khanmad.dat')
    expect(khanArchiveName('D', 'M')).toBe('khanmad.dat')
    expect(khanArchiveName('A', 'W')).toBe('khanwad.dat')
  })

  it('routes E–H letters to the *eh archive', () => {
    expect(khanArchiveName('E', 'M')).toBe('khanmeh.dat')
    expect(khanArchiveName('H', 'W')).toBe('khanweh.dat')
  })

  it('routes I–M letters to the *im archive', () => {
    expect(khanArchiveName('I', 'M')).toBe('khanmim.dat')
    expect(khanArchiveName('M', 'W')).toBe('khanwim.dat')
  })

  it('routes N–S letters to the *ns archive', () => {
    expect(khanArchiveName('N', 'M')).toBe('khanmns.dat')
    expect(khanArchiveName('S', 'W')).toBe('khanwns.dat')
  })

  it('routes T–Z letters to the *tz archive', () => {
    expect(khanArchiveName('T', 'M')).toBe('khanmtz.dat')
    expect(khanArchiveName('Z', 'W')).toBe('khanwtz.dat')
  })

  it('normalizes case for both category and gender', () => {
    // U is in the T-Z range → khan{m,w}tz.dat
    expect(khanArchiveName('u', 'm')).toBe('khanmtz.dat')
    expect(khanArchiveName('u', 'w')).toBe('khanwtz.dat')
    expect(khanArchiveName('a', 'M')).toBe('khanmad.dat')
  })

  it('returns null for invalid categories or genders', () => {
    expect(khanArchiveName('', 'M')).toBeNull()
    expect(khanArchiveName('U', 'X')).toBeNull()
    expect(khanArchiveName(null, 'M')).toBeNull()
    expect(khanArchiveName('U', null)).toBeNull()
  })
})

describe('entryName', () => {
  it('zero-pads displaySprite to 3 digits', () => {
    expect(entryName('U', 'M', 5, '03')).toBe('MU00503.epf')
    expect(entryName('U', 'M', 0, '03')).toBe('MU00003.epf')
    expect(entryName('U', 'M', 999, '03')).toBe('MU99903.epf')
  })

  it('uppercases category and gender', () => {
    expect(entryName('u', 'm', 5, '03')).toBe('MU00503.epf')
    expect(entryName('w', 'w', 5, '03')).toBe('WW00503.epf')
  })

  it('preserves single-character poses (b, c, d, e, f)', () => {
    expect(entryName('U', 'M', 5, 'b')).toBe('MU005b.epf')
    expect(entryName('U', 'M', 5, 'f')).toBe('MU005f.epf')
  })

  it('handles string-form displaySprite', () => {
    expect(entryName('U', 'M', '42', '03')).toBe('MU04203.epf')
  })
})

describe('categoriesFor', () => {
  it('returns empty array for unmapped slots', () => {
    expect(categoriesFor('LeftHand')).toEqual([])
    expect(categoriesFor('None')).toEqual([])
    expect(categoriesFor('')).toEqual([])
    expect(categoriesFor(undefined)).toEqual([])
  })

  it('wraps a string mapping in an array', () => {
    expect(categoriesFor('Armor')).toEqual(['U'])
    expect(categoriesFor('Weapon')).toEqual(['W'])
  })

  it('returns arrays as-is for multi-category slots', () => {
    expect(categoriesFor('Coat')).toEqual(['E', 'F'])
  })

  it('has all expected display-sprite slots mapped', () => {
    const expectedSlots = [
      'Armor',
      'Weapon',
      'Shield',
      'Foot',
      'Coat',
      'Helmet',
      'Trousers',
      'FirstAcc',
      'SecondAcc',
      'ThirdAcc'
    ]
    for (const slot of expectedSlots) {
      expect(categoriesFor(slot).length).toBeGreaterThan(0)
    }
  })
})

describe('defaultsFor', () => {
  it('returns the CATEGORY_DEFAULTS entry for a single-category slot', () => {
    expect(defaultsFor('U')).toEqual(CATEGORY_DEFAULTS.U)
    expect(defaultsFor('W')).toEqual(CATEGORY_DEFAULTS.W)
    expect(defaultsFor('S')).toEqual(CATEGORY_DEFAULTS.S)
  })

  it('returns the first-category defaults for multi-category slots', () => {
    // Coat → ['E', 'F'] — uses E's defaults
    expect(defaultsFor(['E', 'F'])).toEqual(CATEGORY_DEFAULTS.E)
  })

  it('returns the global fallback for unmapped categories', () => {
    const result = defaultsFor('Z')
    expect(result).toHaveProperty('pose')
    expect(result).toHaveProperty('frameIdx')
    // Z isn't in CATEGORY_DEFAULTS → should equal the GLOBAL_DEFAULT (03/5)
    expect(result).toEqual({ pose: '03', frameIdx: 5 })
  })

  it('handles null / empty category gracefully', () => {
    expect(defaultsFor(null)).toEqual({ pose: '03', frameIdx: 5 })
    expect(defaultsFor(undefined)).toEqual({ pose: '03', frameIdx: 5 })
    expect(defaultsFor([])).toEqual({ pose: '03', frameIdx: 5 })
  })

  it('is case-insensitive', () => {
    expect(defaultsFor('u')).toEqual(CATEGORY_DEFAULTS.U)
  })
})

describe('SLOT_TO_CATEGORY integrity', () => {
  it('never maps a slot to an empty array', () => {
    for (const [slot, v] of Object.entries(SLOT_TO_CATEGORY)) {
      if (Array.isArray(v)) {
        expect(v.length, `slot ${slot}`).toBeGreaterThan(0)
      } else {
        expect(v, `slot ${slot}`).toBeTruthy()
      }
    }
  })

  it('all category values are single uppercase letters', () => {
    for (const [slot, v] of Object.entries(SLOT_TO_CATEGORY)) {
      const letters = Array.isArray(v) ? v : [v]
      for (const l of letters) {
        expect(l, `slot ${slot}`).toMatch(/^[A-Z]$/)
      }
    }
  })
})
