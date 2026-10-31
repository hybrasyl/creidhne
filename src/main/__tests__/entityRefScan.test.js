import { describe, it, expect } from 'vitest'
import { INDEX_TYPES } from '@eriscorp/hybindex-ts'
import {
  REFERENCE_SITES,
  REFERENCED_TYPES,
  sitesIn,
  sourceTypesFor
} from '../../shared/entityReferences.js'
import { findReferences, referencedNames, rewriteReferences, scanPlan } from '../entityRefScan.js'

/**
 * HTOO-378, part one: the reference table and the scanner over it.
 *
 * The blast radius here is the largest in the app — a rename can rewrite
 * hundreds of files across five directories at once — so the cases below are
 * the ones that would corrupt a world rather than merely miss a reference.
 */

const site = (element, attribute = null, extra = {}) => ({
  type: 'x',
  element,
  attribute,
  ...extra
})

describe('reference table (HTOO-378)', () => {
  it('names only real index types, on both sides of every edge', () => {
    // Derived, not restated: the package decides what an entity type is called,
    // so a renamed type fails here rather than turning one edge into a silent
    // no-op. `maps` is a legitimate SOURCE with no editor in this app.
    const unknownTargets = REFERENCED_TYPES.filter((t) => !INDEX_TYPES.includes(t))
    expect(unknownTargets, 'these targets are not index types').toEqual([])
    for (const [target, sites] of Object.entries(REFERENCE_SITES)) {
      for (const s of sites) {
        expect(INDEX_TYPES, `${target} ← ${s.type}`).toContain(s.type)
      }
    }
  })

  it('gives every site an element, and an attribute or explicit text', () => {
    // `attribute: null` must be written out. An omitted key and a text reference
    // read identically at the call site, and only one of them is intended.
    for (const [target, sites] of Object.entries(REFERENCE_SITES)) {
      for (const s of sites) {
        expect(s.element, `${target} ← ${s.type}`).toBeTruthy()
        expect(s, `${target} ← ${s.type} must state its attribute`).toHaveProperty('attribute')
      }
    }
  })

  it('covers every type whose editor can rename something', () => {
    // The twelve duplicate-checked types plus `maps`, minus the four measured to
    // have no inbound edges. Spelled out so ADDING an editor without deciding
    // its reference edges fails here.
    expect(REFERENCED_TYPES).toContain('castables')
    expect(REFERENCED_TYPES).toContain('spawngroups')
    expect(REFERENCED_TYPES).toContain('creaturebehaviorsets')
    // The second sweep's find: maps place NPCs by name, so npcs is a target
    // after all. Pinned here as well as in renameRepairSites so removing the
    // edge cannot read as a tidy-up.
    expect(REFERENCED_TYPES).toContain('npcs')
    expect(REFERENCE_SITES.elementtables).toEqual([])
    // Recipes as a TARGET stays empty — nothing names a recipe. Recipes as a
    // SOURCE is real: a recipe names its output item and its ingredients.
    expect(REFERENCE_SITES.recipes).toEqual([])
    expect(sourceTypesFor('items')).toContain('recipes')
  })

  it('resolves a scan plan without duplicate source reads', () => {
    // A spawngroup names creatures AND loot sets; reading it twice for one
    // rename would double every count the user is shown.
    const plan = scanPlan('lootsets')
    expect(plan.map((p) => p.sourceType).sort()).toEqual(['creatures', 'spawngroups'])
    expect(sourceTypesFor('items')).toHaveLength(new Set(sourceTypesFor('items')).size)
  })

  it('throws on a type it has no table for', () => {
    expect(() => scanPlan('nonsense')).toThrow(/no reference table/)
    expect(() => sitesIn('nonsense', 'npcs')).toThrow(/no reference table/)
  })
})

