# WP4 — Weapons tab and creature attack revamp

**Size:** L. **Depends on:** —. **Status:** Planned, not built. **Prompted by:** `docs/future-ideas.md`, "Weapons Tab and creature revamp" — promoted to a WP 2026-07-31.

## Goal

Resolve the dead **Constants → Weapons** tab by deciding what feeds the creature editor's weapon
picker, and extend creature damage past the single `MinDmg`/`MaxDmg` pair so named natural attacks
and per-attack weapons are expressible.

## Current state (verified 2026-07-31)

- **The Weapons tab is dead code, and says so.** `ConstantsPage.jsx:1239-1246` carries a comment and
  `:1279-1283` an in-UI Alert both reading "Not currently wired into any editor." The tab is index 9
  (`:1403`), rendered at `:1611`, and writes `weapons: [{ name, minDmg, maxDmg }]` (`:1268`).
- **`WeaponPicker` never reads it.** `src/renderer/src/components/shared/WeaponPicker.jsx:42-52`
  builds its option list from `libraryIndex.itemWeaponDamage` and takes the **small-damage column
  only** (`smallMin`/`smallMax`), discarding `largeMin`/`largeMax`.
- **`itemWeaponDamage` is built in the shared package, not here** — `@eriscorp/hybindex-ts`
  (`dist/index.js:762-779`), regex-scraped from item XML and keyed by the item's first `<Name>`.
- **Constants are not schema-validated per key.** `src/main/schemas/constants.js:15` is
  `z.record(z.string(), z.array(z.unknown()))`; the weapon shape exists only in a comment (`:10`).
  Nothing rejects a malformed weapon entry today.
- **Damage is one attribute pair on the `Creature` complexType**, not a child element —
  `xsd/src/XSD/Common.xsd:777-791`, `MinDmg`/`MaxDmg` both `xs:int use="optional" default="0"`.
  `CreatureTypes` (`:793-797`) reuses the same complexType, so each `<Type>` subtype carries its own
  pair. Serialized at `src/main/creatureXml.js:262-273` (root) and `:239-250` (subtype).
- **`meta.weapon` already persists the picked label** independent of the source —
  `creatureXml.js:11-29` (`CREATURE_META_DEFAULTS`, `injectCreatureMeta`) and `:31` for the
  per-subtype form. Editor bindings at `CreatureEditor.jsx:440-449` and `:761-769`.

Two hazards found in the index builder that this WP must not inherit blindly:

1. The scrape regex matches **self-closing `<Damage … />` only**, so a paired `<Damage>…</Damage>`
   contributes nothing.
2. The guard is `sMin?.[1] && sMax?.[1] && …`, so a weapon with `SmallMin="0"` is **silently
   dropped** — `"0"` is falsy. A fix belongs in `hybindex-ts`, not in a consumer.

## Decisions

1. **Fix the index-builder hazards upstream first.** Both are `@eriscorp/hybindex-ts` bugs; per the
   shared-package rule, they are fixed there and consumed by version bump — not worked around in
   creidhne. This is a prerequisite, not part of this WP's branch.
2. **`meta.weapon` stays the persistence mechanism** for the picked label. It already survives a
   data-source change, which is why the source question can be settled without a migration.

## Scope (to detail when promoted)

- **Source resolution** — pick one of: the Weapons tab feeds `WeaponPicker` directly; it supplements
  `itemWeaponDamage`; or it replaces it. If both sources survive, define the precedence rule on name
  collision and show the source in the picker so the user can tell them apart.
- **Constants schema** — give `weapons` a real per-key Zod shape rather than `z.array(z.unknown())`,
  so a malformed entry fails at the IPC boundary instead of at render.
- **Multiple attacks** — the XSD change. `MinDmg`/`MaxDmg` are attributes on `Creature`; per-attack
  weapons need a repeating child element, which is an upstream `hybrasyl/xml` change and a server
  change before creidhne can author it.
- **Large-damage column** — decide whether the picker exposes `largeMin`/`largeMax` at all, or
  whether discarding half of every indexed weapon stays correct.

## Non-goals

- Do not remove the Weapons tab as "dead code" — it is reserved, and this WP is what claims it.
- No XSD edits from creidhne. `xsd/` is a fetched artifact (`.gitignore:109`); schema changes are
  `hybrasyl/xml` work.
- Boss tuning presets are a separate idea; this WP settles the data source and the attack shape only.

## Open questions (resolve at promotion)

- Does the server support more than one attack per creature today? **This gates the whole
  multiple-attack half** — if it does not, WP4 shrinks to the source-resolution question and the
  attack work waits on a server change.
- If natural attacks (`Iron Claw`, `Bear Bite`) have no backing item XML, do they belong in constants
  or in the creature file itself? Constants makes them reusable; the creature file makes them local.
