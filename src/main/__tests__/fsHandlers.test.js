import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

const mockFs = {
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
  rename: vi.fn()
}

vi.mock('fs', () => ({ promises: mockFs }))

// listSection delegates to the index package — the single definition of which
// files belong to a section. Mock at that boundary: these tests pin the
// delegation and the shape Creidhne adds on top, not hybindex's own walk
// (which has its own suite in that repo).
const mockListSectionFiles = vi.fn()
vi.mock('@eriscorp/hybindex-ts', () => ({
  listSectionFiles: (...a) => mockListSectionFiles(...a)
}))

const {
  listSection,
  readFile,
  writeFile,
  moveFile,
  archiveFile,
  archiveFiles,
  unarchiveFiles,
  duplicateFile,
  readBinaryFile,
  checkClientPath,
  KNOWN_DAT_FILES
} = await import('../fsHandlers.js')

beforeEach(() => {
  vi.clearAllMocks()
  mockFs.mkdir.mockResolvedValue(undefined)
  mockFs.rename.mockResolvedValue(undefined)
  mockFs.writeFile.mockResolvedValue(undefined)
})

// ─── listSection ─────────────────────────────────────────────────────────────

describe('listSection', () => {
  it('delegates to listSectionFiles with the library path and type', async () => {
    mockListSectionFiles.mockResolvedValue({ dir: '/world/castables', active: [], archived: [] })
    await listSection('/world', 'castables')
    expect(mockListSectionFiles).toHaveBeenCalledWith('/world', 'castables')
  })

  it('passes through the recursive active/archived split', async () => {
    mockListSectionFiles.mockResolvedValue({
      dir: '/world/castables',
      active: ['blast.xml', 'universal/dachaidh.xml'],
      archived: ['.ignore/old.xml', '.ignore/Deprecated/older.xml']
    })
    const r = await listSection('/world', 'castables')
    expect(r.active).toEqual(['blast.xml', 'universal/dachaidh.xml'])
    expect(r.archived).toEqual(['.ignore/old.xml', '.ignore/Deprecated/older.xml'])
  })

  it('never reports archived files as active', async () => {
    mockListSectionFiles.mockResolvedValue({
      dir: '/world/castables',
      active: ['blast.xml'],
      archived: ['.ignore/old.xml']
    })
    const { active } = await listSection('/world', 'castables')
    expect(active.some((rel) => rel.startsWith('.ignore/'))).toBe(false)
  })

  // Renderer paths are built as `${dir}/${rel}`. The pages construct save paths
  // with forward slashes, so a native-separator `dir` would make
  // `selectedFile.path === file.path` silently false and drop the selection
  // highlight after a rename.
  it('normalizes dir to forward slashes', async () => {
    mockListSectionFiles.mockResolvedValue({
      dir: 'E:\\world\\xml\\castables',
      active: [],
      archived: []
    })
    const { dir } = await listSection('E:\\world\\xml', 'castables')
    expect(dir).toBe('E:/world/xml/castables')
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

// ─── readBinaryFile ──────────────────────────────────────────────────────────

describe('readBinaryFile', () => {
  it('reads without utf-8 encoding (raw bytes)', async () => {
    const buf = Buffer.from([0x00, 0x01, 0xff, 0xaa])
    mockFs.readFile.mockResolvedValue(buf)
    const result = await readBinaryFile('/path/blob.dat')
    expect(mockFs.readFile).toHaveBeenCalledWith('/path/blob.dat')
    expect(result).toBe(buf)
  })
})

// ─── checkClientPath ─────────────────────────────────────────────────────────

describe('checkClientPath', () => {
  it('returns gray status when clientPath is null or empty', async () => {
    const a = await checkClientPath(null)
    const b = await checkClientPath('')
    const c = await checkClientPath(undefined)
    expect(a).toEqual({ status: 'gray', files: [] })
    expect(b).toEqual({ status: 'gray', files: [] })
    expect(c).toEqual({ status: 'gray', files: [] })
  })

  it('returns red when no expected files exist', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'))
    const result = await checkClientPath('/not/da/client')
    expect(result.status).toBe('red')
    expect(result.files.length).toBe(KNOWN_DAT_FILES.length)
    expect(result.files.every((f) => !f.found)).toBe(true)
  })

  it('returns green when every expected file exists', async () => {
    mockFs.access.mockResolvedValue(undefined) // every access succeeds
    const result = await checkClientPath('/real/da/client')
    expect(result.status).toBe('green')
    expect(result.files.every((f) => f.found)).toBe(true)
  })

  it('returns yellow when some files exist and some are missing', async () => {
    // First file present, the rest missing
    mockFs.access.mockImplementation((path) =>
      path.endsWith(KNOWN_DAT_FILES[0].rel.replace(/\\/g, '/')) ||
      path.endsWith(KNOWN_DAT_FILES[0].rel)
        ? Promise.resolve()
        : Promise.reject(new Error('ENOENT'))
    )
    const result = await checkClientPath('/partial/client')
    expect(result.status).toBe('yellow')
    expect(result.files.some((f) => f.found)).toBe(true)
    expect(result.files.some((f) => !f.found)).toBe(true)
  })

  it('returns a file entry per KNOWN_DAT_FILES with rel, category, and found', async () => {
    mockFs.access.mockResolvedValue(undefined)
    const result = await checkClientPath('/client')
    for (const f of result.files) {
      expect(f).toHaveProperty('rel')
      expect(f).toHaveProperty('category')
      expect(f).toHaveProperty('found')
    }
  })
})

// ─── archiveFile ─────────────────────────────────────────────────────────────

describe('archiveFile', () => {
  it('moves file directly when no conflict in archive dir', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT')) // dest is free
    const result = await archiveFile('/world/items/sword.xml', '/world/items/.ignore')
    expect(mockFs.rename).toHaveBeenCalledWith(
      '/world/items/sword.xml',
      join('/world/items/.ignore', 'sword.xml')
    )
    expect(result).toEqual({ success: true, archivedAs: 'sword.xml' })
  })

  it('appends _1 suffix when filename already exists in archive', async () => {
    mockFs.access
      .mockResolvedValueOnce(undefined) // sword.xml exists
      .mockRejectedValueOnce(new Error('ENOENT')) // sword_1.xml is free
    const result = await archiveFile('/world/items/sword.xml', '/world/items/.ignore')
    expect(mockFs.rename).toHaveBeenCalledWith(
      '/world/items/sword.xml',
      join('/world/items/.ignore', 'sword_1.xml')
    )
    expect(result).toEqual({ success: true, archivedAs: 'sword_1.xml' })
  })

  it('increments counter until a free name is found', async () => {
    mockFs.access
      .mockResolvedValueOnce(undefined) // sword.xml exists
      .mockResolvedValueOnce(undefined) // sword_1.xml exists
      .mockResolvedValueOnce(undefined) // sword_2.xml exists
      .mockRejectedValueOnce(new Error('ENOENT')) // sword_3.xml is free
    const result = await archiveFile('/world/items/sword.xml', '/world/items/.ignore')
    expect(result).toEqual({ success: true, archivedAs: 'sword_3.xml' })
  })

  it('creates archive directory before moving', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'))
    await archiveFile('/world/items/sword.xml', '/world/items/.ignore')
    expect(mockFs.mkdir).toHaveBeenCalledWith('/world/items/.ignore', { recursive: true })
  })

  it('preserves .xml extension in suffixed name', async () => {
    mockFs.access.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('ENOENT'))
    const result = await archiveFile('/world/items/sword.xml', '/world/items/.ignore')
    expect(result.archivedAs).toMatch(/\.xml$/)
  })
})