describe('findReferences (HTOO-378)', () => {
  it('matches an attribute only on the element that carries it', () => {
    // THE case that would corrupt a world. `<Item Name="Lorica">` at the root of
    // an item file is that item's identity; `<Item Name="Lorica"/>` inside an npc
    // is a reference. A rewrite keyed on `Name="Lorica"` cannot tell them apart.
    const npc = `<Npc Name="Shopkeeper"><Vend><Items>
      <Item Name="Lorica" Quantity="1"/>
    </Items></Vend></Npc>`
    expect(findReferences(npc, [site('Item', 'Name')], 'Lorica')).toHaveLength(1)
    // The same string on a different element is not a match.
    expect(findReferences(npc, [site('Castable', 'Name')], 'Lorica')).toHaveLength(0)
    expect(findReferences(npc, [site('Npc', 'Name')], 'Lorica')).toHaveLength(0)
  })

  it('does not match a substring of a longer name', () => {
    const xml = `<A><Item Name="Iron Sword of Doom"/></A>`
    expect(findReferences(xml, [site('Item', 'Name')], 'Iron Sword')).toHaveLength(0)
  })

  it('compares on the DECODED value', () => {
    // `The Crow & Cask` is stored escaped. A raw search misses it and then
    // reports a clean result — which reads as "nothing to update" rather than
    // "the search was wrong", the worse of the two failures.
    const xml = `<A><Item Name="The Crow &amp; Cask"/><Group>The Crow &amp; Cask</Group></A>`
    expect(findReferences(xml, [site('Item', 'Name')], 'The Crow & Cask')).toHaveLength(1)
    expect(findReferences(xml, [site('Group')], 'The Crow & Cask')).toHaveLength(1)
  })

  it('honours the disqualifying attribute', () => {
    // `IsCategory="true"` makes the value a category name, not a status name,
    // and the two can legitimately be the same string.
    const xml = `<Statuses><Add>Sith</Add><Remove IsCategory="true">Sith</Remove></Statuses>`
    const sites = [
      site('Add', null, { unless: 'IsCategory' }),
      site('Remove', null, { unless: 'IsCategory' })
    ]
    expect(findReferences(xml, sites, 'Sith')).toHaveLength(1)
  })

  it('tolerates attribute order and extra attributes', () => {
    const xml = `<A><Spawn Flags="Active" Name="Kobold" Import="x"/></A>`
    expect(findReferences(xml, [site('Spawn', 'Name')], 'Kobold')).toHaveLength(1)
    expect(findReferences(xml, [site('Spawn', 'Import')], 'x')).toHaveLength(1)
  })

  it('returns nothing for a blank name rather than matching everything', () => {
    const xml = `<A><Group></Group><Group>Real</Group></A>`
    expect(findReferences(xml, [site('Group')], '')).toEqual([])
    expect(findReferences(xml, [site('Group')], '   ')).toEqual([])
  })
})

describe('rewriteReferences (HTOO-378)', () => {
  it('replaces only the inside of a matching node', () => {
    // A forty-file rename must be forty one-line diffs, not forty reformatted
    // files. Everything outside the matched value comes back byte-identical.
    const xml = `<Npc Name="Shopkeeper">\n  <Item Name="Lorica" Quantity="1"/>\n</Npc>`
    const { xml: out, count } = rewriteReferences(xml, [site('Item', 'Name')], 'Lorica', 'Cuirass')
    expect(count).toBe(1)
    expect(out).toBe(`<Npc Name="Shopkeeper">\n  <Item Name="Cuirass" Quantity="1"/>\n</Npc>`)
  })

  it('leaves a file with no references byte-identical', () => {
    const xml = `<Npc Name="Shopkeeper"><Item Name="Other"/></Npc>`
    const { xml: out, count } = rewriteReferences(xml, [site('Item', 'Name')], 'Lorica', 'Cuirass')
    expect(count).toBe(0)
    expect(out).toBe(xml)
  })

  it('escapes the new name once, and only once', () => {
    // Decode on the way in, escape on the way out. Escaping a value already
    // taken from a decoded source is what produced `&amp;amp;` and a dead warp
    // (HTOO-343).
    const xml = `<A><Item Name="Old"/></A>`
    const { xml: out } = rewriteReferences(xml, [site('Item', 'Name')], 'Old', 'Crow & Cask')
    expect(out).toContain('Name="Crow &amp; Cask"')
    expect(out).not.toContain('&amp;amp;')
  })

  it('escapes a quote in an attribute but not in element text', () => {
    const attr = rewriteReferences(
      `<A><Item Name="Old"/></A>`,
      [site('Item', 'Name')],
      'Old',
      'A "B"'
    )
    expect(attr.xml).toContain('Name="A &quot;B&quot;"')
    const text = rewriteReferences(`<A><Group>Old</Group></A>`, [site('Group')], 'Old', 'A "B"')
    expect(text.xml).toContain('<Group>A "B"</Group>')
  })

  it('rewrites every occurrence in a file, not the first', () => {
    const xml = `<A><Group>Old</Group><Group>Old</Group><Group>Keep</Group></A>`
    const { xml: out, count } = rewriteReferences(xml, [site('Group')], 'Old', 'New')
    expect(count).toBe(2)
    expect(out).toBe(`<A><Group>New</Group><Group>New</Group><Group>Keep</Group></A>`)
  })

  it('does not rewrite a disqualified node', () => {
    const xml = `<S><Add>Sith</Add><Remove IsCategory="true">Sith</Remove></S>`
    const sites = [
      site('Add', null, { unless: 'IsCategory' }),
      site('Remove', null, { unless: 'IsCategory' })
    ]
    const { xml: out, count } = rewriteReferences(xml, sites, 'Sith', 'Suain')
    expect(count).toBe(1)
    expect(out).toContain('<Add>Suain</Add>')
    expect(out).toContain('<Remove IsCategory="true">Sith</Remove>')
  })

  it('handles the self-referential behaviour-set edge without touching identity', () => {
    // A behavior set imports another by name on its OWN root element, so the
    // element being matched is the same tag that declares this file's identity.
    // Only the Import attribute may move.
    const xml = `<BehaviorSet Name="Child" Import="Parent"><X/></BehaviorSet>`
    const { xml: out, count } = rewriteReferences(
      xml,
      [site('BehaviorSet', 'Import')],
      'Parent',
      'Ancestor'
    )
    expect(count).toBe(1)
    expect(out).toBe(`<BehaviorSet Name="Child" Import="Ancestor"><X/></BehaviorSet>`)
  })

  it('repoints ConflictsWith in a trait, and not the root that carries its name (HTOO-617)', () => {
    // A trait names other traits in <ConflictsWith><Trait>…</Trait>, and its own
    // root is the same tag. The row is read from the table, not restated.
    const [row] = REFERENCE_SITES.traits
    const xml = [
      '<Trait Name="Dockworker" Icon="1" IconSet="Skill">',
      '  <ConflictsWith>',
      '    <Trait>Scribe</Trait>',
      '    <Trait>Courtier</Trait>',
      '  </ConflictsWith>',
      '</Trait>'
    ].join('\n')
    const { xml: out, count } = rewriteReferences(xml, [row], 'Scribe', 'Archivist')
    expect(count).toBe(1)
    expect(out).toContain('<Trait>Archivist</Trait>')
    expect(out).toContain('<Trait>Courtier</Trait>')
    expect(out).toContain('<Trait Name="Dockworker"')
    // Renaming Dockworker itself finds nothing here: its name is the root's
    // attribute, which a text row cannot match.
    expect(rewriteReferences(xml, [row], 'Dockworker', 'Stevedore').count).toBe(0)
  })
})

