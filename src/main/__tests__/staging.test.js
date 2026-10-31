import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  stagingRoot,
  listStaged,
  stageFiles,
  releaseFiles,
  transferFiles,
  namesInFiles
} from '../staging.js'
import { scanReferences, applyRename } from '../entityRefRepair.js'

/**
 * HTOO-453: staging on disk. A world in a temp folder, with `xml/` and
 * `.staging/` side by side, the way world has them.
 */

let world
let lib

const write = (rel, xml = '<Castable><Name>X</Name></Castable>') => {
  const full = join(world, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, xml, 'utf8')
  return full
}
const exists = (rel) => existsSync(join(world, rel))

beforeEach(() => {
  world = mkdtempSync(join(tmpdir(), 'creidhne-staging-'))
  lib = join(world, 'xml')
  mkdirSync(lib)
})

afterEach(() => {
  rmSync(world, { recursive: true, force: true })
})

describe('stagingRoot', () => {
  it('is .staging beside xml/, never inside it', () => {
    // Inside xml/, the server would load it: GetXmlFiles skips only `.ignore`.
    expect(stagingRoot(lib)).toBe(join(world, '.staging'))
  })
})

describe('listStaged', () => {
  it('lists a type’s staged files by their path inside the type', async () => {
    write('.staging/castables/animist/a.xml')
    write('.staging/castables/b.xml')
    write('.staging/statuses/s.xml')
    const { files, dir } = await listStaged(lib, 'castables')
    expect(files).toEqual(['animist/a.xml', 'b.xml'])
    expect(dir).toBe(join(world, '.staging', 'castables').replace(/\\/g, '/'))
  })

  it('does not list a .ignore folder inside staging', async () => {
    write('.staging/castables/.ignore/old.xml')
    expect((await listStaged(lib, 'castables')).files).toEqual([])
  })

  it('is empty when there is no staging folder', async () => {
    expect((await listStaged(lib, 'items')).files).toEqual([])
  })

  it('refuses a type that cannot be staged', async () => {
    await expect(listStaged(lib, 'maps')).rejects.toThrow(/cannot be staged/)
  })
})

describe('stageFiles and releaseFiles', () => {
  it('keep the path inside the type, both ways', async () => {
    const live = write('xml/castables/animist/a.xml')
    const staged = await stageFiles(lib, 'castables', [live])
    expect(staged.failed).toEqual([])
    expect(exists('xml/castables/animist/a.xml')).toBe(false)
    expect(exists('.staging/castables/animist/a.xml')).toBe(true)

    const released = await releaseFiles(lib, 'castables', [
      join(world, '.staging/castables/animist/a.xml')
    ])
    expect(released.failed).toEqual([])
    expect(exists('xml/castables/animist/a.xml')).toBe(true)
    expect(exists('.staging/castables/animist/a.xml')).toBe(false)
  })

  it('refuses to overwrite a file on the other side', async () => {
    write('xml/castables/a.xml', '<Castable><Name>Live</Name></Castable>')
    const staged = write('.staging/castables/a.xml', '<Castable><Name>Staged</Name></Castable>')
    const r = await releaseFiles(lib, 'castables', [staged])
    expect(r.failed).toEqual([{ src: staged, reason: 'conflict' }])
    expect(readFileSync(join(lib, 'castables/a.xml'), 'utf8')).toContain('Live')
    expect(exists('.staging/castables/a.xml')).toBe(true)
  })

  it('refuses a file of another type', async () => {
    // The renderer names files; main decides where they go. A status sent to a
    // castable release must not land in xml/castables/.
    const status = write('.staging/statuses/s.xml')
    const r = await releaseFiles(lib, 'castables', [status])
    expect(r.failed).toEqual([{ src: status, reason: 'outside' }])
    expect(exists('.staging/statuses/s.xml')).toBe(true)
  })

  it('refuses an archived file', async () => {
    const archived = write('xml/castables/.ignore/old.xml')
    const r = await stageFiles(lib, 'castables', [archived])
    expect(r.failed).toEqual([{ src: archived, reason: 'archived' }])
  })

  it('settles each file on its own', async () => {
    const a = write('.staging/items/a.xml')
    const b = write('.staging/items/b.xml')
    write('xml/items/b.xml')
    const r = await releaseFiles(lib, 'items', [a, b])
    expect(r.ok.map((o) => o.src)).toEqual([a])
    expect(r.failed.map((f) => f.src)).toEqual([b])
  })

  it('releases a staged map, and stages none (HTOO-636)', async () => {
    // Taliesin stages maps. Creidhne releases one that a released file names.
    const map = write('.staging/maps/grove.xml', '<Map><Name>Hidden Grove</Name></Map>')
    const r = await releaseFiles(lib, 'maps', [map])
    expect(r.failed).toEqual([])
    expect(exists('xml/maps/grove.xml')).toBe(true)
    expect(() => stageFiles(lib, 'maps', [join(lib, 'maps/grove.xml')])).toThrow(/cannot be staged/)
    expect(() => releaseFiles(lib, 'worldmaps', [])).toThrow(/cannot be released/)
  })

  it('reports a missing source as a failure, not a throw', async () => {
    const r = await transferFiles(
      [join(lib, 'items/gone.xml')],
      join(lib, 'items'),
      join(world, 'x')
    )
    expect(r.ok).toEqual([])
    expect(r.failed).toHaveLength(1)
  })
})

describe('namesInFiles', () => {
  it('reads each file’s references by the type they name', async () => {
    const p = write(
      'xml/castables/a.xml',
      `<Castable><Name>A</Name><Effects><Statuses><Add>Burning</Add></Statuses></Effects></Castable>`
    )
    const out = await namesInFiles([p], 'castables')
    expect(out[p].statuses).toEqual(['Burning'])
  })

  it('reads the maps a nation and a map name', async () => {
    const nation = write(
      'xml/nations/mileth.xml',
      `<Nation Flag="1"><Name>Mileth</Name><SpawnPoints><SpawnPoint MapName="Hidden Grove" X="1" Y="1"/></SpawnPoints></Nation>`
    )
    const map = write(
      '.staging/maps/grove.xml',
      `<Map Id="1" X="10" Y="10"><Name>Hidden Grove</Name><Warps><Warp X="0" Y="0"><MapTarget X="5" Y="5">Deep Grove</MapTarget></Warp></Warps></Map>`
    )
    expect((await namesInFiles([nation], 'nations'))[nation].maps).toEqual(['Hidden Grove'])
    expect((await namesInFiles([map], 'maps'))[map].maps).toEqual(['Deep Grove'])
  })

  it('maps an unreadable file to no references', async () => {
    const p = join(lib, 'castables/gone.xml')
    expect(await namesInFiles([p], 'castables')).toEqual({ [p]: {} })
  })
})

// The repair walks the staging root by calling the same functions with it as the
// library (index.js `refs:scan` and `refs:apply`). A staged file that names a
// live entity has to be found, or its reference breaks on release.
describe('rename repair over the staging root', () => {
  it('finds and repoints a staged file that names a live entity', async () => {
    write('.staging/npcs/trainer.xml', `<Npc><Name>T</Name><Castable Name="Old"/></Npc>`)
    const root = stagingRoot(lib)
    const scan = await scanReferences(root, 'castables', 'Old')
    expect(scan.files.map((f) => f.rel)).toEqual(['trainer.xml'])
    const applied = await applyRename(root, 'castables', 'Old', 'New')
    expect(applied.changed).toHaveLength(1)
    expect(readFileSync(join(world, '.staging/npcs/trainer.xml'), 'utf8')).toContain(
      'Castable Name="New"'
    )
  })
})