// ─── archiveFiles (bulk) ─────────────────────────────────────────────────────

describe('archiveFiles', () => {
  it('archives every src and aggregates ok results', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT')) // every dest free
    const result = await archiveFiles(
      ['/world/items/a.xml', '/world/items/b.xml'],
      '/world/items/.ignore'
    )
    expect(result.failed).toEqual([])
    expect(result.ok).toEqual([
      { src: '/world/items/a.xml', archivedAs: 'a.xml' },
      { src: '/world/items/b.xml', archivedAs: 'b.xml' }
    ])
    expect(mockFs.rename).toHaveBeenCalledTimes(2)
  })

  it('records failure without aborting the rest of the batch', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'))
    mockFs.rename.mockRejectedValueOnce(new Error('boom on first')).mockResolvedValueOnce(undefined)
    const result = await archiveFiles(
      ['/world/items/a.xml', '/world/items/b.xml'],
      '/world/items/.ignore'
    )
    expect(result.ok).toEqual([{ src: '/world/items/b.xml', archivedAs: 'b.xml' }])
    expect(result.failed).toEqual([{ src: '/world/items/a.xml', reason: 'boom on first' }])
  })

  it('handles empty src list as no-op', async () => {
    const result = await archiveFiles([], '/world/items/.ignore')
    expect(result).toEqual({ ok: [], failed: [] })
    expect(mockFs.rename).not.toHaveBeenCalled()
  })
})

