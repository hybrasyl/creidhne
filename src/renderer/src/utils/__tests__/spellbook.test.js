import { describe, it, expect } from 'vitest'
import { resolveSpellbook, spellbookWriteCount } from '../spellbook'

const members = {
  aoe: ['Athar', 'Creag', 'Srad'],
  nuke: ['Athar', 'Fas Nadur'],
  heal: ['Ioc']
}

describe('resolveSpellbook (renderer)', () => {
  it('unions categories and direct castables, deduped and sorted', () => {
    const book = { name: 'Mage', castables: ['Pramh'], categories: ['aoe', 'nuke'] }
    expect(resolveSpellbook(book, members)).toEqual([
      'Athar',
      'Creag',
      'Fas Nadur',
      'Pramh',
      'Srad'
    ])
  })

  it('skips the book own name as a category', () => {
    const m = { Mage: ['Ghost'], aoe: ['Srad'] }
    const book = { name: 'Mage', castables: [], categories: ['Mage', 'aoe'] }
    expect(resolveSpellbook(book, m)).toEqual(['Srad'])
  })
})

describe('spellbookWriteCount', () => {
  it('counts castables newly gaining the tag', () => {
    // No castable carries "Mage" yet → all 3 aoe members gain it.
    const book = { name: 'Mage', castables: [], categories: ['aoe'] }
    expect(spellbookWriteCount(book, members, null)).toBe(3)
  })

  it('counts castables losing the tag when removed from the book', () => {
    // "Mage" currently on 3 castables; book now resolves to none → 3 lose it.
    const m = { ...members, Mage: ['Athar', 'Creag', 'Srad'] }
    const book = { name: 'Mage', castables: [], categories: [] }
    expect(spellbookWriteCount(book, m, null)).toBe(3)
  })

  it('does not recount castables that keep the tag', () => {
    // "Mage" already on the 3 aoe members and the book still resolves to them.
    const m = { ...members, Mage: ['Athar', 'Creag', 'Srad'] }
    const book = { name: 'Mage', castables: [], categories: ['aoe'] }
    expect(spellbookWriteCount(book, m, null)).toBe(0)
  })

  it('counts previous-name strips on rename plus new-name adds', () => {
    // Rename "Old" -> "Mage". Old tag on 2 castables (both stripped); the book
    // resolves to the 3 aoe members (all gain "Mage"). Athar overlaps → 4 files.
    const m = { ...members, Old: ['Athar', 'Zzz'] }
    const book = { name: 'Mage', castables: [], categories: ['aoe'] }
    expect(spellbookWriteCount(book, m, 'Old')).toBe(4)
  })
})
