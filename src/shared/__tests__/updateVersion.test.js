// house module: update-check v1 — change it in the template, then port
import { describe, it, expect } from 'vitest'
import {
  MANIFEST_URL,
  describeFailure,
  isNewerVersion,
  parseVersion,
  readManifest,
  trustedUrl
} from '../updateVersion.js'

const PREFIX = 'https://github.com/eriscorp/oghma/releases/'
const URL_170 = 'https://github.com/eriscorp/oghma/releases/tag/v1.7.0'

function manifest(entry, schema = 1) {
  return { schema, apps: { oghma: entry, other: { version: '9.9.9', url: 'https://x/' } } }
}

describe('parseVersion', () => {
  it('reads MAJOR.MINOR.PATCH, with or without a v', () => {
    expect(parseVersion('1.6.0')).toEqual([1, 6, 0])
    expect(parseVersion('v2.13.1')).toEqual([2, 13, 1])
  })

  it('compares a running pre-release by its base version', () => {
    expect(parseVersion('1.7.0-beta.1')).toEqual([1, 7, 0])
  })

  it('rejects anything that is not three numbers', () => {
    for (const bad of ['1.6', '1.6.0.1', '1.x.0', '', 'latest']) {
      expect(parseVersion(bad)).toBeNull()
    }
  })
})

describe('isNewerVersion', () => {
  it('compares numerically, so 2.10.0 beats 2.9.0', () => {
    expect(isNewerVersion('2.9.0', '2.10.0')).toBe(true)
    expect(isNewerVersion('2.10.0', '2.9.0')).toBe(false)
  })

  it('is false for the same version', () => {
    expect(isNewerVersion('1.6.0', '1.6.0')).toBe(false)
  })

  it('does not offer a release with the same base version as a running pre-release', () => {
    expect(isNewerVersion('1.7.0-beta.1', '1.7.0')).toBe(false)
    expect(isNewerVersion('1.7.0-beta.1', '1.7.1')).toBe(true)
  })

  it('treats an unparseable version as "not newer", never as 0', () => {
    // The old template rule read "1.x.0" as 1.0.0, so a garbled entry could
    // announce a false update. A missed update is the safer error.
    expect(isNewerVersion('1.6.0', '1.x.9')).toBe(false)
    expect(isNewerVersion('garbage', '9.9.9')).toBe(false)
  })
})

describe('trustedUrl', () => {
  it('accepts an https URL under the prefix', () => {
    expect(trustedUrl(URL_170, PREFIX)).toBe(URL_170)
  })

  it('resolves dot segments before the prefix check', () => {
    // As raw text this starts with the prefix; a browser opens another repo.
    expect(trustedUrl(`${PREFIX}../../../attacker/repo`, PREFIX)).toBeNull()
  })

  it('rejects another host, http, and junk', () => {
    expect(trustedUrl('https://evil.example/eriscorp/oghma/releases/', PREFIX)).toBeNull()
    expect(trustedUrl('http://github.com/eriscorp/oghma/releases/tag/v1.7.0', PREFIX)).toBeNull()
    expect(trustedUrl('not a url', PREFIX)).toBeNull()
  })

  it('rejects a lookalike repo that shares the prefix text without the slash', () => {
    expect(trustedUrl('https://github.com/eriscorp/oghma-evil/releases/x', PREFIX)).toBeNull()
  })
})

describe('readManifest', () => {
  it('reports a newer version for this app only', () => {
    const r = readManifest(manifest({ version: '1.7.0', url: URL_170 }), 'oghma', PREFIX, '1.6.0')
    expect(r).toEqual({ ok: true, update: { version: '1.7.0', url: URL_170 } })
  })

  it('reports up to date as ok with no update', () => {
    const r = readManifest(manifest({ version: '1.6.0', url: URL_170 }), 'oghma', PREFIX, '1.6.0')
    expect(r).toEqual({ ok: true, update: null })
  })

  it('names a missing entry, rather than calling it up to date', () => {
    // The private-repo silence in a new form: an app whose publish step never ran.
    expect(readManifest(manifest(undefined), 'oghma', PREFIX, '1.6.0')).toEqual({
      ok: false,
      reason: 'no-entry'
    })
  })

  it('refuses a schema it does not know', () => {
    const r = readManifest(
      manifest({ version: '1.7.0', url: URL_170 }, 2),
      'oghma',
      PREFIX,
      '1.6.0'
    )
    expect(r).toEqual({ ok: false, reason: 'malformed' })
  })

  it('refuses malformed shapes', () => {
    for (const data of [null, 'x', 42, { schema: 1 }, { schema: 1, apps: null }]) {
      expect(readManifest(data, 'oghma', PREFIX, '1.6.0')).toEqual({
        ok: false,
        reason: 'malformed'
      })
    }
    const badVersion = manifest({ version: 'v1.7.0', url: URL_170 })
    expect(readManifest(badVersion, 'oghma', PREFIX, '1.6.0')).toEqual({
      ok: false,
      reason: 'malformed'
    })
  })

  it('refuses a newer version whose URL is not under the app prefix', () => {
    const r = readManifest(
      manifest({ version: '9.0.0', url: 'https://evil.example/download' }),
      'oghma',
      PREFIX,
      '1.6.0'
    )
    expect(r).toEqual({ ok: false, reason: 'bad-url' })
  })
})

describe('the house constants', () => {
  it('reads the manifest from the public issue repo over the raw host', () => {
    expect(MANIFEST_URL).toBe(
      'https://raw.githubusercontent.com/hybrasyl/cernunnos/main/versions.json'
    )
  })

  it('has plain words for every failure', () => {
    const reasons = ['offline', 'timeout', 'http', 'malformed', 'no-entry', 'bad-url']
    for (const r of reasons) expect(describeFailure(r)).toMatch(/\.$/)
  })
})
