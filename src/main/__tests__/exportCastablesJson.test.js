import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { exportCastablesExcelCSV } from '../exportCastablesJson.js'

// Guards the folder handling of the castables export: it must recurse into
// subfolders (the Folder picker files castables under castables/<sub>/…) and it
// must NOT sweep the `.ignore` archive into the report. Both come from
// listSection → listSectionFiles' recursive walk; before that switch a plain
// readdir missed subdirectories entirely. This is the test that was missing.

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'
const castableXml = (name) =>
  `<?xml version="1.0"?>\n<Castable xmlns="${XMLNS}" Book="PrimarySpell" Icon="1" Class="Wizard"><Name>${name}</Name></Castable>`

function namesInCsv(csv) {
  // First column is Name; the fixture names have no commas.
  return csv
    .split('\r\n')
    .slice(1)
    .filter(Boolean)
    .map((line) => line.split(',')[0])
}

describe('exportCastablesExcelCSV — folder handling', () => {
  let lib
  let castDir

  beforeEach(() => {
    lib = mkdtempSync(join(tmpdir(), 'creidhne-export-'))
    castDir = join(lib, 'castables')
    mkdirSync(join(castDir, 'universal'), { recursive: true })
    mkdirSync(join(castDir, 'wizard', 'offensive'), { recursive: true })
    mkdirSync(join(castDir, '.ignore'), { recursive: true })
    writeFileSync(join(castDir, 'TopLevel.xml'), castableXml('TopLevel'))
    writeFileSync(join(castDir, 'universal', 'Nested.xml'), castableXml('Nested'))
    writeFileSync(join(castDir, 'wizard', 'offensive', 'DeepNested.xml'), castableXml('DeepNested'))
    writeFileSync(join(castDir, '.ignore', 'Archived.xml'), castableXml('Archived'))
  })

  afterEach(() => rmSync(lib, { recursive: true, force: true }))

  it('includes castables from nested subfolders', async () => {
    const { csv, error } = await exportCastablesExcelCSV(lib)
    expect(error).toBeUndefined()
    const names = namesInCsv(csv)
    expect(names).toContain('TopLevel')
    expect(names).toContain('Nested') // one level deep
    expect(names).toContain('DeepNested') // two levels deep
  })

  it('excludes the .ignore archive', async () => {
    const { csv } = await exportCastablesExcelCSV(lib)
    expect(namesInCsv(csv)).not.toContain('Archived')
  })

  it('returns empty CSV for a library with no castables', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'creidhne-export-empty-'))
    mkdirSync(join(empty, 'castables'), { recursive: true })
    const { csv } = await exportCastablesExcelCSV(empty)
    expect(csv).toBe('')
    rmSync(empty, { recursive: true, force: true })
  })
})
