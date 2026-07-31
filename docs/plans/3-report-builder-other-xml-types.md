# WP3 — Report builder for other XML types

**Size:** L (grows per type). **Depends on:** WP2. **Status:** Planned, not built. **Prompted by:** Sabrael — "adapting for other xml types as needed (items comes to mind specifically)."

## Goal

Generalize the castables report builder (WP2) into an **entity-agnostic** report builder that works for other world types — **items first**, then creatures, NPCs, statuses, etc. as needed. Same builder, same CSV/JSON serializers; each new type contributes a mapper and a field universe.

## Why it generalizes cleanly

WP1/WP2 keep the type-specific knowledge in exactly one place — `castableToRecord` (the field universe) — and everything downstream (serializers, filter engine, preset shape, UI) is already record-shaped and type-agnostic. WP3 is: add an `<entity>ToRecord` per type, register its field/filter universe, and let the builder pick the entity. No second builder.

## Scope (to detail when promoted)

- **`itemToRecord`** first (items is the named driver) — the item field universe, friendly derivations, and the index fields items already expose (e.g. weapon damage). Folder-safe enumeration via `listSection(libraryPath, 'items')`, same as castables.
- **Entity registry** — `{ type → { mapper, columns, filterVocabulary } }`; the builder gains an entity selector.
- **Per-type presets** — each type ships sensible built-ins (a balancing sheet, a web export) the way castables do.
- **Later types** — creatures, npcs, statuses, spawngroups… added on demand, one mapper each.

## Non-goals

- Not a schema/storage change for any type.
- No cross-type joined reports (e.g. "castables and the items that grant them") in v1 — one entity per report.
- Do not front-load every type; add a type's mapper when a report for it is actually needed.

## Open questions (resolve at promotion)

- Which types after items, and in what order (demand-driven).
- Whether any type needs record fields the index does not yet expose (would pull in a hybindex-ts field addition — see the shared-package pattern).
