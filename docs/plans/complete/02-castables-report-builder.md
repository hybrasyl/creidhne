# WP2 — Castables report builder

**Size:** L. **Depends on:** WP1. **Status:** Built. **Prompted by:**
Sabrael — "scope out a report builder to replace this, with these as presets."

## Goal

Replace WP1's three fixed buttons with a **report builder** for castables. A user chooses the
columns, applies filters, picks the format, and saves the report definition. WP1's Balancing CSV,
Web CSV and Web JSON stay available as built-in reports. Each becomes a point in a configurable
space instead of a hardcoded handler.

The builder turns "add a column to the export" from a code change into a user action.

## Decisions (Sabrael, 2026-08-11)

1. **User reports live in `world/.creidhne/reports.json`.** A report is world-shaped: it names
   castable fields and serves a team artifact. That folder already holds `constants.json`,
   `formulas.json` and `map-catalog.json`, so the precedent and the path safety exist. A report in
   the world repo is also shareable and reviewable. The settings store was the other candidate and
   keeps a report on one machine.
2. **The three built-in reports are fixed, and a user clones one.** Their column lists are a
   contract with two consumers outside this repo: a balancing workbook and the Hybrasyl website
   parser. `castableExportPresets.js` says a header change must be a visible line in a diff. An
   editable built-in moves that contract out of git. Clone gives the same starting point without
   that cost.
3. **The full filter vocabulary ships in v1**: class, book or type, `isTest`, `isGM`, has-trainer,
   category membership, and level range. Combine with all-of or any-of at **one level**. Do not
   build a nested query builder — that is the lesson from dagda's WP39. Each rule is one predicate
   over a field the record already carries, so the cost per rule is small.

## What WP1 already provides

Measured against the tree, not quoted from the WP1 doc:

| Piece                                                   | Where                                 | WP2 uses it as               |
| ------------------------------------------------------- | ------------------------------------- | ---------------------------- |
| `castableToRecord(castable, ctx)`                       | `src/shared/castableRecord.js`        | the row source               |
| `CASTABLE_COLUMNS` — 69 fields with a label and a group | same file                             | the column picker's universe |
| `recordsToCsv`, `recordsToJson`, `esc`                  | `src/shared/exportSerializers.js`     | the two formats              |
| The three presets as data                               | `src/shared/castableExportPresets.js` | the built-in reports         |
| One enumeration, recursive, `.ignore` excluded          | `src/main/exportCastables.js`         | unchanged                    |
| Golden fixtures for two outputs                         | `src/main/__tests__/fixtures/export/` | the equivalence proof below  |

`CASTABLE_COLUMNS` already carries a `group` per field, so the picker groups by Identity, Flags,
Learning, Categories, Intent, Requirements, Cast cost, Effects and Statuses without new data.

## The structural change: a filter must become data

**This is the load-bearing change, and neither the card nor the WP2 outline names it.**

A preset's `filter` today is a **function**:

```js
const notTestOrGM = (record) => !record.isTest && !record.isGM
```

A user report is stored as JSON, so it cannot hold a function. So the filter becomes a rule list,
and the two web built-ins are re-expressed in the same vocabulary the user gets. One vocabulary,
not two: a built-in a user cannot express is a built-in the user cannot clone.

```js
// src/shared/reportRules.js
{ match: 'all', rules: [
  { field: 'isTest', op: 'is', value: false },
  { field: 'isGM',   op: 'is', value: false }
]}
```

`compileRules({ match, rules })` returns a predicate. `match` is `all` or `any`. An empty rule list
matches every record, which is Balancing CSV's `filter: null` today.

**The refactor proves itself against the golden fixtures.** WP1 committed
`castables_balancing.golden.csv` and `castables_web.golden.csv`. The re-expressed built-ins must
produce byte-identical output. That is the whole safety argument for touching a file two external
consumers read.

## The rule vocabulary

Eight operators, each one line of code: `is`, `is not`, `has`, `does not have`, `between`,
`at least`, `at most`, `contains`. The field list is closed, and it is a **subset** of the column
universe: not every field is worth filtering on, and an open list invites a rule nobody can read.

A rule's `field` is a **logical** name, not a record key. `class` reads `classRaw`, and `category`
reads all six category fields. A logical name keeps the stored rule readable, and it keeps a report
working when a record key is renamed.

