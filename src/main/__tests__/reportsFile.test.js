import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadReports, saveReports, getReportsPath } from '../reportsFile.js'

// world/.creidhne/reports.json (WP2). `libraryPath` is world/xml, and the
// .creidhne folder is one level up — the same relationship constants.json and
// formulas.json already use.

const REPORT = {
  id: 'r_1',
  label: 'Assails only',
  entity: 'castables',
  format: 'csv',
  columns: ['name', 'damageFormula'],
  match: 'all',
  rules: [{ field: 'isAssail', op: 'is', value: true }],
  headerOnEmpty: true
}

describe('reports.json', () => {
  let world
  let lib

  beforeEach(() => {
    world = mkdtempSync(join(tmpdir(), 'creidhne-reports-'))
    lib = join(world, 'xml')
    mkdirSync(lib, { recursive: true })
  })

  afterEach(() => rmSync(world, { recursive: true, force: true }))

  const writeFile = (contents) => {
    mkdirSync(join(world, '.creidhne'), { recursive: true })
    writeFileSync(getReportsPath(lib), contents, 'utf-8')
  }

  it('reads no reports and no problems when the file is absent', () => {
    // A missing file means nobody has saved a report yet. It is not a fault, and
    // reporting it as one would put a warning in front of every new library.
    return expect(loadReports(lib)).resolves.toEqual({ version: 1, reports: [], problems: [] })
  })

  it('reports a file that exists and cannot be parsed', async () => {
    writeFile('{ not json')
    const { reports, problems } = await loadReports(lib)
    expect(reports).toEqual([])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/could not be read/)
  })

  it('round-trips a report through a save and a load', async () => {
    await saveReports(lib, [REPORT])
    const { version, reports, problems } = await loadReports(lib)
    expect(version).toBe(1)
    expect(problems).toEqual([])
    expect(reports).toEqual([REPORT])
  })

  it('creates .creidhne on the first save', async () => {
    expect(existsSync(join(world, '.creidhne'))).toBe(false)
    await saveReports(lib, [REPORT])
    expect(existsSync(getReportsPath(lib))).toBe(true)
  })

  it('writes the version from the first save', async () => {
    // So a later work package can migrate rather than guess what it is reading.
    await saveReports(lib, [REPORT])
    expect(JSON.parse(readFileSync(getReportsPath(lib), 'utf-8')).version).toBe(1)
  })

  it('keeps the good reports when one is bad', async () => {
    // The point of validating per report rather than per file. This is a file a
    // person edits by hand, and refusing all of it over one stale field name
    // loses work that is still good.
    writeFile(
      JSON.stringify({
        version: 1,
        reports: [REPORT, { ...REPORT, id: 'r_2', label: 'Broken', columns: ['nosuchfield'] }]
      })
    )
    const { reports, problems } = await loadReports(lib)
    expect(reports.map((r) => r.id)).toEqual(['r_1'])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^"Broken": column "nosuchfield" is not a castables field/)
  })

  it('names the offending value for each kind of fault', async () => {
    const bad = (over) => ({ ...REPORT, ...over })
    writeFile(
      JSON.stringify({
        version: 1,
        reports: [
          bad({ label: 'Bad op', rules: [{ field: 'isGM', op: 'contains', value: 'x' }] }),
          bad({ label: 'Bad field', rules: [{ field: 'nope', op: 'is', value: 1 }] }),
          bad({ label: 'Bad format', format: 'xlsx' }),
          bad({ label: 'No columns', columns: [] }),
          bad({ label: 'Half a range', rules: [{ field: 'level', op: 'between', value: 3 }] })
        ]
      })
    )
    const { reports, problems } = await loadReports(lib)
    expect(reports).toEqual([])
    const all = problems.join('\n')
    expect(all).toMatch(/"Bad op": rule 1: .*does not support the operator/)
    expect(all).toMatch(/"Bad field": rule 1: Unknown report field/)
    expect(all).toMatch(/"Bad format"/)
    expect(all).toMatch(/"No columns": a report needs at least one column/)
    expect(all).toMatch(/"Half a range": rule 1: .*two values/)
  })

  it('refuses a file whose version it does not know', async () => {
    // Rather than reading it as version 1 and quietly dropping what it cannot
    // understand.
    writeFile(JSON.stringify({ version: 2, reports: [REPORT] }))
    const { reports, problems } = await loadReports(lib)
    expect(reports).toEqual([])
    expect(problems[0]).toMatch(/version 2/)
  })

  it('refuses to write a definition the loader would reject', async () => {
    // A renderer bug must not put an unreadable report on disk.
    await expect(saveReports(lib, [{ ...REPORT, columns: ['nosuchfield'] }])).rejects.toThrow()
    expect(existsSync(getReportsPath(lib))).toBe(false)
  })

  it('allows two reports with the same label', async () => {
    // A hand-edited file must not refuse to load over a repeated name.
    await saveReports(lib, [REPORT, { ...REPORT, id: 'r_2' }])
    const { reports, problems } = await loadReports(lib)
    expect(reports).toHaveLength(2)
    expect(problems).toEqual([])
  })

  it('rejects a castable column on an items report (WP3)', async () => {
    // The per-entity rule, at the storage layer. A union catalogue would accept this
    // and then write a blank column, because recordsToCsv emits an empty cell for a
    // key the record does not hold — a file somebody reads as data, quietly wrong.
    writeFile(
      JSON.stringify({
        version: 1,
        reports: [
          {
            ...REPORT,
            id: 'r_i',
            label: 'Items',
            entity: 'items',
            columns: ['name', 'value'],
            rules: []
          },
          {
            ...REPORT,
            id: 'r_x',
            label: 'Wrong entity',
            entity: 'items',
            columns: ['name', 'damageFormula'],
            rules: []
          }
        ]
      })
    )
    const { reports, problems } = await loadReports(lib)
    expect(reports.map((r) => r.id)).toEqual(['r_i'])
    expect(problems[0]).toMatch(/"Wrong entity": column "damageFormula" is not a items field/)
  })

  it('rejects a castable rule on an items report (WP3)', async () => {
    writeFile(
      JSON.stringify({
        version: 1,
        reports: [
          {
            ...REPORT,
            entity: 'items',
            columns: ['name'],
            rules: [{ field: 'isGM', op: 'is', value: true }]
          }
        ]
      })
    )
    const { reports, problems } = await loadReports(lib)
    expect(reports).toEqual([])
    expect(problems.join('\n')).toMatch(/Unknown report field: isGM/)
  })

  it('rejects an entity it does not know, and names the ones it knows', async () => {
    // The schema's enum refuses this before the shared checker runs, and its message
    // lists the valid entities — which is what someone hand-editing the file needs.
    // `validateDefinition`'s own unknown-entity branch still matters for a direct
    // caller, and reportEntities.test.js covers that path.
    //
    // One message, not one per column: with no catalogue there is nothing to check
    // the columns against, and repeating "unknown field" per column would bury the
    // one message that explains all of them.
    writeFile(JSON.stringify({ version: 1, reports: [{ ...REPORT, entity: 'creatures' }] }))
    const { reports, problems } = await loadReports(lib)
    expect(reports).toEqual([])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/entity/)
    expect(problems[0]).toMatch(/items/)
  })

  it('round-trips an items report', async () => {
    const items = {
      id: 'r_items',
      label: 'Cheap weapons',
      entity: 'items',
      format: 'csv',
      columns: ['name', 'value', 'weaponType'],
      match: 'all',
      rules: [
        { field: 'isWeapon', op: 'is', value: true },
        { field: 'value', op: 'atMost', value: 500 }
      ],
      headerOnEmpty: true
    }
    await saveReports(lib, [items])
    const { reports, problems } = await loadReports(lib)
    expect(problems).toEqual([])
    expect(reports).toEqual([items])
  })
})
