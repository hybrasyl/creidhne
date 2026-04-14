import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

const mockFs = {
  mkdir: vi.fn(),
}

vi.mock('fs', () => ({ promises: mockFs }))

const { getCreidhnePath, getCreidhneFilePath, ensureCreidhneDir } = await import('../worldData.js')

beforeEach(() => {
  vi.clearAllMocks()
  mockFs.mkdir.mockResolvedValue(undefined)
})

describe('getCreidhnePath', () => {
  it('returns .creidhne sibling to the library xml directory', () => {
    // libraryPath points to world/xml/; .creidhne lives one dir up
    expect(getCreidhnePath('/worlds/test/xml')).toBe(join('/worlds/test/xml', '..', '.creidhne'))
  })
})

describe('getCreidhneFilePath', () => {
  it('joins a filename under the .creidhne directory', () => {
    expect(getCreidhneFilePath('/worlds/test/xml', 'index.json'))
      .toBe(join('/worlds/test/xml', '..', '.creidhne', 'index.json'))
  })
})

describe('ensureCreidhneDir', () => {
  it('calls mkdir recursively at the .creidhne path', async () => {
    await ensureCreidhneDir('/worlds/test/xml')
    expect(mockFs.mkdir).toHaveBeenCalledWith(
      getCreidhnePath('/worlds/test/xml'),
      { recursive: true },
    )
  })
})