| Rule        | Field it reads          | Operator                         | Note                              |
| ----------- | ----------------------- | -------------------------------- | --------------------------------- |
| Class       | `classRaw`              | `is`                             | See the class rule below          |
| Book        | `book`                  | `is`, `is not`                   | PrimarySkill, SecondarySpell, …   |
| Type        | `bookType`              | `is`                             | skill or spell                    |
| Is test     | `isTest`                | `is`                             | boolean                           |
| Is GM       | `isGM`                  | `is`                             | boolean                           |
| Deprecated  | `deprecated`            | `is`                             | boolean                           |
| Is assail   | `isAssail`              | `is`                             | boolean                           |
| Has trainer | `hasTrainer`            | `is`                             | **a new record field**; see below |
| Category    | `category1`…`category6` | `has`, `does not have`           | membership across all six         |
| Level       | `level`                 | `between`, `at least`, `at most` | numeric compare on a string field |
| Name        | `name`                  | `contains`                       | case-insensitive                  |

### The class rule

`classRaw` holds the raw `<Class>` string, space separated. `deriveClass` reads an empty value, or
all six classes, as `Universal`.

**`Class is Wizard` matches every castable a Wizard can learn, so it matches a Universal castable
too.** That is the question a user asks. `Class is Universal` selects the universal castables
alone. A rule that tested `classRaw` for the literal word would silently exclude every universal
ability, and a report missing the universal abilities still looks like a valid report.

### Has trainer needs a new record field

`deriveLocation` returns the trainer names, or `Awarded by a Quest`, or an empty string. A
has-trainer rule must not test that display string. If the phrase changes, the rule matches nothing
and an empty report reads as a valid answer.

So `castableToRecord` gains `hasTrainer` (boolean), derived from the same trainer lookup
`deriveLocation` performs. Extract that lookup into one helper both call, so the two cannot
disagree. Add the field to `CASTABLE_COLUMNS` as well — the test that keeps the two in step is what
tells you to.

This adds a **derived** field. It reads no new XML and changes no built-in report, because every
report names its columns explicitly.

## Storage

```json
{
  "version": 1,
  "reports": [
    {
      "id": "r_8f3c2a",
      "label": "Assails only",
      "entity": "castables",
      "format": "csv",
      "columns": ["name", "elements", "damageFormula"],
      "match": "all",
      "rules": [{ "field": "isAssail", "op": "is", "value": true }]
    }
  ]
}
```

- `version` is present from the first write, so WP3 can migrate rather than guess.
- `entity` is `castables` for every WP2 report. WP3 adds values; WP2 writes and reads the field so
  that a WP3 report in the same file is not ambiguous.
- `columns` holds record keys, not headers. A CSV header comes from the field's `CASTABLE_COLUMNS`
  label unless the report overrides it.
- `id` is generated, and a label collision is allowed. A file a user can edit by hand must not
  break on a duplicate name.

**An unknown key must be reported, not skipped.** `recordsToCsv` writes an empty cell for a key the
record does not hold, so a typo, or a field renamed by a later WP, produces a silent blank column.
The loader validates every `columns` entry and every `rules[].field` against the record universe,
and names what it rejected. This is the same failure class as the rest of this repo: a working app
and a wrong answer.

## Where each piece lives

| File                                     | Contents                                                 | New    |
| ---------------------------------------- | -------------------------------------------------------- | ------ |
| `src/shared/reportRules.js`              | the operator table, `compileRules`, `FILTERABLE_FIELDS`  | yes    |
| `src/shared/castableExportPresets.js`    | the three built-ins, filters re-expressed as rules       | edit   |
| `src/shared/castableRecord.js`           | `hasTrainer`, the shared trainer lookup                  | edit   |
| `src/main/schemas/reports.js`            | the Zod schema for `reports.json`                        | yes    |
| `src/main/reportsFile.js`                | atomic read and write under `.creidhne/`                 | yes    |
| `src/main/exportCastables.js`            | one definition-driven export, replacing three preset ids | edit   |
| `src/renderer/src/pages/ReportsPage.jsx` | the builder, evolved from `ExportsPage.jsx`              | rename |
| `src/renderer/src/components/reports/`   | column picker, rule rows, preview bar, save dialog       | yes    |

### The `@shared` alias is a prerequisite

WP1 recorded that there is no `@shared` vite alias, because the renderer received `defaultName`
from the IPC result instead of importing preset data. WP2's renderer imports the presets, the column
universe and the rule vocabulary, so the alias comes first.

Add it in **three** places, and treat the third as part of the same change:

1. `electron.vite.config.mjs`, `renderer.resolve.alias` — beside the existing `@renderer`.
2. The same block for `main`, if a main-process import uses it. Today main uses relative paths and
   works, so prefer leaving main alone over adding an alias it does not need.
