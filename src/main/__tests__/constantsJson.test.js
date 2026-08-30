import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'
import { DEFAULT_NPC_SPECIES } from '../../shared/npcSpecies.js'

const mockFs = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn()
}

vi.mock('fs', () => ({ promises: mockFs }))

const { getConstantsPath, loadConstants, saveConstants } = await import('../constantsJson.js')

beforeEach(() => {
  vi.clearAllMocks()
  mockFs.mkdir.mockResolvedValue(undefined)
  mockFs.writeFile.mockResolvedValue(undefined)
})

const EMPTY_SHAPE = {
  vendorTabs: [],
  itemCategories: [],
  castableCategories: [],
  statusCategories: [],
  cookies: [],
  npcJobs: [],
  // The one seeded key: species has no XML element and no filename prefix to
  // scan for, so an empty start would leave the picker with nothing to offer.
  npcSpecies: [...DEFAULT_NPC_SPECIES],
  creatureFamilies: [],
  motions: [],
  weapons: []
}

describe('getConstantsPath', () => {
  it('points to constants.json inside .creidhne', () => {
    expect(getConstantsPath('/worlds/test/xml')).toBe(
      join('/worlds/test/xml', '..', '.creidhne', 'constants.json')
    )
  })
})

describe('loadConstants', () => {
  it('returns empty defaults when file does not exist', async () => {
    mockFs.readFile.mockRejectedValue(new Error('ENOENT'))
    const result = await loadConstants('/worlds/test/xml')
    expect(result).toEqual(EMPTY_SHAPE)
  })

  it('returns empty defaults when file is malformed JSON', async () => {
    mockFs.readFile.mockResolvedValue('{not json')
    const result = await loadConstants('/worlds/test/xml')
    expect(result).toEqual(EMPTY_SHAPE)
  })

  it('merges saved data with defaults, preserving all default keys', async () => {
    mockFs.readFile.mockResolvedValue(
      JSON.stringify({
        vendorTabs: ['Weapons', 'Armor'],
        npcJobs: ['Vendor']
      })
    )
    const result = await loadConstants('/worlds/test/xml')
    expect(result.vendorTabs).toEqual(['Weapons', 'Armor'])
    expect(result.npcJobs).toEqual(['Vendor'])
    // Defaults retained for keys not in saved data
    expect(result.itemCategories).toEqual([])
    expect(result.cookies).toEqual([])
    expect(result.npcSpecies).toEqual([...DEFAULT_NPC_SPECIES])
  })

  it('lets a world trim the species seed, even to nothing', async () => {
    // A key present in the file wins over the seed, `[]` included. The seed
    // only STARTS the list; the world's own file is the record.
    mockFs.readFile.mockResolvedValue(JSON.stringify({ npcSpecies: [] }))
    const result = await loadConstants('/worlds/test/xml')
    expect(result.npcSpecies).toEqual([])
  })
})

describe('saveConstants', () => {
  it('ensures the .creidhne dir exists and writes pretty JSON', async () => {
    const data = { vendorTabs: ['Tavern'], itemCategories: ['Food'] }
    await saveConstants('/worlds/test/xml', data)

    expect(mockFs.mkdir).toHaveBeenCalledWith(expect.stringContaining('.creidhne'), {
      recursive: true
    })
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      getConstantsPath('/worlds/test/xml'),
      JSON.stringify(data, null, 2),
      'utf-8'
    )
  })
})
