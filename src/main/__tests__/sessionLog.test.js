import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

const mockFs = {
  readdir: vi.fn(),
  unlink: vi.fn(),
  mkdir: vi.fn(),
  appendFile: vi.fn()
}
vi.mock('fs', () => ({ promises: mockFs }))

const mockOs = {
  homedir: vi.fn(() => 'C:\\Users\\bob'),
  userInfo: vi.fn(() => ({ username: 'bob' }))
}
vi.mock('os', () => ({ default: mockOs, ...mockOs }))

const { initSessionLog, captureError, getRecentErrors, _resetForTests } =
  await import('../sessionLog.js')

const LOGS = '/fake/logs'

beforeEach(() => {
  vi.clearAllMocks()
  mockFs.mkdir.mockResolvedValue(undefined)
  mockFs.appendFile.mockResolvedValue(undefined)
  mockFs.unlink.mockResolvedValue(undefined)
  mockFs.readdir.mockResolvedValue([])
  _resetForTests()
})

const drain = () => new Promise((r) => setImmediate(r))

describe('initSessionLog rotation', () => {
  it('keeps exactly 5 session files, unlinking the oldest', async () => {
    // Simulate 8 existing session files (sortable by name).
    const existing = [
      'session-20260101-000000-000.log',
      'session-20260102-000000-000.log',
      'session-20260103-000000-000.log',
      'session-20260104-000000-000.log',
      'session-20260105-000000-000.log',
      'session-20260106-000000-000.log',
      'session-20260107-000000-000.log',
      'session-20260108-000000-000.log'
    ]
    mockFs.readdir.mockResolvedValue([...existing, 'settings.json', 'not-a-session.txt'])

    await initSessionLog(LOGS)

    // 8 sessions - keep 5 = unlink the 3 oldest.
    expect(mockFs.unlink).toHaveBeenCalledTimes(3)
    expect(mockFs.unlink).toHaveBeenCalledWith(join(LOGS, existing[0]))
    expect(mockFs.unlink).toHaveBeenCalledWith(join(LOGS, existing[1]))
    expect(mockFs.unlink).toHaveBeenCalledWith(join(LOGS, existing[2]))
    // Non-session files are never touched.
    expect(mockFs.unlink).not.toHaveBeenCalledWith(join(LOGS, 'settings.json'))
  })

  it('unlinks nothing when 5 or fewer sessions exist', async () => {
    mockFs.readdir.mockResolvedValue([
      'session-20260101-000000-000.log',
      'session-20260102-000000-000.log'
    ])
    await initSessionLog(LOGS)
    expect(mockFs.unlink).not.toHaveBeenCalled()
  })
})

describe('captureError', () => {
  it('scrubs a path before appending to disk', async () => {
    await initSessionLog(LOGS)
    mockFs.appendFile.mockClear()

    captureError({
      source: 'react',
      origin: 'renderer',
      message: 'failed reading C:\\Users\\bob\\world\\items\\Foo.xml'
    })
    await drain()

    expect(mockFs.appendFile).toHaveBeenCalledOnce()
    const [, line] = mockFs.appendFile.mock.calls[0]
    expect(line).toContain('…\\Foo.xml')
    expect(line).not.toContain('bob')
    expect(line).not.toContain('world')
  })

  it('caps the in-memory ring buffer at 20', () => {
    for (let i = 0; i < 30; i++) {
      captureError({ source: 'error', origin: 'main', message: `e${i}` })
    }
    const recent = getRecentErrors()
    expect(recent).toHaveLength(20)
    // Oldest dropped, newest retained.
    expect(recent[recent.length - 1].message).toBe('e29')
    expect(recent[0].message).toBe('e10')
  })

  it('swallows append failures without throwing', async () => {
    await initSessionLog(LOGS)
    mockFs.appendFile.mockRejectedValue(new Error('disk full'))
    expect(() => captureError({ message: 'boom' })).not.toThrow()
    await drain()
  })
})
