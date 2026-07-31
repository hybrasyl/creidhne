# WP1 — Castables export cleanup

**Size:** S–M. **Depends on:** —. **Status:** Planned, not built. **Prompted by:** Sabrael, during the R-006 pass — "clean up the export castables… csv is needed for balancing/hand review, the json is used by the web, but they should more or less be the same thing."

## Goal

Collapse today's two divergent castable "exports" onto **one canonical per-castable record**, and emit it through **three explicit presets**:

1. **Balancing CSV** — every castable (test/GM included), the comprehensive column set. For balancing and hand review in Excel.
2. **Web CSV** — the friendly column set, test/GM excluded. What the Hybrasyl website ability browser reads today; kept unchanged so nothing breaks.
3. **Web JSON** — the same web-facing data as JSON, test/GM excluded. New; the format the web moves to.

One mapper, one place for the derivations, so the three can never drift. The three presets are deliberately the seed of WP2's report builder — build the record and serializers preset-agnostic.

## Current state (the tangle)

Both handlers live in `src/main/index.js` (registered in `whenReady`) and both return `{ csv }` — neither emits JSON:

- **`export:castablesJSON`** → `exportCastablesExcelCSV` (`src/main/exportCastablesJson.js`): comprehensive/raw columns (elements, lines, intents, req detail, heal/damage **formulas**, status add/remove), **no** test/GM filter. UI "Export Castables Excel CSV", saves `castables_excel.csv`. Despite the name it is CSV. → becomes **Balancing CSV**.
- **`export:castablesCSV`** → ~130 lines inline in `index.js`: friendly columns (icon filename, readable cast cost, trainer `Location` from the index's `castableTrainers`, "Universal", `Mats`), **excludes** test/GM. UI "Export Castables CSV", saves `castables.csv`. → becomes **Web CSV**.

Problems: two hand-maintained column sets that have already drifted; the friendly derivations exist only in the inline handler; IPC names are backwards (`…JSON` returns CSV); no machine-readable JSON.

Both enumerate via `listSection` → `listSectionFiles`' recursive walk, so **subfolders already work and `.ignore` is already excluded** — verified by `src/main/__tests__/exportCastablesJson.test.js`. Preserve this; do not re-solve it.

## Decisions (Sabrael, this session)

1. **One canonical record → three presets** (Balancing CSV, Web CSV, Web JSON).
2. **Test/GM:** Balancing CSV includes them (with `isTest`/`isGM` fields); Web CSV and Web JSON exclude them.
3. **Keep the Web CSV** unchanged for the web's current consumer; add Web JSON alongside. The web retires the CSV on its own timeline.
4. **UI:** one "Castables" card with **three** buttons.
5. **Sane IPC names** — the export whose name says JSON must return JSON.

## Design

- **`src/shared/castableRecord.js`** (electron-free, node-testable): `castableToRecord(castable, ctx)` → one flat object holding the **superset** of both current exports, friendly derivations carried as fields so all presets share them: `name`, `iconFile`, `type`, `class` ("Universal" rule), `subclass`, `description`, `cooldown`, `lines`, `elements`, `isAssail`, `deprecated`; requirement stats (default 3) + `levelMin` (default 1) + `mats`; `castCost` (friendly) + raw `castCosts`, `heal*`, `damage*`, `intents`, `categories`, status add/remove; `location`, `isTest`, `isGM`. `ctx` carries `castableTrainers` from `loadIndex`.
- **Presets** as data: `{ label, columns, filter, format }`. Balancing = all columns, no filter, CSV. Web CSV = web columns, `!isTest && !isGM`, CSV. Web JSON = web fields, same filter, JSON.
- **Serializers** (`src/main/exportCastables.js`): `recordsToCsv(records, columns)` (reuse the existing `esc`) and `recordsToJson(records, fields)`.
- **One enumeration** via `listSection(libraryPath, 'castables')`, read each `join(castDir, rel)`, map with `castableToRecord`.
- **IPC** (renamed): `export:castablesBalancingCsv`, `export:castablesWebCsv`, `export:castablesWebJson`. Update the preload bridge + `ExportsPage.jsx` (one card, three buttons; save dialog default names `castables_balancing.csv` / `castables.csv` / `castables.json`).

## Tests

- `castableRecord.test.js`: the friendly derivations (icon filename, cast cost, class label, location, subclass) asserted once at the record level.
- Extend `exportCastablesJson.test.js` (or a new `exportCastables.test.js`): a test/GM castable appears in the Balancing CSV and is absent from both Web outputs; the JSON parses and round-trips; subfolder + `.ignore` behavior stays green. Removes the inline-handler blind spot — everything now flows through exported, testable functions.

## Non-goals

- No new castable fields; this reshapes data the XML already holds.
- Not the report builder (WP2) — but keep the record + serializers + preset shape generic so WP2 can reuse them.
- Do not touch storage or the XSD.

## Open question

- Does Web JSON carry the friendly-derived fields (icon filename, readable cast cost), the raw values, or both? Default: mirror the Web CSV's friendly fields, since it targets the same web consumer.
