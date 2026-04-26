# Future Implementation Ideas

Living list of deferred work — features, refactors, and follow-ups
discussed during development but not yet tackled. Add entries as they
come up; strike or remove when done.

---

## Weapons Tab and creature revamp

The **Constants → Weapons** tab is currently in the schema and saved to
`constants.json` but isn't read by any editor. The creature editor's
`WeaponPicker` pulls preset damage values from
`libraryIndex.itemWeaponDamage` (the indexed item set, small-damage
column), not from the constants list.

Reserved for a planned creature rework where weapons may need to be
selectable independently of items — e.g. per-attack weapons, boss
tuning presets, or named natural attacks (`Iron Claw`, `Bear Bite`)
that don't have backing item XMLs.

**When the rework lands, decide:**

- Does the Weapons tab feed the WeaponPicker directly, supplement
  `itemWeaponDamage`, or replace it?
- If both sources stay, what's the merge / precedence rule on name
  collision?
- Should creatures gain multiple-attack support (each with its own
  weapon)? The single `MinDmg`/`MaxDmg` attribute pair on the XSD
  would need to extend.

Already in place:

- `weapons: [{ name, minDmg, maxDmg }]` round-trips through
  `constants.json` and `libraryIndex.weapons` (per the hydration hook),
  so user-added entries today won't be lost.
- `meta.weapon` annotation on creatures persists the picked label
  regardless of source — switching the picker's data source later
  doesn't break round-trip.

## Spawngroups: spellbook constants support

Spell Books (defined in **Constants → Spell Books**) are named bundles
of castables. Spawngroups should be able to reference a spell book by
name as an alternative to listing each castable inline — same
ergonomic win as referencing a behavior set vs. inlining its rules.

**Open questions:**

- Does the spell book reference live on the Spawn entry, the
  SpawnGroup root, or the SpawnBase template?
- Does the spawn server expand spellbook-by-name at load time, or do
  we serialize the expanded castable list to XML and keep the book
  reference as a creidhne:meta annotation?
- If the runtime expects the expanded list, an editor-only meta
  annotation lets the user pick the book in the UI while the XML
  still satisfies the upstream schema.
