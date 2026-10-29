import { describe, expect, it } from 'vitest'
import { branchParents, isValidKey, validateSpecies } from '../speciesValidate.js'

// The server's species checks (xml Species.Validate and ValidateAll).

const dwarf = () => ({
  key: 'Dwarf',
  id: '4',
  origin: 'Aosda',
  playerOption: 'Starter',
  branchOf: '',
  affinity: 'Wind',
  resistance: 'Wind',
  names: { singular: 'Dwarf', plural: 'Dwarves', adjective: 'Dwarven' },
  description: '',
  bodies: [
    { key: 'Ruddy', id: '40', name: '', isDefault: true, retailSkinColor: '' },
    { key: 'Ashen', id: '41', name: '', isDefault: false, retailSkinColor: '3' }
  ]
})

// The index view of the world: speciesDetails and speciesBodyIds.
const WORLD = {
  originalKey: 'Dwarf',
  details: {
    Dwarf: { id: 4, branchOf: null, playerOption: 'Starter', bodies: [] },
    Elf: { id: 6, branchOf: null, playerOption: 'ByBranch', bodies: [] },
    HighElf: { id: 7, branchOf: 'Elf', playerOption: 'Starter', bodies: [] },
    Human: { id: 1, branchOf: null, playerOption: 'Starter', bodies: [] }
  },
  bodyIds: {
    40: [{ species: 'Dwarf', body: 'Ruddy', filename: 'species_dwarf.xml' }],
    70: [{ species: 'HighElf', body: 'Pale', filename: 'species_highelf.xml' }]
  }
}

const problemsOf = (edit, world) => {
  const s = dwarf()
  edit(s)
  return validateSpecies(s, world).join(' ')
}

describe('one species', () => {
  it('passes a valid species, alone and against the world', () => {
    expect(validateSpecies(dwarf())).toEqual([])
    expect(validateSpecies(dwarf(), WORLD)).toEqual([])
  })
  it.each([[''], [' Dwarf'], ['Dwarf ']])('a bad key: "%s"', (key) => {
    expect(problemsOf((s) => (s.key = key))).toMatch(/key is empty, or it has a space/)
  })
  it('a key that does not match the pattern', () => {
    expect(problemsOf((s) => (s.key = 'Hill Dwarf'))).toMatch(/start with a letter/)
    expect(problemsOf((s) => (s.key = '2Dwarf'))).toMatch(/start with a letter/)
  })
  it('a body key that does not match the pattern', () => {
    expect(problemsOf((s) => (s.bodies[0].key = 'Ruddy Red'))).toMatch(
      /Body Ruddy Red: the key must/
    )
  })
  it('each name form that is empty or has a space at an end', () => {
    expect(problemsOf((s) => (s.names.plural = ''))).toMatch(/plural name is empty/)
    expect(problemsOf((s) => (s.names.adjective = 'Dwarven '))).toMatch(/adjective name is empty/)
  })
  it('a Starter or Unlockable species with no bodies, but not a Locked one', () => {
    expect(problemsOf((s) => (s.bodies = []))).toMatch(/A Starter species has no bodies/)
    expect(
      problemsOf((s) => {
        s.bodies = []
        s.playerOption = 'Unlockable'
      })
    ).toMatch(/A Unlockable species/)
    expect(
      problemsOf((s) => {
        s.bodies = []
        s.playerOption = 'Locked'
      })
    ).toBe('')
  })
  it('not exactly one default body', () => {
    expect(problemsOf((s) => (s.bodies[0].isDefault = false))).toMatch(/This species has 0/)
    expect(problemsOf((s) => (s.bodies[1].isDefault = true))).toMatch(/This species has 2/)
  })
  it('body keys that differ only in case', () => {
    expect(problemsOf((s) => (s.bodies[1].key = 'RUDDY'))).toMatch(/Body key Ruddy is not unique/)
  })
  it('a body Id used twice in the species', () => {
    expect(problemsOf((s) => (s.bodies[1].id = '40'))).toMatch(/Body Id 40 is not unique/)
  })
  it('a retail skin colour above 9', () => {
    expect(problemsOf((s) => (s.bodies[1].retailSkinColor = '10'))).toMatch(/from 0 to 9/)
  })
  it('ids out of range', () => {
    expect(problemsOf((s) => (s.id = '256'))).toMatch(/from 0 to 255/)
    expect(problemsOf((s) => (s.bodies[0].id = '65536'))).toMatch(/from 0 to 65535/)
  })
  it('a species that is not a branch needs both Affinity and Resistance', () => {
    expect(problemsOf((s) => (s.affinity = ''))).toMatch(/no Affinity/)
    expect(problemsOf((s) => (s.resistance = ''))).toMatch(/no Resistance/)
  })
  it('a branch needs neither, and cannot be ByBranch', () => {
    const branch = (s) => {
      s.branchOf = 'Elf'
      s.affinity = ''
      s.resistance = ''
    }
    expect(problemsOf(branch)).toBe('')
    expect(
      problemsOf((s) => {
        branch(s)
        s.playerOption = 'ByBranch'
      })
    ).toMatch(/A branch cannot be ByBranch/)
  })
})

