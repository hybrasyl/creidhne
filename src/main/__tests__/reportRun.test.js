import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { runCastableExport, collectCastableRecords } from '../reportRun.js'

// Guards the folder handling of the castables export: it must recurse into
// subfolders (the Folder picker files castables under castables/<sub>/…) and it
// must NOT sweep the `.ignore` archive into the report. Both come from
// listSection → listSectionFiles' recursive walk; before that switch a plain
// readdir missed subdirectories entirely.
//
// Inherited from exportCastablesJson.test.js, which could only reach the
// balancing export. The web export had no test at all, because it lived inside
// an IPC handler body; both now run through one function, so both are covered.

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'
const castableXml = (name, meta = null) =>
  `<?xml version="1.0"?>\n<Castable xmlns="${XMLNS}" Book="PrimarySpell" Icon="1" Class="Wizard">` +
  (meta ? `<!-- creidhne:meta ${JSON.stringify(meta)} -->` : '') +
  `<Name>${name}</Name></Castable>`

function namesInCsv(csv) {
  // First column is Name; the fixture names have no commas.
  return csv
    .split('\r\n')
    .slice(1)
    .filter(Boolean)
    .map((line) => line.split(',')[0])
}

describe('runCastableExport — folder handling', () => {
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
    const { content, error } = await runCastableExport(lib, 'balancingCsv')
    expect(error).toBeUndefined()
    const names = namesInCsv(content)
    expect(names).toContain('TopLevel')
    expect(names).toContain('Nested') // one level deep
    expect(names).toContain('DeepNested') // two levels deep
  })

  it('excludes the .ignore archive', async () => {
    const { content } = await runCastableExport(lib, 'balancingCsv')
    expect(namesInCsv(content)).not.toContain('Archived')
  })

  it('recurses and excludes the archive for the web presets too', async () => {
    for (const preset of ['webCsv', 'webJson']) {
      const { content } = await runCastableExport(lib, preset)
      expect(content, preset).toContain('DeepNested')
      expect(content, preset).not.toContain('Archived')
    }
  })

  it('returns an empty balancing CSV for a library with no castables', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'creidhne-export-empty-'))
    mkdirSync(join(empty, 'castables'), { recursive: true })
    const { content } = await runCastableExport(empty, 'balancingCsv')
    expect(content).toBe('')
    rmSync(empty, { recursive: true, force: true })
  })

  it('returns a header-only web CSV and an empty array for no castables', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'creidhne-export-empty-'))
    mkdirSync(join(empty, 'castables'), { recursive: true })
    const csv = await runCastableExport(empty, 'webCsv')
    expect(csv.content.startsWith('Name,Icon,')).toBe(true)
    expect(csv.content.split('\r\n')).toHaveLength(1)
    const json = await runCastableExport(empty, 'webJson')
    expect(JSON.parse(json.content)).toEqual([])
    rmSync(empty, { recursive: true, force: true })
  })

  it('exports empty rather than erroring when there is no castables folder', async () => {
    const bare = mkdtempSync(join(tmpdir(), 'creidhne-export-bare-'))
    const { content, error } = await runCastableExport(bare, 'balancingCsv')
    expect(error).toBeUndefined()
    expect(content).toBe('')
    rmSync(bare, { recursive: true, force: true })
  })

  // `listSectionFiles` handles its own errors and returns an empty list, so the
  // 'Could not read castables directory' branch both original exporters carried
  // is unreachable in practice — neither a missing `castables` nor a `castables`
  // that is a file reaches it. The catch stays as insurance against the package
  // changing; this records that it is not the current behaviour, so nobody reads
  // the error string and assumes a broken library reports itself.
  it('tolerates a castables path that is a file rather than a directory', async () => {
    const broken = mkdtempSync(join(tmpdir(), 'creidhne-export-broken-'))
    writeFileSync(join(broken, 'castables'), 'not a directory')
    const { content, error } = await runCastableExport(broken, 'balancingCsv')
    expect(error).toBeUndefined()
    expect(content).toBe('')
    rmSync(broken, { recursive: true, force: true })
  })

  it('skips a malformed file rather than failing the whole export', async () => {
    writeFileSync(join(castDir, 'Broken.xml'), '<?xml version="1.0"?><Castable><Name>Broken')
    const { content, error } = await runCastableExport(lib, 'balancingCsv')
    expect(error).toBeUndefined()
    expect(namesInCsv(content)).toContain('TopLevel')
    expect(namesInCsv(content)).not.toContain('Broken')
  })

  it('returns the preset default file name and format', async () => {
    await expect(runCastableExport(lib, 'balancingCsv')).resolves.toMatchObject({
      defaultName: 'castables_balancing.csv',
      format: 'csv'
    })
    await expect(runCastableExport(lib, 'webJson')).resolves.toMatchObject({
      defaultName: 'castables.json',
      format: 'json'
    })
  })

  it('throws on an unknown preset rather than exporting the wrong thing', async () => {
    await expect(runCastableExport(lib, 'nope')).rejects.toThrow(/Unknown castable export preset/)
  })
})