// ─── unarchiveFiles (bulk) ───────────────────────────────────────────────────

// ─── Archive/unarchive subfolder mirroring ───────────────────────────────────
//
// Subfolders are authored in git, not in the app — but the app must not undo
// them. These pin the round-trip: a file archived out of `universal/` comes
// back to `universal/`, and two same-named files in different subfolders no
// longer collide into one archive slot.

describe('archiveFile: subfolder mirroring', () => {
  it('mirrors the subfolder into the archive', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'))
    const result = await archiveFile(
      '/world/castables/universal/dachaidh.xml',
      '/world/castables/.ignore'
    )
    expect(mockFs.rename).toHaveBeenCalledWith(
      '/world/castables/universal/dachaidh.xml',
      join('/world/castables/.ignore/universal', 'dachaidh.xml')
    )
    expect(result.archivedAs).toBe('universal/dachaidh.xml')
  })

  it('creates the mirrored archive subdirectory', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'))
    await archiveFile('/world/castables/universal/x.xml', '/world/castables/.ignore')
    expect(mockFs.mkdir).toHaveBeenCalledWith(join('/world/castables/.ignore', 'universal'), {
      recursive: true
    })
  })

  it('keeps same-named files in different subfolders from colliding', async () => {
    // Flattening sent both to .ignore/blast.xml, silently renaming one to
    // blast_1.xml. Mirrored, each keeps its own name under its own folder.
    mockFs.access.mockRejectedValue(new Error('ENOENT'))
    const fire = await archiveFile('/world/castables/fire/blast.xml', '/world/castables/.ignore')
    const ice = await archiveFile('/world/castables/ice/blast.xml', '/world/castables/.ignore')
    expect(fire.archivedAs).toBe('fire/blast.xml')
    expect(ice.archivedAs).toBe('ice/blast.xml')
  })

  it('archives a type-root file flat, exactly as before', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'))
    const result = await archiveFile('/world/castables/blast.xml', '/world/castables/.ignore')
    expect(mockFs.rename).toHaveBeenCalledWith(
      '/world/castables/blast.xml',
      join('/world/castables/.ignore', 'blast.xml')
    )
    expect(result.archivedAs).toBe('blast.xml')
  })

  it('still suffixes on collision within a mirrored subfolder', async () => {
    mockFs.access
      .mockResolvedValueOnce(undefined) // universal/x.xml taken
      .mockRejectedValueOnce(new Error('ENOENT')) // universal/x_1.xml free
    const result = await archiveFile('/world/castables/universal/x.xml', '/world/castables/.ignore')
    expect(result.archivedAs).toBe('universal/x_1.xml')
  })
})

