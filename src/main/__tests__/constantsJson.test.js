import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

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
