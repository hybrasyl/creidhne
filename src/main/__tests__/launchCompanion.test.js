import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFs = {
  access: vi.fn()
}

const mockSpawn = vi.fn()

vi.mock('fs', () => ({ promises: mockFs }))
vi.mock('child_process', () => ({ spawn: mockSpawn }))

const { launchCompanion } = await import('../launchCompanion.js')

const makeManager = (taliesinPath) => ({
  load: vi.fn().mockResolvedValue({
    libraries: [],
    activeLibrary: null,
    theme: 'light',
    clientPath: null,
    taliesinPath,
    iconPickerMode: 'vanilla',
    nationCrestPickerMode: 'vanilla'
  })
})

describe('launchCompanion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSpawn.mockReturnValue({ unref: vi.fn() })
    mockFs.access.mockResolvedValue(undefined)
  })

  it('returns false when exePath is empty', async () => {
    const result = await launchCompanion(makeManager('/taliesin/Taliesin.exe'), '')
    expect(result).toBe(false)
    expect(mockSpawn).not.toHaveBeenCalled()
  })

  it('returns false when exePath does not match settings.taliesinPath', async () => {
    const result = await launchCompanion(
      makeManager('/taliesin/Taliesin.exe'),
      '/Downloads/malware.exe'
    )
    expect(result).toBe(false)
    expect(mockSpawn).not.toHaveBeenCalled()
  })

  it('returns false when settings.taliesinPath is null', async () => {
    const result = await launchCompanion(makeManager(null), '/some/path')
    expect(result).toBe(false)
    expect(mockSpawn).not.toHaveBeenCalled()
  })

  it('returns false when match but file is missing', async () => {
    mockFs.access.mockRejectedValueOnce(new Error('ENOENT'))
    const result = await launchCompanion(
      makeManager('/taliesin/Taliesin.exe'),
      '/taliesin/Taliesin.exe'
    )
    expect(result).toBe(false)
    expect(mockSpawn).not.toHaveBeenCalled()
  })

  it('spawns and returns true when match + file exists', async () => {
    const result = await launchCompanion(
      makeManager('/taliesin/Taliesin.exe'),
      '/taliesin/Taliesin.exe'
    )
    expect(result).toBe(true)
    expect(mockSpawn).toHaveBeenCalledWith('/taliesin/Taliesin.exe', [], {
      detached: true,
      stdio: 'ignore'
    })
  })

  it('detaches the spawned process so creidhne can exit independently', async () => {
    const unref = vi.fn()
    mockSpawn.mockReturnValueOnce({ unref })
    await launchCompanion(makeManager('/taliesin/Taliesin.exe'), '/taliesin/Taliesin.exe')
    expect(unref).toHaveBeenCalledOnce()
  })
})
