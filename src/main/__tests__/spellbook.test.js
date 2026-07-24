import { describe, it, expect } from 'vitest'
import { resolveSpellbook, nextCategories, sameCategorySet, affectedCastables } from '../spellbook'

const members = {
  'mage-aoe': ['Athar', 'Creag', 'Srad'],
  'mage-nuke': ['Athar', 'Fas Nadur'],
  'priest-heal': ['Ioc', 'Beannaich']
}

describe('resolveSpellbook', () => {
  it('unions individual castables with all members of included categories, deduped and sorted', () => {
    const book = { name: 'Mage T1', castables: ['Pramh'], categories: ['mage-aoe', 'mage-nuke'] }
    // Athar is in both categories → appears once; Pramh is a direct add.
    expect(resolveSpellbook(book, members)).toEqual([
      'Athar',
      'Creag',
      'Fas Nadur',
      'Pramh',
      'Srad'
    ])
  })

  it('resolves a book with only individual castables', () => {
    const book = { name: 'Odds', castables: ['Zap', 'Pow'], categories: [] }
    expect(resolveSpellbook(book, members)).toEqual(['Pow', 'Zap'])
  })

  it('resolves a book with only categories', () => {
    const book = { name: 'Healer', castables: [], categories: ['priest-heal'] }
    expect(resolveSpellbook(book, members)).toEqual(['Beannaich', 'Ioc'])
  })

  it('skips the book own name as a category to avoid self-reference', () => {
    const withSelf = { 'Mage T1': ['Ghost'], 'mage-aoe': ['Srad'] }
    const book = { name: 'Mage T1', castables: [], categories: ['Mage T1', 'mage-aoe'] }
    expect(resolveSpellbook(book, withSelf)).toEqual(['Srad'])
  })

  it('trims names and ignores empty entries', () => {
    const book = { name: 'X', castables: ['  Foo  ', '', '   '], categories: ['', '  '] }
    expect(resolveSpellbook(book, members)).toEqual(['Foo'])
  })

  it('tolerates a missing members map and unknown categories', () => {
    const book = { name: 'X', castables: ['A'], categories: ['nope'] }
    expect(resolveSpellbook(book, undefined)).toEqual(['A'])
    expect(resolveSpellbook(book, members)).toEqual(['A'])
  })
})

describe('nextCategories', () => {
  it('adds the book name when the castable should be tagged', () => {
    expect(nextCategories(['fire'], { bookName: 'Mage T1', shouldHave: true })).toEqual([
      'fire',
      'Mage T1'
    ])
  })

  it('is idempotent when the tag is already present', () => {
    expect(nextCategories(['Mage T1', 'fire'], { bookName: 'Mage T1', shouldHave: true })).toEqual([
      'Mage T1',
      'fire'
    ])
  })

  it('removes the book name when the castable no longer resolves', () => {
    expect(nextCategories(['fire', 'Mage T1'], { bookName: 'Mage T1', shouldHave: false })).toEqual(
      ['fire']
    )
  })

  it('strips the previous name on rename and adds the new name', () => {
    expect(
      nextCategories(['Old Name', 'fire'], {
        bookName: 'New Name',
        prevName: 'Old Name',
        shouldHave: true
      })
    ).toEqual(['fire', 'New Name'])
  })

  it('strips the previous name and does not add when no longer resolved', () => {
    expect(
      nextCategories(['Old Name', 'fire'], {
        bookName: 'New Name',
        prevName: 'Old Name',
        shouldHave: false
      })
    ).toEqual(['fire'])
  })

  it('leaves unrelated categories untouched', () => {
    expect(nextCategories(['a', 'b'], { bookName: 'Book', shouldHave: false })).toEqual(['a', 'b'])
  })
})

describe('sameCategorySet', () => {
  it('is order and duplicate blind', () => {
    expect(sameCategorySet(['a', 'b'], ['b', 'a'])).toBe(true)
    expect(sameCategorySet(['a', 'a', 'b'], ['a', 'b'])).toBe(true)
    expect(sameCategorySet(['a'], ['a', 'b'])).toBe(false)
    expect(sameCategorySet([], [])).toBe(true)
  })
})

describe('affectedCastables', () => {
  it('unions the resolved set with current book-name members and prev-name members', () => {
    const m = { 'My Book': ['Old1', 'Old2'], 'Prev Book': ['Legacy'] }
    const resolved = ['New1', 'Old1']
    const affected = affectedCastables(resolved, 'My Book', 'Prev Book', m)
    expect([...affected].sort()).toEqual(['Legacy', 'New1', 'Old1', 'Old2'])
  })

  it('needs no prev-name members when not renaming', () => {
    const m = { Book: ['A'] }
    expect(affectedCastables(['B'], 'Book', null, m).sort()).toEqual(['A', 'B'])
  })
})
