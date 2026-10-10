// house module: update-check v1 — change it in the template, then port
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isNewer, parseTag, publish, readUpdateKey, updateManifest } from './publish-version.mjs'
import { isNewerVersion } from '../src/shared/updateVersion'

const SEED = {
  schema: 1,
  apps: {
    alpha: { version: '1.0.0', released: '2026-01-01T00:00:00Z', url: 'https://x/alpha' },
    zeta: { version: '3.0.0', released: '2026-01-01T00:00:00Z', url: 'https://x/zeta' }
  }
}
const seedText = JSON.stringify(SEED, null, 2) + '\n'
const ENTRY = { version: '1.7.0', released: '2026-09-28T00:00:00Z', url: 'https://x/mine' }

describe('parseTag', () => {
  it('accepts vX.Y.Z only', () => {
    expect(parseTag('v1.7.0')).toBe('1.7.0')
    for (const bad of ['1.7.0', 'v1.7', 'v1.7.0-beta.1', undefined])
      expect(parseTag(bad)).toBeNull()
  })
})

describe('isNewer', () => {
  it('agrees with the app-side rule in src/shared/updateVersion', () => {
    // Two copies of one rule, in two languages. This pins them together.
    const cases = [
      ['1.6.0', '1.7.0'],
      ['2.9.0', '2.10.0'],
      ['1.7.0', '1.7.0'],
      ['1.7.0', '1.6.9'],
      ['1.x.0', '9.9.9']
    ]
    for (const [a, b] of cases) expect(isNewer(a, b)).toBe(isNewerVersion(a, b))
  })
})

describe('readUpdateKey', () => {
  it('reads the key from appIdentity source', () => {
    expect(readUpdateKey("  updateKey: 'oghma',\n")).toBe('oghma')
  })

  it('reads the real appIdentity', () => {
    // Checks the file's own literal, not a name typed here, so this file copies
    // to every app unchanged (HTOO-516). What it guards is that readUpdateKey
    // works on the real source, not on a string in a test.
    // The same (ts|js) lookup as publish(), so a JavaScript app (creidhne, epona)
    // runs this file unchanged too.
    const identity = ['appIdentity.ts', 'appIdentity.js']
      .map((f) => join(import.meta.dirname, '..', 'src', 'shared', f))
      .find((f) => existsSync(f))
    const src = readFileSync(identity, 'utf8')
    const key = readUpdateKey(src)
    expect(key).toMatch(/^[a-z0-9-]+$/)
    expect(src).toMatch(new RegExp(`updateKey:\\s*['"]${key}['"]`))
  })

  it('fails without one', () => {
    expect(() => readUpdateKey('export const x = 1')).toThrow(/no updateKey/)
  })
})

describe('updateManifest', () => {
  it('adds a new key in sorted order and keeps every other key as read', () => {
    const out = updateManifest(seedText, 'mid', ENTRY)
    const data = JSON.parse(out)
    expect(Object.keys(data.apps)).toEqual(['alpha', 'mid', 'zeta'])
    expect(data.apps.alpha).toEqual(SEED.apps.alpha)
    expect(data.apps.zeta).toEqual(SEED.apps.zeta)
    expect(out.endsWith('}\n')).toBe(true)
  })

  it('changes only one app’s lines', () => {
    const before = updateManifest(seedText, 'mid', ENTRY).split('\n')
    const after = updateManifest(before.join('\n'), 'mid', { ...ENTRY, version: '1.8.0' }).split(
      '\n'
    )
    const changed = after.filter((line, i) => line !== before[i])
    expect(changed).toEqual(['      "version": "1.8.0",'])
  })

  it('never goes backwards, and refuses the same version twice', () => {
    expect(() => updateManifest(seedText, 'zeta', { ...ENTRY, version: '2.9.9' })).toThrow(
      /not newer/
    )
    expect(() => updateManifest(seedText, 'zeta', { ...ENTRY, version: '3.0.0' })).toThrow(
      /not newer/
    )
  })

  it('refuses a file that is not schema 1', () => {
    expect(() => updateManifest('{"schema":2,"apps":{}}', 'x', ENTRY)).toThrow(/schema 1/)
  })
})

// The git step, against a fake git (HTOO-516). `publish()` takes `git` the way
// it takes `release`, and `git(cwd, ...args)` is the only thing in it that
// starts a process. So these tests start none: the fake records each call and
// answers from a script. Before, this block ran real repos (a bare origin and
// two clones), about 8 git processes to set up and more in each test. Under a
// loaded full suite that passed 30 s, and then 120 s was needed, and the
// pre-push hook still failed on it. The git commands are plain (`rev-parse`,
// `status`, `pull --ff-only`, `commit -- versions.json`, `push`), so the order
// and the arguments are what to check.
//
// The checkout is still a real temp folder: `versions.json` and `.git` are
// plain files, and reading and writing them starts no process.

/**
 * A fake `git(cwd, ...args)`. `answers` maps a subcommand to its output, or to a
 * function that returns it or throws. Every call is recorded in `calls`.
 */
function fakeGit(answers = {}) {
  const calls = []
  const answer = { 'rev-parse': 'main', status: '', ...answers }
  const git = (cwd, ...args) => {
    calls.push({ cwd, args })
    const a = answer[args[0]]
    return typeof a === 'function' ? a(args) : (a ?? '')
  }
  return { git, calls, commands: () => calls.map((c) => c.args.join(' ')) }
}

/** A push that is rejected `times` times, then succeeds. */
const pushRejected = (times) => {
  let left = times
  return () => {
    if (left-- > 0) throw new Error('! [rejected] main -> main (fetch first)')
    return ''
  }
}

