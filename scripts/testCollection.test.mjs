import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join, dirname, relative, sep } from 'path'
import { fileURLToPath } from 'url'

/**
 * HTOO-126. Every test file must sit where the runner looks for it.
 *
 * `src/shared/externalUrl.test.js` sat beside its source instead of in a `__tests__`
 * directory, so vitest never collected it. **The cost was not a missing test run — it
 * was that nothing said so.** The file looked like a test, `npm test` reported all
 * green, and `externalUrl.js` counted as uncovered source for months. Its assertions
 * turned out to pass, which is the worst case: nobody had any reason to look.
 *
 * The one-line fix is a move. This is the part that stops it recurring, and it is worth
 * having because the failure is invisible by construction: a skipped test cannot report
 * that it was skipped.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Every file under `dir` whose name marks it as a test, recursively. */
function findTestFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) findTestFiles(full, acc)
    else if (/\.test\.(js|jsx|mjs|cjs|ts|tsx)$/.test(entry.name)) acc.push(full)
  }
  return acc
}

/**
 * The collect patterns, read out of `vitest.config.mjs` rather than restated here.
 *
 * Restating them would let the config and this guard drift apart in the exact way the
 * guard exists to prevent — a test asserting yesterday's rule passes while today's
 * rule silently skips a file.
 */
function configuredIncludes() {
  const src = readFileSync(join(repoRoot, 'vitest.config.mjs'), 'utf8')
  const m = /^\s*include:\s*\[([^\]]*)\]/m.exec(src)
  expect(m, 'could not find the test `include` array in vitest.config.mjs').not.toBeNull()
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

describe('test collection', () => {
  it('reads a non-empty include list out of vitest.config.mjs', () => {
    // Guards the guard: a regex that stops matching would make every assertion below
    // vacuous, which is the same silent-pass shape being defended against.
    const includes = configuredIncludes()
    expect(includes.length).toBeGreaterThan(0)
    expect(includes.some((p) => p.startsWith('src/'))).toBe(true)
    expect(includes.some((p) => p.startsWith('scripts/'))).toBe(true)
  })

  it('has every test file under src/ inside a __tests__ directory', () => {
    // The rule `src/**/__tests__/**/*.test.{js,jsx}` encodes. A file outside one is not
    // collected, and nothing reports it.
    const stray = findTestFiles(join(repoRoot, 'src'))
      .map((f) => relative(repoRoot, f))
      .filter((f) => !f.split(sep).includes('__tests__'))
    expect(
      stray,
      'these are never collected — move each into a __tests__ directory beside its source'
    ).toEqual([])
  })

  it('has every test file under scripts/ named *.test.mjs', () => {
    // `scripts/**/*.test.mjs`. A `scripts/foo.test.js` is silently skipped the same way.
    const stray = findTestFiles(join(repoRoot, 'scripts'))
      .map((f) => relative(repoRoot, f))
      .filter((f) => !f.endsWith('.test.mjs'))
    expect(stray, 'these are never collected — rename each to *.test.mjs').toEqual([])
  })

  it('finds the test files it is checking', () => {
    // Second half of guarding the guard. If the walk returned nothing — a bad path, a
    // filter that over-matches — both assertions above pass against an empty list.
    expect(findTestFiles(join(repoRoot, 'src')).length).toBeGreaterThan(20)
    expect(findTestFiles(join(repoRoot, 'scripts')).length).toBeGreaterThan(2)
  })
})