describe('across species, from the index', () => {
  it('a key that differs from another only in case', () => {
    expect(problemsOf((s) => (s.key = 'ELF'), WORLD)).toMatch(/species key ELF is not unique/)
  })
  it('a species Id that another species has', () => {
    expect(problemsOf((s) => (s.id = '6'), WORLD)).toMatch(/also the Id of Elf/)
  })
  it('a body Id that another species uses, but not its own saved body', () => {
    expect(problemsOf((s) => (s.bodies[1].id = '70'), WORLD)).toMatch(
      /also used by HighElf \(Pale\)/
    )
    expect(problemsOf(() => {}, WORLD)).toBe('')
  })
  it('a BranchOf that is not a species, is a branch, or is not ByBranch', () => {
    const branchOf = (p) => (s) => {
      s.branchOf = p
      s.affinity = ''
      s.resistance = ''
    }
    expect(problemsOf(branchOf('Orc'), WORLD)).toMatch(/Orc, which is not a species/)
    expect(problemsOf(branchOf('HighElf'), WORLD)).toMatch(/which is a branch itself/)
    expect(problemsOf(branchOf('Human'), WORLD)).toMatch(/which is not ByBranch/)
    expect(problemsOf(branchOf('elf'), WORLD)).toBe('') // keys compare without case
  })
  it('a ByBranch species with no branch', () => {
    expect(problemsOf((s) => (s.playerOption = 'ByBranch'), WORLD)).toMatch(
      /ByBranch, but no species is a branch of it/
    )
  })
  it('a renamed species is still itself: its old index entry is not another species', () => {
    expect(problemsOf((s) => (s.key = 'Duergar'), WORLD)).toBe('')
  })
  it('a key that two files hold, as Duplicate makes, until the copy takes a new key', () => {
    const world = {
      ...WORLD,
      duplicateNames: { dwarf: ['species_dwarf.xml', 'species_dwarf (copy).xml'] }
    }
    expect(problemsOf(() => {}, world)).toMatch(/2 files have the key Dwarf/)
    expect(problemsOf((s) => (s.key = 'Duergar'), world)).toBe('')
    // A new species with a taken key gets the ordinary message, once.
    expect(problemsOf(() => {}, { ...world, originalKey: null })).toMatch(
      /^The species key Dwarf is not unique/
    )
  })
})

describe('branchParents', () => {
  it('offers each ByBranch species that is not a branch, but not the species itself', () => {
    const details = {
      ...WORLD.details,
      Orc: { id: 8, branchOf: null, playerOption: 'ByBranch', bodies: [] }
    }
    expect(branchParents(details, 'Dwarf')).toEqual(['Elf', 'Orc'])
    expect(branchParents(details, 'elf')).toEqual(['Orc'])
    expect(branchParents(undefined, 'Dwarf')).toEqual([])
  })
})

describe('isValidKey', () => {
  it('accepts the schema key pattern only', () => {
    expect(isValidKey('HillDwarf2')).toBe(true)
    expect(isValidKey('Hill Dwarf')).toBe(false)
    expect(isValidKey('2Dwarf')).toBe(false)
    expect(isValidKey('')).toBe(false)
  })
})