describe('unarchiveFiles: subfolder mirroring', () => {
  it('restores a mirrored file to its original subfolder', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'))
    const result = await unarchiveFiles(
      ['/world/castables/.ignore/universal/dachaidh.xml'],
      '/world/castables'
    )
    expect(result.ok).toEqual([
      {
        src: '/world/castables/.ignore/universal/dachaidh.xml',
        dest: join('/world/castables', 'universal/dachaidh.xml')
      }
    ])
  })

  it('restores nested archive folders (e.g. Deprecated Spawngroups)', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'))
    const result = await unarchiveFiles(
      ['/world/spawngroups/.ignore/Deprecated Spawngroups/old.xml'],
      '/world/spawngroups'
    )
    expect(result.ok[0].dest).toBe(join('/world/spawngroups', 'Deprecated Spawngroups/old.xml'))
  })

  it('restores a flat archived file to the type root', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'))
    const result = await unarchiveFiles(['/world/castables/.ignore/old.xml'], '/world/castables')
    expect(result.ok[0].dest).toBe(join('/world/castables', 'old.xml'))
  })
})

describe('unarchiveFiles', () => {
  it('moves each src back to destDir using its basename', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT')) // every dest free
    const result = await unarchiveFiles(
      ['/world/items/.ignore/a.xml', '/world/items/.ignore/b.xml'],
      '/world/items'
    )
    expect(result.failed).toEqual([])
    expect(result.ok).toEqual([
      { src: '/world/items/.ignore/a.xml', dest: join('/world/items', 'a.xml') },
      { src: '/world/items/.ignore/b.xml', dest: join('/world/items', 'b.xml') }
    ])
  })

  it('records conflict without overwriting', async () => {
    mockFs.access
      .mockResolvedValueOnce(undefined) // a.xml dest exists → conflict
      .mockRejectedValueOnce(new Error('ENOENT')) // b.xml dest free
    const result = await unarchiveFiles(
      ['/world/items/.ignore/a.xml', '/world/items/.ignore/b.xml'],
      '/world/items'
    )
    expect(result.failed).toEqual([{ src: '/world/items/.ignore/a.xml', reason: 'conflict' }])
    expect(result.ok).toEqual([
      { src: '/world/items/.ignore/b.xml', dest: join('/world/items', 'b.xml') }
    ])
  })

  it('handles empty src list as no-op', async () => {
    const result = await unarchiveFiles([], '/world/items')
    expect(result).toEqual({ ok: [], failed: [] })
  })
})

// ─── duplicateFile ───────────────────────────────────────────────────────────

describe('duplicateFile', () => {
  it('writes a "_copy" sibling when no collision', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'))
    mockFs.readFile.mockResolvedValueOnce('<Item />')
    const result = await duplicateFile('/world/items/sword.xml')
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      join('/world/items', 'sword_copy.xml'),
      '<Item />'
    )
    expect(result).toEqual({
      success: true,
      duplicateAs: 'sword_copy.xml',
      dest: join('/world/items', 'sword_copy.xml')
    })
  })

  it('appends incrementing counter on collision', async () => {
    mockFs.access
      .mockResolvedValueOnce(undefined) // sword_copy.xml exists
      .mockResolvedValueOnce(undefined) // sword_copy_2.xml exists
      .mockRejectedValueOnce(new Error('ENOENT')) // sword_copy_3.xml is free
    mockFs.readFile.mockResolvedValueOnce('<Item />')
    const result = await duplicateFile('/world/items/sword.xml')
    expect(result.duplicateAs).toBe('sword_copy_3.xml')
  })

  it('preserves .xml extension', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'))
    mockFs.readFile.mockResolvedValueOnce('<X/>')
    const result = await duplicateFile('/world/items/blade.xml')
    expect(result.duplicateAs).toMatch(/\.xml$/)
  })
})