// HTOO-453: the same table read the other way, for staging. A live file that
// names a staged-only entity is reported from this, so it must agree with the
// rename scan about what a reference is.
describe('referencedNames', () => {
  it('reads every name a file refers to, by the type it names', () => {
    const xml = `<Castable>
  <Name>Fireball</Name>
  <Requirements><Requirement><Items><Item>Ember</Item></Items></Requirement></Requirements>
  <Effects><Statuses><Add>Burning</Add><Add>Burning</Add><Remove>Frozen</Remove></Statuses></Effects>
</Castable>`
    const refs = referencedNames(xml, 'castables')
    expect(refs.items).toEqual(['Ember'])
    // Repeats removed, file order kept.
    expect(refs.statuses).toEqual(['Burning', 'Frozen'])
  })

  it('keeps the unless rule: a category is not a status', () => {
    const xml = `<Castable><Effects><Statuses><Add IsCategory="true">Fire</Add></Statuses></Effects></Castable>`
    expect(referencedNames(xml, 'castables').statuses).toBeUndefined()
  })

  it('decodes a name, as the scan does', () => {
    const xml = `<Npc><Roles><Vend><Items><Item Name="Crow &amp; Cask"/></Items></Vend></Roles></Npc>`
    expect(referencedNames(xml, 'npcs').items).toEqual(['Crow & Cask'])
  })

  it('reads the maps a file names, and not an element that only starts with Map', () => {
    // HTOO-636. `<LagMap>` is a number in a server config, not a map name.
    const config = `<ServerConfig Name="c"><Constants><LagMap>1001</LagMap></Constants>
  <Handlers><Death><Map X="1" Y="2">Chapel</Map></Death>
  <NewPlayer><StartMaps><StartMap X="3" Y="4">Mileth</StartMap></StartMaps></NewPlayer></Handlers></ServerConfig>`
    expect(referencedNames(config, 'serverconfigs').maps).toEqual(['Chapel', 'Mileth'])
    const item = `<Item><Name>Scroll</Name><Use><Teleport X="1" Y="1">Mileth</Teleport></Use></Item>`
    expect(referencedNames(item, 'items').maps).toEqual(['Mileth'])
    const nation = `<Nation Flag="1"><Name>Mileth</Name><Territory><Map Name="Mileth Inn"/></Territory></Nation>`
    expect(referencedNames(nation, 'nations').maps).toEqual(['Mileth Inn'])
  })

  it('finds what findReferences finds, for every site', () => {
    // One document per site, so the two readings of the table cannot drift.
    for (const [target, sites] of Object.entries(REFERENCE_SITES)) {
      for (const site of sites) {
        const xml = site.attribute
          ? `<Root><${site.element} ${site.attribute}="Probe"/></Root>`
          : `<Root><${site.element}>Probe</${site.element}></Root>`
        const found = findReferences(xml, [site], 'Probe').length > 0
        const read = (referencedNames(xml, site.type)[target] || []).includes('Probe')
        expect(read, `${site.type} → ${target} via <${site.element}>`).toBe(found)
      }
    }
  })
})
