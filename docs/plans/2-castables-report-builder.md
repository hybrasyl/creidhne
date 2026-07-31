# WP2 — Castables report builder

**Size:** L. **Depends on:** WP1. **Status:** Planned, not built. **Prompted by:** Sabrael — "scope out a report builder to replace this, with these as presets."

## Goal

Replace WP1's three fixed buttons with a **report builder** for castables: choose the columns, apply filters, pick the format (CSV / JSON), and save. WP1's Balancing CSV, Web CSV, and Web JSON ship as named, built-in **presets** — the same outputs, now points in a configurable space instead of hardcoded handlers.

## Why this shape

WP1 deliberately expresses each output as `{ label, columns, filter, format }` over one canonical `castableToRecord`. WP2 is mostly UI + persistence on top of that: the record is the column universe, the serializers already exist, and a preset is already the unit. The builder is what turns "add a column to the export" from a code change into a user action.

## Scope (to detail when promoted)

- **Column picker** over the canonical record's fields (labels, ordering, include/exclude).
- **Filter rules** — a small, closed vocabulary over record fields: class, book/type, `isTest`/`isGM`, has-trainer, category membership, level range. All-of / any-of at one level (no nested query builder — the lesson from dagda's WP39).
- **Format** — CSV or JSON, sharing WP1's serializers.
- **Presets** — the three WP1 outputs as built-ins; user-defined presets saved to settings (a user decision, so it belongs in the crash-safe settings store, not a rebuildable cache).
- **UI** — a Reports surface (evolves `ExportsPage.jsx`); live row-count preview; save dialog.

## Non-goals

- Other entity types — that is WP3. WP2 is castables only.
- No new castable fields beyond WP1's record.
- No scheduled/automated exports; this is a manual, on-demand report.

## Open questions (resolve at promotion)

- Where preset definitions live and their schema (settings vs a `.creidhne` file).
- Whether the built-in presets are editable/removable or fixed.
- How much filter vocabulary is worth v1 vs. deferring.
