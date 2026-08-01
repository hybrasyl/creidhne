# WP6 — Spawngroup spellbook references

**Size:** M. **Depends on:** —. **Status:** Planned, not built. **Prompted by:** `docs/future-ideas.md`, "Spawngroups: spellbook constants support" — promoted to a WP 2026-07-31.

## Goal

Let a spawngroup reference a **spell book** by name instead of naming castables one at a time — the
same ergonomic win as referencing a behavior set rather than inlining its rules.

## Current state (verified 2026-07-31)

The original note assumed spawngroups already list castables inline and that the WP swaps a list for
a reference. **They do not.** Grepping `src/main/spawngroupXml.js` (303 lines) for `castable` or
`spellbook` returns zero matches. A `<Spawn>` serializes attributes (`Name`, `Import`, `Flags`,
`DespawnAfter`, `ActiveFrom`, `ActiveTo`, `DespawnLoot` — `:215-223`) and then `Immunities`, `Loot`,
`Coordinates`, `Damage`, `Defense`, `Spec`, `Base`, `Hostility`, `SetCookies` (`:226-278`). There is
no castables field anywhere in the spawn model. **This WP is net-new plumbing, not a refactor.**

Two more findings that shape it:

- **A spell book is already just a category token.** `src/main/index.js:706-717` states the semantic:
  a book's runtime effect is that every castable it resolves to is **stamped with the book's name as
  a category**. Resolution lives in `src/main/spellbook.js` (`resolveSpellbook`, `:20`), applied via
  `ipcMain.handle('spellbook:apply', …)` (`index.js:718`). Books are stored under `spellBooks` in
  `constants.json` and edited on `SpellbooksPage.jsx` — a top-level page, **not** a Constants tab.
- **The precedent already exists in behavior sets.** `BehaviorSetEditor.jsx:554-564` picks a book and
  appends its **name** to the castables' `spellCategories` string. Its comment states the pattern
  outright. WP6 should mirror this, not invent a parallel mechanism.

The behavior-set reference this was modeled on is a plain string attribute the server resolves:
`SpawnBase/@BehaviorSet` (`xsd/src/XSD/Spawns.xsd:70-75`), parsed at `spawngroupXml.js:117`,
serialized at `:266-272`, authored through a `freeSolo` Autocomplete over `libraryIndex.behaviorsets`
(`SpawngroupEditor.jsx:707-718`).

## Decisions

1. **Mirror the behavior-set pattern**: a `freeSolo` Autocomplete over `libraryIndex.spellBooks`,
   exactly as `BehaviorSetEditor.jsx:554-564` already does. Same idiom, same index field.
2. **Do not use the shared `injectMeta` helper if this needs a meta annotation.**
   `src/main/xmlCommentUtils.js:21-29` has a **fixed** `META_DEFAULTS` key set and a hardcoded
   seven-field `&&` guard at `:50-60` — a new `spellbook` key passed through it is **silently
   dropped**. This is precisely why `creatureXml.js:11-29` rolled its own
   `extractCreatureMeta`/`injectCreatureMeta`. Follow that precedent or fix the shared helper to be
   key-agnostic; do not add an eighth field to the `&&` chain.

## Scope (to detail when promoted)

- **Where the reference lives** — the Spawn entry, the SpawnGroup root, or the SpawnBase template.
  `SpawnBase` is where `BehaviorSet` lives, which is the argument for putting it there.
- **XSD reality check** — whether `Spawns.xsd` has any attribute or element that can carry this
  today. If not, it is either an upstream `hybrasyl/xml` change or an editor-only annotation.
- **Serialization** — a book name the server resolves, or the expanded castable list in the XML with
  the book name kept as a `creidhne:meta` annotation so the editor can round-trip the user's intent.
- **`creidhne:meta` support for spawngroups is net-new.** `spawngroupXml.js:2` imports only
  `extractComment`/`injectComment`; there is no meta support in this serializer at all.

## Non-goals

- Do not change how spell books themselves are defined or resolved (`spellbook.js` is settled).
- Do not add a castables list to spawns as a stepping stone. If the reference cannot be expressed,
  the WP stops — an inline list is the thing this WP exists to avoid.
- No XSD edits from creidhne (`xsd/` is a fetched artifact, `.gitignore:109`).

## Open questions (resolve at promotion)

- **Does the spawn server expand a spellbook-by-name at load time?** This is the gating question and
  it is a server question, not a creidhne one — answer it against `hybrasyl/server` before designing
  the serialization. If the runtime wants the expanded list, the editor-only meta annotation is the
  answer; if it resolves names, the plain attribute is.
- Does giving a spawn a spellbook conflict with a behavior set that already grants castables? If both
  can apply, the precedence rule is a server question too.
