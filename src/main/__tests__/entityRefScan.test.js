import { describe, it, expect } from 'vitest'
import { INDEX_TYPES } from '@eriscorp/hybindex-ts'
import {
  REFERENCE_SITES,
  REFERENCED_TYPES,
  sitesIn,
  sourceTypesFor
} from '../../shared/entityReferences.js'
import { findReferences, rewriteReferences, scanPlan } from '../entityRefScan.js'

/**
 * HTOO-378, part one: the reference table and the scanner over it.
 *
 * The blast radius here is the largest in the app — a rename can rewrite
 * hundreds of files across four directories at once — so the cases below are
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
    expect(REFERENCE_SITES.elementtables).toEqual([])
    expect(REFERENCE_SITES.recipes).toEqual([])
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
})
