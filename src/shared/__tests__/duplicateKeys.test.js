import { describe, expect, it } from 'vitest'
import { duplicateKeyGroups, sharedKeyGroup } from '../duplicateKeys.js'

// The duplicate-key report (HTOO-625), from the index's <type>DuplicateNames.

// The shapes hybindex-ts writes. An attribute-named type (species) records a
// file's name only when no earlier file has the exact name; an element-named
// type (items) records every file's first name.
const INDEX = {
  items: ['Lorica'],
  itemsNamesByFilename: { 'a.xml': 'Lorica', 'armor/b.xml': 'Lorica', 'c.xml': 'Sword' },
  itemsDuplicateNames: { lorica: ['a.xml', 'armor/b.xml'] },
  speciesNamesByFilename: { 'dwarf.xml': 'Dwarf', 'dwarf2.xml': 'DWARF', 'elf.xml': 'Elf' },
  speciesDuplicateNames: { dwarf: ['dwarf.xml', 'dwarf2.xml'], elf: ['elf.xml', 'elf copy.xml'] },
  nationsDuplicateNames: {}
}

describe('duplicateKeyGroups', () => {
  it('gives one entry for each key that more than one file holds, by type then key', () => {
    expect(duplicateKeyGroups(INDEX)).toEqual([
      { type: 'items', key: 'lorica', files: ['a.xml', 'armor/b.xml'], caseOnly: false },
      { type: 'species', key: 'dwarf', files: ['dwarf.xml', 'dwarf2.xml'], caseOnly: true },
      { type: 'species', key: 'elf', files: ['elf.xml', 'elf copy.xml'], caseOnly: false }
    ])
  })

  it('labels a group only when no two of its names are the same exact name', () => {
    // Elf: the copy has no recorded name, because the index saw the exact name first.
    const [, dwarf, elf] = duplicateKeyGroups(INDEX)
    expect(dwarf.caseOnly).toBe(true)
    expect(elf.caseOnly).toBe(false)
  })

  it('is empty with no index, and ignores a claim of one file', () => {
    expect(duplicateKeyGroups(undefined)).toEqual([])
    expect(duplicateKeyGroups({ itemsDuplicateNames: { x: ['x.xml'] } })).toEqual([])
  })
})

describe('sharedKeyGroup', () => {
  it('finds the group of a file, and nothing for a file outside every group', () => {
    expect(sharedKeyGroup(INDEX, 'items', 'armor/b.xml')).toMatchObject({
      key: 'lorica',
      files: ['a.xml', 'armor/b.xml']
    })
    expect(sharedKeyGroup(INDEX, 'items', 'c.xml')).toBeNull()
    expect(sharedKeyGroup(INDEX, 'castables', 'a.xml')).toBeNull()
    expect(sharedKeyGroup(undefined, 'items', 'a.xml')).toBeNull()
  })
})