describe('runCastableExport — test and GM filtering', () => {
  let lib

  beforeEach(() => {
    lib = mkdtempSync(join(tmpdir(), 'creidhne-export-flags-'))
    const castDir = join(lib, 'castables')
    mkdirSync(castDir, { recursive: true })
    writeFileSync(join(castDir, 'Normal.xml'), castableXml('Normal'))
    writeFileSync(join(castDir, 'Testish.xml'), castableXml('Testish', { isTest: true }))
    writeFileSync(join(castDir, 'GmOnly.xml'), castableXml('GmOnly', { isGM: true }))
  })

  afterEach(() => rmSync(lib, { recursive: true, force: true }))

  it('keeps test and GM abilities in the balancing CSV', async () => {
    const { content } = await runCastableExport(lib, 'balancingCsv')
    expect(namesInCsv(content)).toEqual(expect.arrayContaining(['Normal', 'Testish', 'GmOnly']))
  })

  it('drops test and GM abilities from the web CSV', async () => {
    const { content } = await runCastableExport(lib, 'webCsv')
    expect(namesInCsv(content)).toEqual(['Normal'])
  })

  it('drops test and GM abilities from the web JSON', async () => {
    const { content } = await runCastableExport(lib, 'webJson')
    expect(JSON.parse(content).map((r) => r.name)).toEqual(['Normal'])
  })

  // The two web presets share one column array and one filter function, so this
  // asserts the property that sharing is meant to guarantee.
  it('produces identical data in the web CSV and the web JSON', async () => {
    const csv = await runCastableExport(lib, 'webCsv')
    const json = await runCastableExport(lib, 'webJson')
    const [header, ...rows] = csv.content.split('\r\n')
    const parsed = JSON.parse(json.content)

    expect(parsed).toHaveLength(rows.length)
    expect(header.split(',')).toHaveLength(Object.keys(parsed[0]).length)
    expect(parsed[0].name).toBe(rows[0].split(',')[0])
    expect(parsed[0].icon).toBe(rows[0].split(',')[1])
  })

  // The JSON carries the same 16 fields as the web CSV, in the same order. The
  // keys are the record's own names rather than the CSV headers: the CSV keeps
  // `StatStr` for the website's current parser, while the JSON — a new format
  // with no consumer yet — uses the plain stat names.
  it('keys the web JSON by the record field names', async () => {
    const { content } = await runCastableExport(lib, 'webJson')
    expect(Object.keys(JSON.parse(content)[0])).toEqual([
      'name',
      'icon',
      'description',
      'class',
      'subclass',
      'location',
      'str',
      'int',
      'wis',
      'con',
      'dex',
      'mats',
      'level',
      'type',
      'castCost',
      'cooldown'
    ])
  })
})

describe('collectCastableRecords', () => {
  let lib

  beforeEach(() => {
    lib = mkdtempSync(join(tmpdir(), 'creidhne-export-ctx-'))
    mkdirSync(join(lib, 'castables'), { recursive: true })
    writeFileSync(join(lib, 'castables', 'Ard.xml'), castableXml('Ard Ioc'))
  })

  afterEach(() => rmSync(lib, { recursive: true, force: true }))

  it('resolves the trainer location from the injected index context', async () => {
    const { records } = await collectCastableRecords(lib, {
      castableTrainers: { 'ard ioc': ['Mileth Priest'] }
    })
    expect(records[0].location).toBe('Mileth Priest')
  })

  it('leaves the location empty when no context is supplied', async () => {
    const { records } = await collectCastableRecords(lib)
    expect(records[0].location).toBe('')
  })
})
