import { readFileSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { describe, it, expect } from 'vitest'

// Release supply-chain policy (HTOO-683). A compromised action tag or a replaced
// release asset would run with the eSigner secrets and the repository token, so:
//
// 1. Every action is pinned to a full commit SHA, with its version in a comment.
// 2. The workflow default is `contents: read`; only `release` gets write.
// 3. No checkout keeps its credentials.
// 4. The CodeSignTool archive is checked against a pinned SHA-256 before it is
//    expanded, in a step that has no secrets.
//
// Read as raw text, as release-artifacts.test.mjs does, with comments removed.

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKFLOW_DIR = join(REPO_ROOT, '.github', 'workflows')
const files = readdirSync(WORKFLOW_DIR).filter((f) => /\.ya?ml$/.test(f))
const read = (f) => readFileSync(join(WORKFLOW_DIR, f), 'utf8')
const strip = (s) => s.replace(/^\s*#.*$/gm, '')

const release = read('release.yml')
const releaseCode = strip(release)

// The text of a `- name:` step up to the next step or job.
function step(name) {
  const start = releaseCode.indexOf(`- name: ${name}`)
  if (start === -1) return ''
  const rest = releaseCode.slice(start + 1)
  const next = rest.search(/\n\s+- (name|uses):|\n {2}[a-z-]+:\n/)
  return next === -1 ? rest : rest.slice(0, next)
}

describe('release workflow supply-chain policy (HTOO-683)', () => {
  it('reads the workflows', () => {
    // Guard the guard: a moved folder must not pass vacuously.
    expect(files).toContain('release.yml')
  })

  it('pins every action to a full commit SHA with a version comment', () => {
    let count = 0
    for (const f of files) {
      for (const line of read(f).split('\n')) {
        const m = /^\s*(?:- )?uses:\s*(\S+)(.*)$/.exec(line)
        if (!m) continue
        count++
        const [, ref, rest] = m
        if (ref.startsWith('./')) continue
        expect(ref, `${f}: ${line.trim()}`).toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/)
        expect(rest, `${f}: ${line.trim()}`).toMatch(/^\s+# v\d+\.\d+\.\d+/)
      }
    }
    expect(count).toBeGreaterThan(10)
  })

  it('defaults to read, and gives write only to the release job', () => {
    expect(releaseCode).toMatch(/^permissions:\n {2}contents: read\n/m)
    const writes = [...releaseCode.matchAll(/contents: write/g)]
    expect(writes).toHaveLength(1)
    const releaseJob = releaseCode.slice(releaseCode.indexOf('\n  release:\n'))
    expect(releaseJob).toMatch(
      /^ {2}release:\n(?: {4}.*\n)*? {4}permissions:\n {6}contents: write\n/m
    )
  })

  it('keeps no checkout credentials', () => {
    const checkouts = releaseCode.match(
      /uses: actions\/checkout@[^\n]*\n(\s+with:\n(\s{10,}.*\n)*)?/g
    )
    expect(checkouts?.length).toBeGreaterThan(0)
    for (const c of checkouts) expect(c).toContain('persist-credentials: false')
  })

  it('verifies the CodeSignTool archive before it expands it, with no secrets in that step', () => {
    const fetch = step('Fetch and verify CodeSignTool')
    expect(fetch).toMatch(/CODESIGNTOOL_SHA256: '[0-9a-f]{64}'/)
    const hashAt = fetch.indexOf('Get-FileHash -Algorithm SHA256')
    const checkAt = fetch.indexOf('-ne $env:CODESIGNTOOL_SHA256')
    const expandAt = fetch.indexOf('Expand-Archive')
    expect(hashAt).toBeGreaterThan(-1)
    expect(checkAt).toBeGreaterThan(hashAt)
    expect(expandAt).toBeGreaterThan(checkAt)
    expect(fetch).not.toContain('secrets.')
    // The sign step does not download or expand anything itself.
    const sign = step('Sign installer + portable exe')
    expect(sign).toContain('secrets.ES_TOTP_SECRET')
    expect(sign).not.toMatch(/Invoke-WebRequest|Expand-Archive/)
    // And the fetch comes first.
    expect(releaseCode.indexOf('- name: Fetch and verify CodeSignTool')).toBeLessThan(
      releaseCode.indexOf('- name: Sign installer + portable exe')
    )
  })
})
