import { describe, it, expect, vi, beforeEach } from 'vitest'

// Since Electron 44 the main-process clipboard returns a Promise (HTOO-553). The
// issue page tells the user to paste the report, so the browser must not open
// until the write is done. Each case holds the write open and checks the order.

const calls = []
let releaseWrite
vi.mock('electron', () => ({
  clipboard: {
    writeText: vi.fn(() => {
      calls.push('write:start')
      return new Promise((resolve) => {
        releaseWrite = () => {
          calls.push('write:done')
          resolve()
        }
      })
    })
  },
  shell: { openExternal: vi.fn(() => calls.push('openExternal')) }
}))
vi.mock('../sessionLog.js', () => ({ getRecentErrors: () => [] }))

const { openIssue, copyReport } = await import('../diagnostics.js')

beforeEach(() => {
  calls.length = 0
})

describe('diagnostics clipboard', () => {
  it('opens the issue page only after the report is on the clipboard', async () => {
    const done = openIssue({ title: 'T', body: 'report body' })
    await Promise.resolve()
    expect(calls).toEqual(['write:start'])
    releaseWrite()
    await expect(done).resolves.toMatchObject({ ok: true })
    expect(calls).toEqual(['write:start', 'write:done', 'openExternal'])
  })

  it('reports Copy as done only after the write', async () => {
    let settled = false
    const done = copyReport({ body: 'report body' }).then((r) => {
      settled = true
      return r
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    releaseWrite()
    await expect(done).resolves.toEqual({ ok: true })
  })
})
