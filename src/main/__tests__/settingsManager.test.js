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
  taliesinPath: null,
  iconPickerMode: 'vanilla',
  nationCrestPickerMode: 'vanilla'
}

const DEFAULTS = {
  libraries: [],
  activeLibrary: null,
  theme: 'light',
  clientPath: null,
  taliesinPath: null,
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

    // Regression guard for the queue-poisoning bug. Without the .then(fn, fn)
    // resilience pattern in save(), a single failed save would leave saveQueue
    // as a rejected promise — and every subsequent .then(handler) call would
    // skip the handler and propagate the rejection, silently dropping all
    // future saves.
    it('queue survives a failed save (next save still runs)', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // First save fails at writeFile; second save's writeFile succeeds.
      mockFs.writeFile
        .mockRejectedValueOnce(new Error('disk full'))
        .mockResolvedValue(undefined)

      await expect(manager.save(VALID)).rejects.toThrow('disk full')
      await expect(manager.save(VALID)).resolves.not.toThrow()

      // Both saves attempted to write — the queue didn't poison.
      expect(mockFs.writeFile).toHaveBeenCalledTimes(2)
      // The failure was logged for diagnostic purposes.
      expect(errSpy).toHaveBeenCalledWith('[settings] save failed:', expect.any(Error))

      errSpy.mockRestore()
    })

    it('serializes concurrent saves in queue order', async () => {
      // Two saves issued back-to-back must complete in order — the second
      // save's writeFile must not run until the first save's renameWithRetry
      // finishes. We assert ordering via the call sequence on writeFile.
      const writeOrder = []
      mockFs.writeFile.mockImplementation(async (_path, content) => {
        writeOrder.push(content)
      })

      const a = { ...VALID, theme: 'first' }
      const b = { ...VALID, theme: 'second' }
      const p1 = manager.save(a)
      const p2 = manager.save(b)
      await Promise.all([p1, p2])

      expect(writeOrder).toEqual([JSON.stringify(a, null, 2), JSON.stringify(b, null, 2)])
    })
  })

  // ─── round-trip tripwire ─────────────────────────────────────────────────────
  // Tripwire for the withDefaults allowlist trap: if a new settings field is
  // added to DEFAULTS but withDefaults forgets to wire it through (or vice
  // versa), this test will fail. Update SAMPLE whenever the Settings shape
  // changes — every field must be set to a non-default value.

  describe('round-trip', () => {
    const SAMPLE = {
      libraries: ['/lib-a', '/lib-b'],
      activeLibrary: '/lib-a',
      theme: 'hybrasyl',
      clientPath: '/client',
      taliesinPath: '/taliesin/Taliesin.exe',
      iconPickerMode: 'hybrasyl',
      nationCrestPickerMode: 'hybrasyl'
    }

    it('preserves every field through save → load', async () => {
      let written
      mockFs.writeFile.mockImplementation(async (_path, content) => {
        written = content
      })
      await manager.save(SAMPLE)
      expect(written).toBeDefined()

      mockFs.readFile.mockResolvedValueOnce(written)
      const loaded = await manager.load()
      expect(loaded).toEqual(SAMPLE)
    })

    it('SAMPLE differs from DEFAULTS on every field', () => {
      for (const key of Object.keys(DEFAULTS)) {
        expect(SAMPLE[key]).not.toEqual(DEFAULTS[key])
      }
      expect(Object.keys(SAMPLE).sort()).toEqual(Object.keys(DEFAULTS).sort())
    })
  })
})
