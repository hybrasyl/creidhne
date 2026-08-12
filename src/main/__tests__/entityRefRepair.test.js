import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, chmodSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { scanReferences, applyRename } from '../entityRefRepair.js'

/**
 * HTOO-378, part two: the disk half.
 *
 * `entityRefScan.test.js` covers the string work on one document. These cases
 * are the ones that only appear once real directories are involved — which files
 * are visited, which are not, and what is reported when a write does not happen.
 */

let world

const write = (rel, xml) => {
  const full = join(world, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, xml, 'utf8')
}

const read = (rel) => readFileSync(join(world, rel), 'utf8')

beforeEach(() => {
  world = mkdtempSync(join(tmpdir(), 'creidhne-refs-'))
})

afterEach(() => {
  rmSync(world, { recursive: true, force: true })
})

describe('scanReferences (HTOO-378)', () => {
  it('counts references rather than files', () => {
    // One creature can name a behaviour set four times — once on its root and
    // once per entry in <Types>. Reporting "1 file" as "1 reference" would
    // understate what a repair is about to change.
    write(
      'creatures/anemone.xml',
      `<Creature Name="Anemone" BehaviorSet="Critter">
         <Types><Type BehaviorSet="Critter"/><Type BehaviorSet="Critter"/></Types>
       </Creature>`
    )
    write('creatures/other.xml', `<Creature Name="Other" BehaviorSet="Elsewhere"/>`)

    return scanReferences(world, 'creaturebehaviorsets', 'Critter').then((r) => {
      expect(r.total).toBe(3)
      expect(r.files).toHaveLength(1)
      expect(r.files[0]).toMatchObject({ sourceType: 'creatures', rel: 'anemone.xml', count: 3 })
    })
  })

  it('never scans .ignore/', async () => {
    // Archived files are out of service, so their references resolve against
    // nothing either way. Counting them is also how the first survey of this
    // graph reported an edge with 9211 sites that actually has none.
    write(
      'items/.ignore/old.xml',
      `<Item Name="Ignored"><Variants><Group>Tailorable</Group></Variants></Item>`
    )
    write(
      'items/live.xml',
      `<Item Name="Live"><Variants><Group>Tailorable</Group></Variants></Item>`
    )

    const r = await scanReferences(world, 'variantgroups', 'Tailorable')
    expect(r.total).toBe(1)
    expect(r.files.map((f) => f.rel)).toEqual(['live.xml'])
  })

  it('walks every source type for a target, and subfolders within them', async () => {
    // A loot set is named from creatures AND spawngroups. Reading only the first
    // repairs part of the edge and reports success.
    write(
      'creatures/deep/nested/a.xml',
      `<Creature Name="A"><Loot><Set Name="Coins"/></Loot></Creature>`
    )
    write('spawngroups/b.xml', `<SpawnGroup Name="B"><Loot><Set Name="Coins"/></Loot></SpawnGroup>`)

    const r = await scanReferences(world, 'lootsets', 'Coins')
    expect(r.total).toBe(2)
    expect(r.files.map((f) => f.sourceType).sort()).toEqual(['creatures', 'spawngroups'])
    expect(r.files.find((f) => f.sourceType === 'creatures').rel.replace(/\\/g, '/')).toBe(
      'deep/nested/a.xml'
    )
  })

  it('returns nothing for a blank name instead of matching every empty node', async () => {
    write('items/a.xml', `<Item Name="A"><Variants><Group></Group></Variants></Item>`)
    expect((await scanReferences(world, 'variantgroups', '   ')).total).toBe(0)
  })

  it('reports a missing source directory as no references, not an error', async () => {
    // A world need not have every directory. Throwing here would turn "nothing
    // names this" into a failed save.
    const r = await scanReferences(world, 'variantgroups', 'Tailorable')
    expect(r).toEqual({ total: 0, files: [], unreadable: [] })
  })
})

