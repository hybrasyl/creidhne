import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

const mockFs = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  copyFile: vi.fn(),
  rename: vi.fn()
}

vi.mock('fs', () => ({ promises: mockFs }))

const { createSettingsManager } = await import('../settingsManager.js')

const USER_DATA = '/fake/userData'
const PRIMARY = join(USER_DATA, 'settings.json')
const BACKUP = join(USER_DATA, 'settings.bak.json')
const TMP = join(USER_DATA, 'settings.tmp.json')

const VALID = {
  libraries: ['/lib1'],
  activeLibrary: '/lib1',
  theme: 'hybrasyl',
  clientPath: null,
  iconPickerMode: 'vanilla',
  nationCrestPickerMode: 'vanilla'
}

const DEFAULTS = {
  libraries: [],
  activeLibrary: null,
  theme: 'light',
  clientPath: null,
  iconPickerMode: 'vanilla',
  nationCrestPickerMode: 'vanilla'
}

describe('settingsManager', () => {
  let manager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = createSettingsManager(USER_DATA)
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.writeFile.mockResolvedValue(undefined)
    mockFs.copyFile.mockResolvedValue(undefined)
    mockFs.rename.mockResolvedValue(undefined)
  })

  // ─── load ────────────────────────────────────────────────────────────────────

  describe('load', () => {
    it('returns primary file content when valid', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(VALID))
      const result = await manager.load()
      expect(mockFs.readFile).toHaveBeenCalledWith(PRIMARY, 'utf-8')
      expect(result).toEqual(VALID)
    })

    it('falls back to backup when primary is corrupt JSON', async () => {
      mockFs.readFile
        .mockResolvedValueOnce('{bad json}')
        .mockResolvedValueOnce(JSON.stringify(VALID))
      const result = await manager.load()
      expect(mockFs.readFile).toHaveBeenCalledWith(BACKUP, 'utf-8')
      expect(result).toEqual(VALID)
    })

    it('falls back to backup when primary is missing', async () => {
      mockFs.readFile
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce(JSON.stringify(VALID))
      const result = await manager.load()
      expect(mockFs.readFile).toHaveBeenCalledWith(BACKUP, 'utf-8')
      expect(result).toEqual(VALID)
    })

    it('rewrites primary from backup after fallback', async () => {
      mockFs.readFile
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce(JSON.stringify(VALID))
      await manager.load()
      expect(mockFs.writeFile).toHaveBeenCalledWith(TMP, expect.any(String), 'utf-8')
      expect(mockFs.rename).toHaveBeenCalledWith(TMP, PRIMARY)
    })

    it('returns defaults when both files are unreadable', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'))
      const result = await manager.load()
      expect(result).toEqual(DEFAULTS)
    })

    it('returns defaults when data fails validation (no libraries array)', async () => {
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify({ theme: 'hybrasyl' }))
        .mockRejectedValueOnce(new Error('ENOENT'))
      const result = await manager.load()
      expect(result).toEqual(DEFAULTS)
    })

    it('fills in missing optional fields with defaults', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({ libraries: [] }))
      const result = await manager.load()
      expect(result.activeLibrary).toBeNull()
      expect(result.theme).toBe('light')
    })
  })

  // ─── save ────────────────────────────────────────────────────────────────────

  describe('save', () => {
    it('writes content to tmp file', async () => {
      await manager.save(VALID)
      expect(mockFs.writeFile).toHaveBeenCalledWith(TMP, JSON.stringify(VALID, null, 2), 'utf-8')
    })

    it('copies primary to backup before rename', async () => {
      await manager.save(VALID)
      expect(mockFs.copyFile).toHaveBeenCalledWith(PRIMARY, BACKUP)
    })

    it('renames tmp to primary', async () => {
      await manager.save(VALID)
      expect(mockFs.rename).toHaveBeenCalledWith(TMP, PRIMARY)
    })

    it('still completes if copyFile fails (primary did not exist yet)', async () => {
      mockFs.copyFile.mockRejectedValueOnce(new Error('ENOENT'))
      await expect(manager.save(VALID)).resolves.not.toThrow()
      expect(mockFs.rename).toHaveBeenCalledWith(TMP, PRIMARY)
    })

    it('creates the directory before writing', async () => {
      await manager.save(VALID)
      expect(mockFs.mkdir).toHaveBeenCalledWith(USER_DATA, { recursive: true })
    })
  })
})
