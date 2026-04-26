import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'
import { z } from 'zod'

const mockFs = {
  stat: vi.fn(),
  rename: vi.fn(),
  mkdir: vi.fn(),
  appendFile: vi.fn()
}

vi.mock('fs', () => ({ promises: mockFs }))

const { parseOrLog } = await import('../schemaLog.js')

const ctx = { settingsPath: '/fake/userData' }
const schema = z.object({ name: z.string() })

beforeEach(() => {
  vi.clearAllMocks()
  mockFs.mkdir.mockResolvedValue(undefined)
  mockFs.appendFile.mockResolvedValue(undefined)
  mockFs.stat.mockRejectedValue(new Error('ENOENT'))
})

describe('parseOrLog', () => {
  it('returns parsed data on a valid payload', () => {
    const result = parseOrLog(ctx, 'test:save', schema, { name: 'foo' })
    expect(result).toEqual({ name: 'foo' })
  })

  it('does not log anything on success', () => {
    parseOrLog(ctx, 'test:save', schema, { name: 'foo' })
    expect(mockFs.appendFile).not.toHaveBeenCalled()
  })

  it('throws with channel and field path on failure', () => {
    expect(() => parseOrLog(ctx, 'test:save', schema, { name: 42 })).toThrow(
      /Invalid test:save payload.*name/
    )
  })

  it('appends a breadcrumb to ipc-validation.log on failure', async () => {
    try {
      parseOrLog(ctx, 'test:save', schema, { name: 42 })
    } catch {
      /* expected */
    }
    // Logging is fire-and-forget; let the microtask drain.
    await new Promise((r) => setImmediate(r))
    expect(mockFs.appendFile).toHaveBeenCalledOnce()
    const [path, line] = mockFs.appendFile.mock.calls[0]
    expect(path).toBe(join('/fake/userData', 'ipc-validation.log'))
    expect(line).toMatch(/test:save .*name/)
  })

  it('rotates the log when it exceeds 256KB', async () => {
    mockFs.stat.mockResolvedValueOnce({ size: 300 * 1024 })
    mockFs.rename.mockResolvedValueOnce(undefined)
    try {
      parseOrLog(ctx, 'test:save', schema, { name: 42 })
    } catch {
      /* expected */
    }
    await new Promise((r) => setImmediate(r))
    const logPath = join('/fake/userData', 'ipc-validation.log')
    expect(mockFs.rename).toHaveBeenCalledWith(logPath, `${logPath}.1`)
  })

  it('swallows logging failures so the IPC error is not blocked', async () => {
    mockFs.appendFile.mockRejectedValueOnce(new Error('disk full'))
    expect(() => parseOrLog(ctx, 'test:save', schema, { name: 42 })).toThrow(/Invalid test:save/)
    // The throw happens synchronously regardless of the appendFile failure.
  })
})
