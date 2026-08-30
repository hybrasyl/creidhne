/**
 * Which files name which entities, and where the name sits in each one.
 *
 * A `<Name>` is a key. Rename an entity and every file that names it now points
 * at something that does not exist — immediately, silently, and **in other
 * files**. The file you edited is correct, which is what makes it easy to miss.
 * HTOO-378.
 *
 * ## This table is the deliverable, not a lookup convenience
 *
 * Creidhne's reference graph is many-to-many across twelve editable types.
 * Written per type by hand it is twenty-two scanners; written once as data it
 * is one. It also pays for more than the rename check — an inbound-references
 * panel ("what uses this item?") and orphan detection both read the same table.
 *
 * ## The edges are measured, not assumed
 *
 * Every row below was found by scanning the production world (`world/xml`,
 * ~4200 files) for the shape and counting the hits. The counts in the comments
 * are **active files only** and are the evidence each row exists at all. Where
 * two numbers are given, the second is how many name an entity that actually
 * exists; the gap is references that are already broken, which is the orphan
 * report this table also makes possible and is NOT something a rename should
 * quietly repair.
 *
 * Three findings that a survey done by eye would have got wrong, and did:
 *
 * - **`<Spawn Import="…">` names a SPAWNGROUP**, not a creature — 138 active
 *   sites in `maps/`. Creidhne has no map editor, but it does edit spawngroups,
 *   so a rename here breaks files nothing in this app opens.
 * - **A behavior set imports another behavior set** by name, 93 sites. The only
 *   self-referential edge: the type being renamed is also a type to scan.
 * - **`items ← spawngroups` has ZERO active sites**, not the 9211 the card
 *   reported as the largest edge in the graph. Every one of them is under
 *   `.ignore/`. Counting archived files is the easiest possible way to
 *   mis-measure this graph, and it happened on the first pass.
 *
 * A second sweep (2026-08, prompted by Taliesin discovering its own missing
 * nation edge) found five edges the first survey did not: `npcs ← maps`
 * (318 sites, every one resolving — and the first survey had pinned npcs as
 * having NO inbound edges), `castables ← items` (70 text sites plus one
 * `<Match Castable="…">`), `statuses ← items` (3), `items ← recipes` (1) and
 * `castables ← variantgroups` (0 sites, but the XSD carries the shape). A
 * survey is only as complete as the shapes it greps for, so treat "measured
 * and empty" as an invitation to re-measure, not a settled fact.
 *
 * ## Two shapes, and the attribute one is the dangerous half
 *
 * A reference is either the TEXT of an element or the value of an ATTRIBUTE.
 * Taliesin's `MapTarget` was text only, which is why its matcher does not port.
 * The attribute form is spelled the same as the element that DEFINES a name:
 * `<Item Name="…"/>` inside an npc is a reference, and `<Item Name="…">` at the
 * root of an item file is that item's own identity. A rewrite that matched
 * `Name="old"` would corrupt the referring file's identity, so every row names
 * the element the attribute must sit on, and the scanner never matches an
 * attribute on its own.
 */

/**
 * `element` — the tag the reference lives on.
 * `attribute` — the attribute holding the name, or `null` when it is the
 *   element's text content.
 * `unless` — an attribute that disqualifies the match when present and "true".
 *
 * @typedef {{ type: string, element: string, attribute: string|null, unless?: string, note?: string }} ReferenceSite
 */

/**
 * Target type → every place that names it.
 *
 * Keyed by `IndexType`, the same vocabulary `nameCollision.js` uses, so the two
 * cannot disagree about what an entity type is called.
 */
