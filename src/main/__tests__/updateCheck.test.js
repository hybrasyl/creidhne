// house module: update-check v1 — change it in the template, then port
import { describe, it, expect, vi } from 'vitest'
import { checkForUpdate } from '../updateCheck.js'
import { MANIFEST_URL } from '../../shared/updateVersion.js'

// `fetch` is injected, so every branch runs without a network. The interesting
// cases are the failures, and a test that must reach GitHub reaches none of them.
// The manifest rules themselves are in shared/__tests__/updateVersion.test.js.

const PREFIX = 'https://github.com/eriscorp/oghma/releases/'
const OPTS = { currentVersion: '1.6.0', updateKey: 'oghma', releaseUrlPrefix: PREFIX }
const MANIFEST = {
  schema: 1,
  apps: { oghma: { version: '1.7.0', url: `${PREFIX}tag/v1.7.0`, released: 'x' } }
}

function respond(body, ok = true) {
  return vi.fn(async () => ({ ok, json: async () => body }))
}

describe('checkForUpdate', () => {
  it('reads the house manifest, unauthenticated', async () => {
    const fetchImpl = respond(MANIFEST)
    await checkForUpdate({ ...OPTS, fetchImpl })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(MANIFEST_URL)
    expect(init.headers).not.toHaveProperty('Authorization')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('reports a newer version', async () => {
    const r = await checkForUpdate({ ...OPTS, fetchImpl: respond(MANIFEST) })
    expect(r).toEqual({ ok: true, update: { version: '1.7.0', url: `${PREFIX}tag/v1.7.0` } })
  })

  it('reports up to date', async () => {
    const r = await checkForUpdate({
      ...OPTS,
      currentVersion: '1.7.0',
      fetchImpl: respond(MANIFEST)
    })
    expect(r).toEqual({ ok: true, update: null })
  })

  it('names an HTTP failure', async () => {
    expect(await checkForUpdate({ ...OPTS, fetchImpl: respond({}, false) })).toEqual({
      ok: false,
      reason: 'http'
    })
  })

  it('names a body that is not JSON as malformed', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      }
    }))
    expect(await checkForUpdate({ ...OPTS, fetchImpl })).toEqual({ ok: false, reason: 'malformed' })
  })

  it('names a network error as offline', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    expect(await checkForUpdate({ ...OPTS, fetchImpl })).toEqual({ ok: false, reason: 'offline' })
  })

  it('aborts a hung request and names it a timeout', async () => {
    // A fetch that settles only when its signal aborts, as a real one does.
    const fetchImpl = vi.fn(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          )
        })
    )
    expect(await checkForUpdate({ ...OPTS, fetchImpl, timeoutMs: 20 })).toEqual({
      ok: false,
      reason: 'timeout'
    })
  })

  it('names an app with no entry, rather than calling it up to date', async () => {
    const r = await checkForUpdate({ ...OPTS, updateKey: 'balor', fetchImpl: respond(MANIFEST) })
    expect(r).toEqual({ ok: false, reason: 'no-entry' })
  })
})
