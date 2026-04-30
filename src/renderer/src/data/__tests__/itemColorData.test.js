import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the heavy dependencies. ColorTable.fromArchive returns an object with
// `.get(index)` matching the dalib-ts ColorTable API; loadArchive returns
// whatever stand-in archive shape we want — we never inspect it because
// ColorTable.fromArchive is mocked too.
const mockFromArchive = vi.fn()
const mockLoadArchive = vi.fn()

vi.mock('@eriscorp/dalib-ts', () => ({
  ColorTable: { fromArchive: (...args) => mockFromArchive(...args) }
}))

vi.mock('../../utils/daClient', () => ({
  loadArchive: (...args) => mockLoadArchive(...args),
  registerCacheClearer: vi.fn()
}))

// Recoil is imported by itemColorData (for the React hook); mock it so the
// import doesn't pull the real recoil bundle into the test environment.
vi.mock('recoil', () => ({
  useRecoilValue: vi.fn(),
  atom: vi.fn()
}))
vi.mock('../../recoil/atoms', () => ({ clientPathState: {} }))

const {
  getItemColorEntry,
  loadItemColorSwatches,
  clearItemColorCache
} = await import('../itemColorData.js')

beforeEach(() => {
  clearItemColorCache()
  mockFromArchive.mockReset()
  mockLoadArchive.mockReset()
})

describe('getItemColorEntry early returns', () => {
  it('returns null when clientPath is missing', async () => {
    expect(await getItemColorEntry('', 'Crimson')).toBeNull()
    expect(await getItemColorEntry(null, 'Crimson')).toBeNull()
    expect(await getItemColorEntry(undefined, 'Crimson')).toBeNull()
  })

  it('returns null for the un-dyed sentinels (blank, None, null, undefined)', async () => {
    expect(await getItemColorEntry('/p', '')).toBeNull()
    expect(await getItemColorEntry('/p', 'None')).toBeNull()
    expect(await getItemColorEntry('/p', null)).toBeNull()
    expect(await getItemColorEntry('/p', undefined)).toBeNull()
  })

  it('does not touch the archive on early-return paths', async () => {
    await getItemColorEntry('', 'Crimson')
    await getItemColorEntry('/p', '')
    await getItemColorEntry('/p', 'None')
    expect(mockLoadArchive).not.toHaveBeenCalled()
    expect(mockFromArchive).not.toHaveBeenCalled()
  })
})

describe('getItemColorEntry happy path', () => {
  it('looks up the table at index = ITEM_COLORS.indexOf(name) - 1', async () => {
    // ITEM_COLORS = ['', 'None', 'Black', 'Red', ...] — 'Black' is at index 2,
    // so the dye table lookup should be index 1 (legacy DisplayColor enum
    // value, with index 0 reserved for Default/None).
    const blackEntry = { colors: [{ r: 0, g: 0, b: 0, a: 255 }] }
    mockLoadArchive.mockResolvedValue({})
    mockFromArchive.mockReturnValue({
      get: (index) => (index === 1 ? blackEntry : { colors: [{ r: index, g: 0, b: 0, a: 255 }] })
    })

    const result = await getItemColorEntry('/p', 'Black')
    expect(result).toBe(blackEntry)
  })

  it('returns null for an unknown color name', async () => {
    mockLoadArchive.mockResolvedValue({})
    mockFromArchive.mockReturnValue({ get: () => undefined })

    expect(await getItemColorEntry('/p', 'NotARealColor')).toBeNull()
  })

  it('returns null when the table lookup yields an entry without colors', async () => {
    mockLoadArchive.mockResolvedValue({})
    // Some indices in color0.tbl can be sparse; entries without a `colors`
    // array should be treated as "color not present".
    mockFromArchive.mockReturnValue({ get: () => ({ colors: null }) })

    expect(await getItemColorEntry('/p', 'Black')).toBeNull()
  })
})

describe('itemColorData caching', () => {
  it('reads the archive once and shares the result between swatch and entry lookups', async () => {
    mockLoadArchive.mockResolvedValue({})
    mockFromArchive.mockReturnValue({
      get: (index) => ({ colors: [{ r: index, g: 0, b: 0, a: 255 }] })
    })

    await loadItemColorSwatches('/p')
    await getItemColorEntry('/p', 'Black')
    await loadItemColorSwatches('/p')
    await getItemColorEntry('/p', 'Red')

    expect(mockLoadArchive).toHaveBeenCalledTimes(1)
    expect(mockFromArchive).toHaveBeenCalledTimes(1)
  })

  it('reloads after clearItemColorCache', async () => {
    mockLoadArchive.mockResolvedValue({})
    mockFromArchive.mockReturnValue({
      get: (index) => ({ colors: [{ r: index, g: 0, b: 0, a: 255 }] })
    })

    await getItemColorEntry('/p', 'Black')
    clearItemColorCache()
    await getItemColorEntry('/p', 'Black')

    expect(mockLoadArchive).toHaveBeenCalledTimes(2)
    expect(mockFromArchive).toHaveBeenCalledTimes(2)
  })

  it('keeps caches separate per clientPath', async () => {
    mockLoadArchive.mockResolvedValue({})
    mockFromArchive.mockReturnValue({
      get: (index) => ({ colors: [{ r: index, g: 0, b: 0, a: 255 }] })
    })

    await getItemColorEntry('/a', 'Black')
    await getItemColorEntry('/b', 'Black')

    expect(mockLoadArchive).toHaveBeenCalledTimes(2)
    expect(mockLoadArchive).toHaveBeenNthCalledWith(1, '/a', 'legend.dat')
    expect(mockLoadArchive).toHaveBeenNthCalledWith(2, '/b', 'legend.dat')
  })

  it('builds a swatch map covering every named DisplayColor when the table is fully populated', async () => {
    mockLoadArchive.mockResolvedValue({})
    mockFromArchive.mockReturnValue({
      get: (index) => ({ colors: [{ r: index, g: 0, b: 0, a: 255 }] })
    })

    const swatches = await loadItemColorSwatches('/p')
    // ITEM_COLORS index 0 is the blank UI option; every other entry maps to
    // a DisplayColor enum value, so a fully populated table yields one
    // swatch per non-blank entry.
    const { ITEM_COLORS } = await import('../itemConstants.js')
    expect(swatches.size).toBe(ITEM_COLORS.length - 1)
    expect(swatches.has('Black')).toBe(true)
    expect(swatches.has('Crimson')).toBe(true)
    expect(swatches.has('')).toBe(false)
  })
})