3. `vitest.config.mjs` — `resolve.alias`. Vitest does not read the electron-vite config. Without
   this every test that imports through the alias fails to resolve, and the failure names the
   import rather than the missing alias.

## IPC

Three preset-specific handlers become one definition-driven handler plus the report store:

| Channel                  | Payload                      | Returns                    |
| ------------------------ | ---------------------------- | -------------------------- |
| `export:castablesReport` | `library`, report definition | `{ content, defaultName }` |
| `reports:preview`        | `library`, report definition | `{ total, matched }`       |
| `reports:load`           | `library`                    | `{ version, reports }`     |
| `reports:save`           | `library`, `reports`         | `{ ok }`                   |

**Every one of these takes a renderer-supplied definition, so every one is validated in main.** The
house rule is Zod at the IPC boundary, and this is the first payload where an unvalidated field name
would reach a file write. Validate the definition with the same schema the loader uses, so a
hand-edited file and a renderer message cannot be treated differently.

`reports:preview` exists so the row count does not require a save dialog. It reuses the enumeration
and the compiled predicate and returns two integers. Debounce the call in the renderer: a rule edit
is a keystroke, and the enumeration reads every castable file.

## UI

The Exports page becomes Reports.

- A list of reports: the three built-ins with a lock affordance and a Clone action, then the user's
  reports with Edit, Rename, Duplicate and Delete.
- The builder for the selected report: the column picker grouped by `CASTABLE_COLUMNS.group`, the
  rule rows with an all-of or any-of selector, and the CSV or JSON toggle.
- A live count: `matched of total castables`, from `reports:preview`.
- Run writes through the existing save dialog, which already derives its filter from the extension
  (a WP1 finding).

**`ExportsPage.jsx` holds a duplicate of each preset's label and description.** Its
`CASTABLE_EXPORTS` array restates what `castableExportPresets.js` already says, because the page
could not import from `src/shared/`. Two copies of one string drift, and this repo has just fixed
that exact fault twice (HTOO-130, HTOO-159). Once the alias exists, the page reads the presets and
the copy goes.

## Tests

- `reportRules.test.js` — every operator, both `match` modes, an empty rule list, and the class rule
  including the Universal case.
- **Golden equivalence** — the three re-expressed built-ins against WP1's committed fixtures, byte
  for byte. This is the test that makes the refactor safe.
- `reports.schema.test.js` — a valid file, an unknown column key, an unknown rule field, an unknown
  operator, a missing `version`. Each rejection names the offending value.
- `castableRecord.test.js` — `hasTrainer` for a castable with a trainer, one quest-awarded, and one
  with neither. Plus the existing test that `CASTABLE_COLUMNS` stays in step with the record.
- A structural guard: every built-in preset's `columns` keys exist in `CASTABLE_COLUMNS`. A typo
  there produces a blank column and no error, so the guard asserts the artifact. Guard the guard by
  asserting it found three presets.

## Non-goals

- Other entity types. That is WP3.
- No new castable XML fields. `hasTrainer` is derived from data the record already reads.
- No nested rule groups.
- No scheduled or automatic exports.
- No report sharing mechanism beyond the world repo the file already sits in.

## Acceptance criteria

Verified by hand in `npm run dev` against a real world library, plus the automated checks above.

1. The three built-in reports produce output byte-identical to the pre-WP2 files on the same
   library. The golden test asserts this, and one manual run confirms the save dialog and the
   default file names are unchanged.
2. A built-in report cannot be edited, renamed or deleted. Clone produces an editable copy.
3. A cloned report saves to `world/.creidhne/reports.json`, survives a restart, and appears in the
   list.
4. Each of the eleven rules filters as described. The class rule includes Universal castables.
5. All-of and any-of both work, with three rules.
6. The live count matches the row count of the file the report writes.
7. A hand-edited `reports.json` with an unknown column key is rejected with a message that names
   the key. The other reports in the file still load.
8. A report with no rules exports every castable, and one with a rule matching nothing exports a
   header only for CSV and `[]` for JSON.
9. With no library open, the page says so and offers no run action.
10. `npm run lint:check && npm test && npm run build` clean, and `npm run test:coverage` shows no
    threshold regression.

## Open items owed elsewhere

- WP3 generalises this to other entity types and inherits `version` and `entity` for that purpose.
  Do not add a second entity here.
- The website's move from Web CSV to Web JSON stays on the website's timeline. WP2 changes neither
  output.
