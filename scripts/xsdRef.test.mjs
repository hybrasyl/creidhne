import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// The XSD pin (HTOO-615). xsd/ is gitignored, so a checkout can hold schemas
// from another xml commit, and the XSD tests then pass or fail against the
// wrong schemas with no sign of it. xsdRefProblem is what makes that loud.

const require = createRequire(import.meta.url)
const { XSD_REF, REF_FILE, xsdRefProblem } = require('./xsdRef.cjs')

let root

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'creidhne-xsdref-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('the XSD pin', () => {
  it('is a full commit SHA, so it cannot move', () => {
    expect(XSD_REF).toMatch(/^[0-9a-f]{40}$/)
  })

  it('passes when xsd/ holds the pinned ref', () => {
    writeFileSync(join(root, REF_FILE), `${XSD_REF}\n`)
    expect(xsdRefProblem(root)).toBeNull()
  })

  it('fails on another ref, and names both refs and fetch-xsd', () => {
    const other = 'edc836e'.padEnd(40, '0')
    writeFileSync(join(root, REF_FILE), `${other}\n`)
    const problem = xsdRefProblem(root)
    expect(problem).toContain(other)
    expect(problem).toContain(XSD_REF)
    expect(problem).toContain('npm run fetch-xsd')
  })

  it('fails when xsd/ has no ref file, as a fetch from before the pin does', () => {
    mkdirSync(join(root, 'src', 'XSD'), { recursive: true })
    const problem = xsdRefProblem(root)
    expect(problem).toContain(REF_FILE)
    expect(problem).toContain('npm run fetch-xsd')
  })

  it('fails when there is no xsd/ at all, as on a fresh clone', () => {
    const problem = xsdRefProblem(join(root, 'missing'))
    expect(problem).toMatch(/^No XSDs at /)
    expect(problem).toContain('npm run fetch-xsd')
  })

  it('is the ref that fetch-xsd downloads and writes', () => {
    // The download script must take its ref and file name from the pin
    // module, not restate them.
    const src = readFileSync(join(import.meta.dirname, 'downloadXSD.js'), 'utf8')
    expect(src).toContain("require('./xsdRef.cjs')")
    expect(src).toContain('zipball/${XSD_REF}')
    expect(src).toContain('path.join(outputDir, REF_FILE)')
    expect(src).not.toMatch(/releases\/latest/)
    expect(src).not.toMatch(/[0-9a-f]{40}/)
  })
})
