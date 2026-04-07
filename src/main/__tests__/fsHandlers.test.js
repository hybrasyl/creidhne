import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

const mockFs = {
  readdir:  vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access:   vi.fn(),
  mkdir:    vi.fn(),
  rename:   vi.fn(),
}

vi.mock('fs', () => ({ promises: mockFs }))

const { listDir, readFile, writeFile, moveFile, archiveFile } = await import('../fsHandlers.js')

beforeEach(() => {
  vi.clearAllMocks()
  mockFs.mkdir.mockResolvedValue(undefined)
  mockFs.rename.mockResolvedValue(undefined)
  mockFs.writeFile.mockResolvedValue(undefined)
})

// ─── listDir ─────────────────────────────────────────────────────────────────

describe('listDir', () => {
  it('returns only .xml files with name and full path', async () => {
    mockFs.readdir.mockResolvedValue([
      { isFile: () => true,  name: 'item.xml' },
      { isFile: () => true,  name: 'notes.txt' },
      { isFile: () => false, name: 'subdir' },
    ])
    const result = await listDir('/world/items')
    expect(result).toEqual([
      { name: 'item.xml', path: join('/world/items', 'item.xml') },
    ])
  })

  it('returns empty array when directory does not exist', async () => {
    mockFs.readdir.mockRejectedValue(new Error('ENOENT'))
    const result = await listDir('/missing')
    expect(result).toEqual([])
  })

  it('returns empty array when directory is empty', async () => {
    mockFs.readdir.mockResolvedValue([])
    const result = await listDir('/empty')
    expect(result).toEqual([])
  })
})

// ─── readFile ─────────────────────────────────────────────────────────────────

describe('readFile', () => {
  it('returns file content as string', async () => {
    mockFs.readFile.mockResolvedValue('<Item />')
    const result = await readFile('/path/item.xml')
    expect(mockFs.readFile).toHaveBeenCalledWith('/path/item.xml', 'utf-8')
    expect(result).toBe('<Item />')
  })
})

// ─── writeFile ───────────────────────────────────────────────────────────────

describe('writeFile', () => {
  it('writes content as utf-8', async () => {
    await writeFile('/path/item.xml', '<Item />')
    expect(mockFs.writeFile).toHaveBeenCalledWith('/path/item.xml', '<Item />', 'utf-8')
  })
})

// ─── moveFile ────────────────────────────────────────────────────────────────

describe('moveFile', () => {
  it('moves file and returns success when dest does not exist', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'))
    const result = await moveFile('/src/item.xml', '/dest/item.xml')
    expect(mockFs.rename).toHaveBeenCalledWith('/src/item.xml', '/dest/item.xml')
    expect(result).toEqual({ success: true })
  })

  it('returns conflict when dest already exists', async () => {
    mockFs.access.mockResolvedValue(undefined) // dest exists
    const result = await moveFile('/src/item.xml', '/dest/item.xml')
    expect(mockFs.rename).not.toHaveBeenCalled()
    expect(result).toEqual({ conflict: true })
  })

  it('creates destination directory before moving', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'))
    await moveFile('/src/item.xml', '/dest/subdir/item.xml')
    expect(mockFs.mkdir).toHaveBeenCalledWith('/dest/subdir', { recursive: true })
  })
})

// ─── archiveFile ─────────────────────────────────────────────────────────────

describe('archiveFile', () => {
  it('moves file directly when no conflict in archive dir', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT')) // dest is free
    const result = await archiveFile('/world/items/sword.xml', '/world/_archive')
    expect(mockFs.rename).toHaveBeenCalledWith(
      '/world/items/sword.xml',
      join('/world/_archive', 'sword.xml')
    )
    expect(result).toEqual({ success: true, archivedAs: 'sword.xml' })
  })

  it('appends _1 suffix when filename already exists in archive', async () => {
    mockFs.access
      .mockResolvedValueOnce(undefined)      // sword.xml exists
      .mockRejectedValueOnce(new Error('ENOENT')) // sword_1.xml is free
    const result = await archiveFile('/world/items/sword.xml', '/world/_archive')
    expect(mockFs.rename).toHaveBeenCalledWith(
      '/world/items/sword.xml',
      join('/world/_archive', 'sword_1.xml')
    )
    expect(result).toEqual({ success: true, archivedAs: 'sword_1.xml' })
  })

  it('increments counter until a free name is found', async () => {
    mockFs.access
      .mockResolvedValueOnce(undefined)           // sword.xml exists
      .mockResolvedValueOnce(undefined)           // sword_1.xml exists
      .mockResolvedValueOnce(undefined)           // sword_2.xml exists
      .mockRejectedValueOnce(new Error('ENOENT')) // sword_3.xml is free
    const result = await archiveFile('/world/items/sword.xml', '/world/_archive')
    expect(result).toEqual({ success: true, archivedAs: 'sword_3.xml' })
  })

  it('creates archive directory before moving', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'))
    await archiveFile('/world/items/sword.xml', '/world/_archive')
    expect(mockFs.mkdir).toHaveBeenCalledWith('/world/_archive', { recursive: true })
  })

  it('preserves .xml extension in suffixed name', async () => {
    mockFs.access
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('ENOENT'))
    const result = await archiveFile('/world/items/sword.xml', '/world/_archive')
    expect(result.archivedAs).toMatch(/\.xml$/)
  })
})
