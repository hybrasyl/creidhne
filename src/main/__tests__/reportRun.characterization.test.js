import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { runCastableExport } from '../reportRun.js'
import { makeCastableLibrary, CASTABLE_TRAINERS } from './helpers/castableFixtures.js'

// WP1 reshapes both castable exports onto one canonical record. These goldens
// freeze what they produce today, so the refactor has to prove it changed
// nothing — and so the four agreed output changes show up as a reviewable diff
// of exactly those four things and nothing else.
//
// Goldens are checked-in files rather than vitest snapshots on purpose: a .snap
// is silently rewritten by `vitest -u`, which is precisely the accident this
// test exists to catch. To regenerate deliberately:
//
//   UPDATE_EXPORT_GOLDENS=1 npx vitest run exportCastables.characterization
//
// then read the diff before staging it. `.gitattributes` marks *.golden.csv as
// -text: both exporters join rows with \r\n and this compares bytes.

const FIXTURE_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'export')
const UPDATING = process.env.UPDATE_EXPORT_GOLDENS === '1'

function checkGolden(name, actual) {
  const path = join(FIXTURE_DIR, name)
  if (UPDATING) {
    mkdirSync(FIXTURE_DIR, { recursive: true })
    writeFileSync(path, actual)
    return
  }
  expect(actual).toBe(readFileSync(path, 'utf-8'))
}

describe('castable exports — characterization', () => {
  let lib
  let balancing
  let web

  beforeAll(async () => {
    lib = makeCastableLibrary()
    const ctx = { castableTrainers: CASTABLE_TRAINERS }
    balancing = await runCastableExport(lib, 'balancingCsv', ctx)
    web = await runCastableExport(lib, 'webCsv', ctx)
  })

  afterAll(() => rmSync(lib, { recursive: true, force: true }))

  it('produces no error for the fixture library', () => {
    expect(balancing.error).toBeUndefined()
    expect(web.error).toBeUndefined()
  })

  it('matches the balancing CSV golden byte for byte', () => {
    checkGolden('castables_balancing.golden.csv', balancing.content)
  })

  it('matches the web CSV golden byte for byte', () => {
    checkGolden('castables_web.golden.csv', web.content)
  })

  it('keeps CRLF line endings', () => {
    expect(balancing.content).toContain('\r\n')
    expect(web.content).toContain('\r\n')
    expect(balancing.content.endsWith('\n')).toBe(false)
    expect(web.content.endsWith('\n')).toBe(false)
  })

  it('excludes test and GM castables from the web CSV only', () => {
    expect(balancing.content).toContain('TestOnly')
    expect(balancing.content).toContain('GmOnly')
    expect(web.content).not.toContain('TestOnly')
    expect(web.content).not.toContain('GmOnly')
  })

  it('excludes the .ignore archive from both', () => {
    expect(balancing.content).not.toContain('Archived')
    expect(web.content).not.toContain('Archived')
  })

  it('includes castables nested one and two levels deep in both', () => {
    for (const csv of [balancing.content, web.content]) {
      expect(csv).toContain('Nested')
      expect(csv).toContain('DeepNested')
    }
  })

  it('skips the malformed file without failing the export', () => {
    expect(balancing.content).not.toContain('Malformed')
    expect(web.content).not.toContain('Malformed')
  })
})