describe('publish', () => {
  let root
  let app
  let cernunnos

  const release = (tag) => ({
    tagName: tag,
    url: `https://github.com/x/app/releases/tag/${tag}`,
    publishedAt: '2026-09-28T12:00:00Z',
    isDraft: false,
    isPrerelease: false
  })
  const manifest = () => readFileSync(join(cernunnos, 'versions.json'), 'utf8')

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'publish-version-'))
    app = join(root, 'app')
    cernunnos = join(root, 'cernunnos')
    mkdirSync(join(app, 'src', 'shared'), { recursive: true })
    writeFileSync(join(app, 'package.json'), JSON.stringify({ version: '1.7.0' }))
    writeFileSync(
      join(app, 'src', 'shared', 'appIdentity.ts'),
      "export const a = { updateKey: 'mid' }\n"
    )
    mkdirSync(join(cernunnos, '.git'), { recursive: true })
    writeFileSync(join(cernunnos, 'versions.json'), seedText)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const run = (fake, extra = {}) =>
    publish({
      tag: 'v1.7.0',
      repoRoot: app,
      cernunnos,
      release,
      git: fake.git,
      log: () => {},
      ...extra
    })

  it('commits and pushes this app’s entry only', () => {
    const fake = fakeGit()
    expect(run(fake)).toEqual({ key: 'mid', version: '1.7.0', pushed: true })
    expect(fake.commands()).toEqual([
      'rev-parse --abbrev-ref HEAD',
      'status --porcelain',
      'pull --ff-only --quiet',
      'commit --quiet -m versions: mid 1.7.0 -- versions.json',
      'push --quiet'
    ])
    expect(fake.calls.every((c) => c.cwd === cernunnos)).toBe(true)
    const data = JSON.parse(manifest())
    expect(data.apps.mid).toEqual({
      version: '1.7.0',
      released: '2026-09-28T12:00:00Z',
      url: 'https://github.com/x/app/releases/tag/v1.7.0'
    })
    expect(data.apps.alpha).toEqual(SEED.apps.alpha)
    expect(data.apps.zeta).toEqual(SEED.apps.zeta)
  })

  it('reads the manifest after the pull, not before it', () => {
    // Another app's release can land between our last pull and this one. The
    // entry must be added to the file the pull brought, or it would be lost.
    const theirs =
      JSON.stringify(
        { ...SEED, apps: { ...SEED.apps, alpha: { ...SEED.apps.alpha, version: '1.1.0' } } },
        null,
        2
      ) + '\n'
    const fake = fakeGit({ pull: () => writeFileSync(join(cernunnos, 'versions.json'), theirs) })
    run(fake)
    const data = JSON.parse(manifest())
    expect(data.apps.alpha.version).toBe('1.1.0')
    expect(data.apps.mid.version).toBe('1.7.0')
  })

  it('a dry run makes no commit and no push, and writes nothing', () => {
    const fake = fakeGit()
    expect(run(fake, { dryRun: true }).pushed).toBe(false)
    expect(fake.commands().some((c) => /^(commit|push)/.test(c))).toBe(false)
    expect(manifest()).toBe(seedText)
  })

  it('after a rejected push, pulls with a rebase and pushes once more', () => {
    const fake = fakeGit({ push: pushRejected(1) })
    expect(run(fake).pushed).toBe(true)
    expect(fake.commands().slice(-3)).toEqual([
      'push --quiet',
      'pull --rebase --quiet',
      'push --quiet'
    ])
  })

  it('throws when the second push is rejected too, and does not try a third', () => {
    const fake = fakeGit({ push: pushRejected(2) })
    expect(() => run(fake)).toThrow(/rejected/)
    expect(fake.commands().filter((c) => c.startsWith('push'))).toHaveLength(2)
  })

  it('refuses a cernunnos checkout that is not on main', () => {
    const fake = fakeGit({ 'rev-parse': 'feature' })
    expect(() => run(fake)).toThrow(/on feature, not main/)
    expect(fake.commands()).toEqual(['rev-parse --abbrev-ref HEAD'])
  })

  it('refuses a dirty cernunnos checkout: that work is someone else’s', () => {
    const fake = fakeGit({ status: ' M README.md' })
    expect(() => run(fake)).toThrow(/uncommitted changes/)
    expect(fake.commands().some((c) => /^(pull|commit|push)/.test(c))).toBe(false)
    expect(manifest()).toBe(seedText)
  })

  it('refuses a folder that is not a git checkout, before any git call', () => {
    rmSync(join(cernunnos, '.git'), { recursive: true })
    const fake = fakeGit()
    expect(() => run(fake)).toThrow(/no git checkout/)
    expect(fake.calls).toHaveLength(0)
  })

  it('refuses a release that is not published as stable', () => {
    const fake = fakeGit()
    expect(() => run(fake, { release: (t) => ({ ...release(t), isDraft: true }) })).toThrow(
      /not published/
    )
    expect(() => run(fake, { release: (t) => ({ ...release(t), isPrerelease: true }) })).toThrow(
      /not published/
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('refuses a tag that is not a stable release tag', () => {
    expect(() => run(fakeGit(), { tag: 'v1.7.0-beta.1' })).toThrow(/not a stable release tag/)
  })

  it('refuses a tag that does not match package.json', () => {
    expect(() => run(fakeGit(), { tag: 'v1.8.0' })).toThrow(/does not match package.json/)
  })

  it('refuses to publish the same version twice', () => {
    run(fakeGit())
    const fake = fakeGit()
    expect(() => run(fake)).toThrow(/not newer/)
    expect(fake.commands().some((c) => /^(commit|push)/.test(c))).toBe(false)
  })
})