describe('applyRename (HTOO-378)', () => {
  it('rewrites only the reference, leaving the referring file otherwise identical', async () => {
    const before = `<Npc Name="Shopkeeper">\n  <Vend><Items>\n    <Item Name="Lorica" Quantity="1"/>\n  </Items></Vend>\n</Npc>\n`
    write('npcs/shop.xml', before)

    const r = await applyRename(world, 'items', 'Lorica', 'Cuirass')
    expect(r.total).toBe(1)
    expect(r.changed).toEqual([{ sourceType: 'npcs', rel: 'shop.xml', count: 1 }])
    expect(read('npcs/shop.xml')).toBe(before.replace('Name="Lorica"', 'Name="Cuirass"'))
    // The referring file's OWN identity is untouched. This is the case that
    // would corrupt a world, and it shares an attribute name with the reference.
    expect(read('npcs/shop.xml')).toContain('<Npc Name="Shopkeeper">')
  })

  it('does not write a file it did not change', async () => {
    // A no-op write is a diff in the world's git history for nothing, and it
    // would make `changed` count files visited rather than files altered.
    write(
      'npcs/other.xml',
      `<Npc Name="Other"><Vend><Items><Item Name="Something"/></Items></Vend></Npc>`
    )
    const before = read('npcs/other.xml')

    const r = await applyRename(world, 'items', 'Lorica', 'Cuirass')
    expect(r.changed).toEqual([])
    expect(r.total).toBe(0)
    expect(read('npcs/other.xml')).toBe(before)
  })

  it('leaves archived referrers alone, matching the scan', async () => {
    write(
      'items/.ignore/old.xml',
      `<Item Name="Old"><Variants><Group>Tailorable</Group></Variants></Item>`
    )
    const before = read('items/.ignore/old.xml')

    await applyRename(world, 'variantgroups', 'Tailorable', 'Sewable')
    expect(read('items/.ignore/old.xml')).toBe(before)
  })

  it('escapes the new name once on the way in', async () => {
    write('items/a.xml', `<Item Name="A"><Variants><Group>Plain</Group></Variants></Item>`)
    await applyRename(world, 'variantgroups', 'Plain', 'Crow & Cask')
    expect(read('items/a.xml')).toContain('<Group>Crow &amp; Cask</Group>')
    expect(read('items/a.xml')).not.toContain('&amp;amp;')
  })

  it('finds a name that is stored escaped', async () => {
    // The failure this prevents is worse than missing the file: a raw-text search
    // reports a clean result, which reads as "nothing to update".
    write(
      'items/a.xml',
      `<Item Name="A"><Variants><Group>Crow &amp; Cask</Group></Variants></Item>`
    )
    const r = await applyRename(world, 'variantgroups', 'Crow & Cask', 'Tavern')
    expect(r.total).toBe(1)
    expect(read('items/a.xml')).toContain('<Group>Tavern</Group>')
  })

  it('names the files it could not write, and still writes the rest', async () => {
    // The write is per file and cannot be made atomic across dozens of them, so
    // a partial result is a possible outcome. Reporting only the successes would
    // tell the user the world is consistent when it is not.
    write('npcs/ok.xml', `<Npc Name="Ok"><Vend><Items><Item Name="Lorica"/></Items></Vend></Npc>`)
    write(
      'npcs/locked.xml',
      `<Npc Name="Locked"><Vend><Items><Item Name="Lorica"/></Items></Vend></Npc>`
    )
    chmodSync(join(world, 'npcs/locked.xml'), 0o444)

    const r = await applyRename(world, 'items', 'Lorica', 'Cuirass')
    expect(r.changed.map((f) => f.rel)).toContain('ok.xml')
    expect(read('npcs/ok.xml')).toContain('Name="Cuirass"')
    // Read-only is advisory for the owner on some platforms; assert the shape
    // rather than the failure, so this does not become a platform test.
    expect(r.changed.length + r.failed.length).toBe(2)
    for (const f of r.failed) expect(f.error).toBeTruthy()
  })
})