export const REFERENCE_SITES = Object.freeze({
  castables: [
    // 194 sites, 193 resolving: an NPC's Train role lists what it teaches.
    { type: 'npcs', element: 'Castable', attribute: 'Name' },
    // 36 sites: a behavior set's rotation names the castables it uses.
    { type: 'creaturebehaviorsets', element: 'Castable', attribute: null },
    // 70 sites, 4 distinct names, all resolving: an item's equip requirements —
    // `<Restrictions><Castables><Castable>…`. Second-sweep find; the first
    // survey missed items as a source for castables entirely.
    { type: 'items', element: 'Castable', attribute: null },
    // 1 active site: an item's cast modifiers can target one castable by name,
    // `<CastModifiers><Match Castable="…">`. The `Group` attribute on the same
    // element names a castable CATEGORY, not a castable, and must not be
    // rewritten — same trap as IsCategory, avoided here by naming the attribute.
    { type: 'items', element: 'Match', attribute: 'Castable' },
    // ZERO active sites, and the row stays, like the spawngroups row under
    // items: a variant's properties can carry the same `<Restrictions>`
    // castable list an item can (VariantProperties.Restrictions in the XSD),
    // so the first variant that uses it is covered.
    { type: 'variantgroups', element: 'Castable', attribute: null }
  ],
  items: [
    // 3121 sites, 2280 resolving: a merchant's Vend inventory. The largest edge.
    { type: 'npcs', element: 'Item', attribute: 'Name' },
    // ZERO active sites, and the row stays anyway. All 9211 occurrences of this
    // shape live under `.ignore/` — the earlier survey counted archived files and
    // reported it as the largest edge in the graph, which it is not. The shape is
    // real and an unarchived spawngroup carries it, so the row is kept and the
    // count is corrected rather than the row deleted.
    { type: 'spawngroups', element: 'Item', attribute: null },
    // 655 sites, 514 resolving: a loot set's contents.
    { type: 'lootsets', element: 'Item', attribute: null },
    // 803 sites, 470 resolving: a castable's learning requirements.
    { type: 'castables', element: 'Item', attribute: null },
    // 1 active site (a test recipe), in two shapes: the crafted output and each
    // ingredient. Kept the way the zero-site spawngroups row above is — the
    // shape is what the XSD allows, and the recipes that will exist carry it.
    { type: 'recipes', element: 'Item', attribute: 'Name' },
    { type: 'recipes', element: 'Ingredient', attribute: 'Name' }
  ],
  lootsets: [
    // A creature's or spawn's `<Loot><Set Name="…"/></Loot>`: 198 and 881.
    { type: 'creatures', element: 'Set', attribute: 'Name' },
    { type: 'spawngroups', element: 'Set', attribute: 'Name' }
  ],
  creaturebehaviorsets: [
    // A creature names its behaviour in TWO places, and the second carries most
    // of them: 55 on the `<Creature>` root, 138 on `<Type>` entries inside
    // `<Types>`. Taking the root alone would repair 29% of the edge and report
    // success — the failure mode this table exists to prevent.
    { type: 'creatures', element: 'Creature', attribute: 'BehaviorSet' },
    { type: 'creatures', element: 'Type', attribute: 'BehaviorSet' },
    // 7 sites: a spawn's `<Base>` behaviour override.
    { type: 'spawngroups', element: 'Base', attribute: 'BehaviorSet' },
    // 93 sites, and the only self-referential edge: a behavior set imports
    // another one by name, on its own root element. The type being renamed is
    // also a type that has to be scanned.
    { type: 'creaturebehaviorsets', element: 'BehaviorSet', attribute: 'Import' }
  ],
  creatures: [
    // 670 sites, 373 resolving. NOTE the attribute: `<Spawn Name="…">` is a
    // creature, while `<Spawn Import="…">` on the same element is a SPAWNGROUP.
    // Two references of different types on one tag, which is why the attribute
    // is part of the row rather than the element alone.
    //
    // The 297 that do not resolve name creatures that no longer exist. Those are
    // already broken, and finding them is the orphan report this table also
    // makes possible — not something a rename should quietly repair.
    { type: 'spawngroups', element: 'Spawn', attribute: 'Name' }
  ],
  spawngroups: [
    // 138 active sites in maps/, which Creidhne has no editor for and can still
    // break. 30 more live under `.ignore/` and are deliberately not scanned.
    { type: 'maps', element: 'Spawn', attribute: 'Import' }
  ],
  statuses: [
    // A castable's `<Statuses><Add>…</Add><Remove>…</Remove></Statuses>`.
    //
    // `IsCategory="true"` makes the value a CATEGORY name rather than a status
    // name — `<Remove IsCategory="true">Sith</Remove>` names a category. Those
    // must not be rewritten when a status is renamed, and a status and a
    // category can legitimately share a string.
    { type: 'castables', element: 'Add', attribute: null, unless: 'IsCategory' },
    { type: 'castables', element: 'Remove', attribute: null, unless: 'IsCategory' },
    // 3 active sites: an item's `<Use><Statuses>` block, the same Add/Remove
    // shape as the castable rows above. No item carries `IsCategory` today; the
    // guard stays because the schema allows it there too.
    { type: 'items', element: 'Add', attribute: null, unless: 'IsCategory' },
    { type: 'items', element: 'Remove', attribute: null, unless: 'IsCategory' }
  ],
  variantgroups: [
    // 874 sites, all resolving: an item's `<Variants><Group>…</Group></Variants>`.
    { type: 'items', element: 'Group', attribute: null }
  ],
  nations: [
    // FIVE elements, not one. An NPC's roles each carry their own nation
    // pricing: Bank (11), Post (12), Repair (20), plus `<CostAdjustment>` (5)
    // and `<Surcharge>` (6). The obvious single row would have covered 5 of 54.
    { type: 'npcs', element: 'Bank', attribute: 'Nation' },
    { type: 'npcs', element: 'Post', attribute: 'Nation' },
    { type: 'npcs', element: 'Repair', attribute: 'Nation' },
    { type: 'npcs', element: 'CostAdjustment', attribute: 'Nation' },
    { type: 'npcs', element: 'Surcharge', attribute: 'Nation' }
  ],
  npcs: [
    // 318 active sites, 312 distinct names, every one resolving — the largest
    // fully-resolving edge in the graph, and the second sweep's headline find:
    // the first survey recorded npcs as having no inbound edges at all, and the
    // guard test pinned it. A map places an NPC by name:
    // `<Npc Name="…" X="…" Y="…" Direction="…"/>`. Creidhne has no map editor,
    // but that is already true of the spawngroups edge above — maps are scanned
    // as referrer files either way.
    { type: 'maps', element: 'Npc', attribute: 'Name' }
  ],
  // Measured and genuinely empty. Recorded rather than omitted, so "no edge" is
  // distinguishable from "nobody looked" — an omitted key and an empty one read
  // identically at a call site, and only one of them is a finding.
  elementtables: [],
  localizations: [],
  recipes: [],
  serverconfigs: []
})

/** Every type this table can repair references for. */
export const REFERENCED_TYPES = Object.freeze(Object.keys(REFERENCE_SITES))

/**
 * The source directories that must be read to find references to `type`.
 * Deduplicated, because several sites can share a source (a spawngroup names
 * both creatures and loot sets).
 */
export function sourceTypesFor(type) {
  const sites = REFERENCE_SITES[type]
  if (!sites) throw new Error(`entityReferences: no reference table for type "${type}"`)
  return [...new Set(sites.map((s) => s.type))]
}

/** The sites within `sourceType` that name a `type`. */
export function sitesIn(type, sourceType) {
  const sites = REFERENCE_SITES[type]
  if (!sites) throw new Error(`entityReferences: no reference table for type "${type}"`)
  return sites.filter((s) => s.type === sourceType)
}
