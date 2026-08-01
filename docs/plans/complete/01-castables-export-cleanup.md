# WP1 — Castables export cleanup

**Size:** S–M. **Depends on:** —. **Status:** Built. **Prompted by:** Sabrael, during the R-006 pass — "clean up the export castables… csv is needed for balancing/hand review, the json is used by the web, but they should more or less be the same thing."

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

## Open question — resolved

Does Web JSON carry the friendly-derived fields, the raw values, or both? **Answer: it mirrors the
Web CSV exactly** (Sabrael) — the same 16 fields, the same test/GM exclusion, sharing one column
array with the Web CSV by identity so the two cannot drift. Its keys are the record's own names
(`str`, `int`, …) rather than the CSV headers (`StatStr`, …): the CSV keeps its header names for the
website's current parser, and the JSON is a new format with no consumer yet.

## Acceptance criteria

Verified by hand in `npm run dev` against a real world library.

1. The Exports page shows **one** card, `Castables`, with three buttons: Balancing CSV, Web CSV, Web
   JSON. The two old cards are gone.
2. With no library open, all three show `No library selected. Open a library from Settings first.`
3. Balancing CSV defaults to `castables_balancing.csv` with a CSV filter, and differs from a
   pre-WP1 `castables_excel.csv` on the same library **only** by the four changes below.
4. Web CSV defaults to `castables.csv` with a CSV filter, and differs from a pre-WP1 `castables.csv`
   **only** by the Con/Dex column order.
5. Web JSON defaults to `castables.json` with a **JSON** filter, parses to an array, and every
   element has exactly the 16 keys `name, icon, description, class, subclass, location, str, int,
wis, con, dex, mats, level, type, castCost, cooldown`.
6. For any castable in both web outputs, the CSV row and the JSON object agree field for field.
7. A Test or GM castable appears in the Balancing CSV (`Is Test?` / `isGM?` = `true`) and in neither
   web output. Balancing rows = total; web rows = total − (test + GM).
8. Castables in subfolders appear in all three; nothing from `.ignore` appears in any.
9. Cancelling a save shows `Export cancelled.` and writes nothing; success shows
   `Exported successfully to <path>`.
10. Only the clicked button spins; all three disable until it finishes.
11. A castable with trainers shows them in `Location`; one with **Given via script** and no trainer
    shows `Awarded by a Quest`; one with neither is empty.
12. An empty `castables/` produces an empty Balancing CSV, a header-only Web CSV, and `[]` JSON.
13. All checks green: `npm run lint:check && npm test && npm run build`, and `npm run test:coverage`
    shows no threshold regression.

## Output changes (Sabrael, at build time)

The WP as scoped kept both exports byte-identical. On review, four differences were resolved in
favour of one correct answer instead:

1. **A blank requirement reads as its minimum** — 3 for a stat, 1 for a level. Only bites a castable
   with no `<Requirement>` element at all, because `mapRequirements` already defaults stats to `'3'`
   whenever a requirement exists. Replaces the `reqStr`/`statStr` field pairs with one set. A stated
   value passes through even below the minimum, so bad data stays visible.
2. **Requirement columns are ordered Str, Int, Wis, Con, Dex** everywhere. _The web CSV changed_ —
   if the website reads those two columns by position rather than header name, it needs the swap.
3. **Status-add headers are all `StatusAddN`.** `isGM?`, `Element` and `StatRemN` were reviewed and
   left alone.
4. **`bookType`/`type` and `castCostSummary`/`castCost` both stay** — the website has presentation
   needs the balancing sheet does not.

## Findings during the build

- **`dialog:saveFile` hardcoded a CSV filter** — not in the original scope. Fixed with an
  extension-derived filter; both prior callers pass `.csv`, so they are unaffected.
- **`.gitattributes` normalizes to LF**, which would have broken the CRLF golden fixtures on a fresh
  clone. `*.golden.csv -text` added.
- **The `'Could not read castables directory'` branch is unreachable.** `listSectionFiles` handles
  its own errors and returns an empty list, so neither a missing `castables` nor a `castables` that
  is a file reaches it. The catch stays as insurance; a test records the real behaviour.
- **`src/shared/externalUrl.test.js` never runs.** `vitest.config.mjs` collects only
  `src/**/__tests__/**/*.test.js`, and that file sits beside its source, where it is counted as
  uncovered _source_. Pre-existing and out of scope — recorded in `00a-backlog.md`.
- **`npm run test:coverage` emits a Rollup "Expression expected" parse warning.** Pre-existing on
  `main`, verified against a clean worktree; coverage still exits 0.

## What shipped where

- `src/shared/castableRecord.js` — the record, the derivations, `CASTABLE_COLUMNS`.
- `src/shared/exportSerializers.js` — `esc`, `recordsToCsv`, `recordsToJson`. Entity-agnostic for WP3.
- `src/shared/castableExportPresets.js` — the three presets as data, for WP2's picker.
- `src/main/exportCastables.js` — the only disk-touching piece.
- Presets live in `src/shared/`, not `src/main/` as scoped, so WP2 can import them in the renderer.
  Note there is **no `@shared` vite alias** yet; WP1 did not need one because the renderer receives
  `defaultName` from the IPC result rather than importing preset data.
