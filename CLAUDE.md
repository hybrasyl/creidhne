# Creidhne

A bespoke desktop editor for **Hybrasyl world data** — reads and writes the server's XML
(items, castables, creatures, NPCs, nations, loot, spawngroups, statuses, behavior sets,
recipes, variants, localizations, server config) plus the derived `constants.json` /
`formulas.json`, validated against the Hybrasyl XSDs. Built on the house Erisco/Hybrasyl
Electron stack.

## Canonical references (read these first)

The house standard lives in the internal **document repo** (`Comhaigne`), under
`docs/architecture/`. Consult it before inventing a pattern:

- **`dev-practices.md`** — git/commit discipline, PR prep, verify-before-commit, security posture.
- **`electron-app-skeleton.md`** — the full Electron stack/architecture spec. `hyb-electron-template`
  is its runnable snapshot; Creidhne predates parts of it (see _Known divergences_ below).
- **`e2e-playwright-electron.md`** — the E2E harness rationale (Creidhne's `e2e/` follows it).
- **`mundanes-dubhaimid-themes.md`** — the two corporate themes (Creidhne has both).

For Dark Ages protocol / XML / binary-format questions, the authoritative deep reference is the
document repo's `docs/` (WIRE-FORMATS, OPCODE-MAP, dat-files, per-opcode files).

## Commands

```bash
npm run dev          # electron-vite dev — launches the app; needs a GUI (see Verifying)
npm test             # vitest run (~1690 tests incl. scripts/; node env by default)
npm run test:coverage  # config-driven — do NOT re-add --coverage.include, a CLI flag overrides it
npm run lint:check   # eslint, no writes
npm run lint         # eslint --fix
npm run format       # prettier --write .
npm run build        # electron-vite build (main + preload + renderer)
npm run build:win    # packaged Windows build — NSIS installer + portable exe (build:mac, build:linux too)
npm run e2e          # build, then Playwright-drives the built app (local-only, needs a GUI)
npm run e2e:only     # E2E against the existing out/ build
```

There is **no `typecheck`** — Creidhne is JavaScript, not TypeScript. Gate before committing:
`npm run lint:check && npm test && npm run build`.

## Stack

electron-vite 5 · Electron 41 · **React 19** · **JavaScript (`.jsx`, not TS)** ·
MUI v9 + Emotion (style via `sx`, never styled-components) · **Zustand 5** · Zod 4 ·
Vitest 4 (`environment: 'node'` by default; a component test opts into jsdom per file with a
`@vitest-environment jsdom` docblock) · Playwright (E2E). Package manager: **npm**. Shared packages:
`@eriscorp/hybindex-ts` (world index cache), `@eriscorp/dalib-ts` (`.datf` asset packs).

## Layout

```text
src/
  main/        main process — the only code that touches disk. index.js (lifecycle + window +
               IPC wiring), handlerContext.js, fsHandlers.js, pathSafety.js, fsCase.js
               (client filename casing), companion.js (find/launch Taliesin),
               remoteSession.js (RDP detection), settingsManager.js, schemaLog.js, splash.js,
               updateCheck.js, indexService.js + indexWorker.js (index build off the main
               thread), worldData.js (world/.creidhne paths), constantsJson.js +
               formulasJson.js + reportsFile.js (the three .creidhne files),
               exportCastables.js, schemas/ (Zod — incl. worldEntity.js for the 14 xml:save
               payloads and ipcArgs.js for the argument-shaped ones), and per-domain XML
               (de)serializers: itemXml.js, castableXml.js, creatureXml.js, npcXml.js, …
  shared/      electron-free code BOTH processes import, via the `@shared` alias:
               castableRecord.js (the canonical castable record + its 70-field column
               catalogue), reportRules.js (the report filter vocabulary), castableExportPresets.js,
               exportSerializers.js, nameCollision.js (the server's name-key rule + the editors'
               duplicate check), externalUrl.js, scrub.js, appIdentity.js, …
               Nothing here may import `electron` — main runs it under node and the renderer
               bundles it.
  preload/     index.js — contextBridge, exposes window.electronAPI. `electron` is the ONLY
               module it may import: the window runs `sandbox: true`, so any package import
               re-breaks the sandbox, and only in the packaged app. (`@electron-toolkit/preload`
               and its `window.electron` were removed for exactly that reason — don't re-add.)
  renderer/src/
    App.jsx          ThemeProvider + CssBaseline + settings-hydration gate
    components/ pages/ (23) store/appStore.js (zustand) themes/ (6) hooks/ utils/ data/
scripts/       release + XSD + icon tooling (changelog-extract.mjs, validate-xml.mjs,
               generate-lua-stubs.js, make-icons.mjs, verify-fuses.mjs,
               make-portable-splash.mjs). Six of its tests run
               in the ordinary suite: icons.test.mjs (committed icon artifacts),
               buildPaths.test.mjs (every path electron-builder.yml names is tracked by git),
               testCollection.test.mjs (no test file sits where the runner won't find it),
               changelog-extract.test.mjs, verify-fuses.test.mjs (the electronFuses block, the
               copied @electron/fuses constants, and the packed artifact when one exists),
               release-artifacts.test.mjs (every declared target has a release glob, and back).
e2e/           Playwright specs against the built app
```

## Load-bearing house patterns (don't reinvent)

- **Main owns all disk/IPC I/O; the renderer only calls `window.electronAPI`** (the bridge in
  `src/preload/index.js`). Adding a feature = IPC handler → preload method → renderer call.
- **Path safety**: every renderer-supplied path is validated against session-allowed roots via
  `assertInsideAnyRoot` (`src/main/pathSafety.js`) before any fs op — never trust a renderer path.
- **Zod at the IPC boundary, and every channel is accounted for** (HTOO-370). A new
  `ipc.handle` must either `parseOrLog` its payload or be listed in `EXEMPT` in
  `src/main/__tests__/ipcSchemaCoverage.test.js` with a category and a reason — the suite
  reads `index.js` and fails naming any channel you did not classify. **Pass the channel
  as a string literal**, or the check cannot see it; that is why the fourteen `xml:save*`
  handlers spell theirs out instead of being registered from a table. Failures log a
  breadcrumb next to settings (`schemaLog.js`).

  What to validate is decided by whether the payload is **written**, not by whether it is a
  string. The three exempt categories are `no-payload`, `path-only` (`pathSafety.js` owns
  it) and `registry-key` (a miss finds nothing and writes nothing).

  Two shapes worth copying. `schemas/reports.js` checks field and operator names **against
  the vocabulary** in `src/shared/reportRules.js` rather than restating them, and one schema
  gates both the file loader and the IPC handler — a hand-edited file and a renderer message
  can both name a field that does not exist, and neither fails loudly.
  `schemas/worldEntity.js` is the opposite lesson: it is deliberately **shallow**, because a
  full per-type schema guessed wrong refuses a save of valid work, which is worse than the
  bug it fixes. Its rules were measured against all 4201 files in the production world, not
  reasoned out — that is how localizations (no name at all) and `serverconfigs/config.xml`
  (an empty name, in production) earned their exceptions.

- **Frameless window + custom chrome** (`MainToolbar.jsx` inside an `AppBar`); window controls
  message main via `minimize/maximize/close-window`.
- **Splash + `app:ready` reveal handshake**: the main window stays hidden until `App.jsx` finishes
  hydrating settings and calls `window.electronAPI.appReady()`. `resources/splash.html` is a flex
  column and **no child of it may shrink** — the one that could took the whole overflow and
  rendered the spinner as an oval (`splashLayout.test.js`). Its content must also stay well under
  the window height, because the content box is smaller than the size asked for: a 420x300
  frameless window measures 392x288 on a 1.5x display. `build/portable-splash.bmp` is a frozen
  frame of the same document, so resizing the logo means regenerating it too.
- **Crash-safe JSON settings** under `%LOCALAPPDATA%\Erisco\Creidhne` (atomic tmp→rename + `.bak`).
  The renderer save effect is gated on `settingsLoaded` so defaults never clobber the real file.
- **World index is a rebuildable cache** outside the world's git folder
  (`%LOCALAPPDATA%\Erisco\hybindex`, shared with Taliesin), built incrementally off-thread and
  self-healed on load. `world/.creidhne/` holds the three authoritative files Creidhne owns:
  `constants.json`, `formulas.json` and `reports.json` (user report definitions, WP2). A report
  goes with the world so it is shareable through the world repo.

  **Every save refreshes the section it wrote** (HTOO-372) — page saves call
  `buildIndexSection` and merge the result into the store; archive/unarchive/delete/duplicate
  get it from `useBulkFileActions`. Both halves matter: the worker persists to the on-disk
  cache either way, so rebuilding without merging leaves the renderer stale for the session.

- **A `<Name>` is a key, and one rule decides when two names collide** (HTOO-375).
  `useDuplicateName` (renderer) over `@shared/nameCollision.js`; never a hand-rolled
  `toLowerCase()`. The rule is the server's — `Normalize().ToLower()`, whitespace NOT
  collapsed — and it is restated in `shared/` only because the renderer cannot import
  `@eriscorp/hybindex-ts` (its entry point imports `fs`/`path`/`crypto`/`os`). An agreement
  test pins the copy to the package; if you touch one, run it.

  A rename does NOT rewrite the files that refer to the old name — that gap is HTOO-378.

- **`src/shared/` is electron-free, and its `@shared` alias lives in TWO config files** —
  `electron.vite.config.mjs` (renderer) and `vitest.config.mjs`. Vitest does not read the
  electron-vite config, and the error from a missing alias names the import rather than the
  alias. Main imports the same modules by relative path and needs no alias.
- **Six themes** — hybrasyl (default) · chadul · danaan · grinneal · mundanes (light corporate) ·
  dubhaimid (dark corporate). `MainToolbar` swaps to flat window-control glyphs for the two
  corporate themes (`PLAIN_CHROME_THEMES`).
- **Client filenames are resolved, never guessed** (`src/main/fsCase.js`). The DA installer
  writes `Legend.dat`; every caller spells it lowercase. Windows folds case, Linux/macOS do not,
  and the failed read lands in a `catch` that means "not present" — so it fails silently. Ask the
  directory. Client reads go through `fs:readClientFile(clientPath, rel)`, which takes the two
  halves separately _because_ a joined path can no longer be case-resolved.
- **The companion is named by identity, not by path** (`src/main/companion.js`). The renderer asks
  for Taliesin; main resolves override → colocated sibling → installed registration → nothing, and
  every platform probe is injected so precedence is testable. `spawn` has a far larger blast radius
  than a file read, so what may be launched is decided in main.
- **Boot-order calls that fail silently** live above `app.whenReady()` in `src/main/index.js`:
  `app.setPath('userData', …)`, `requestSingleInstanceLock()`, and
  `disableHardwareAcceleration()`. After `ready` each is a no-op rather than an error, so
  `remoteSession.test.js` reads the file and asserts the positions (comments stripped first).
- **Icons are generated, never hand-edited** — `scripts/make-icons.mjs` writes `build/icons/`
  (8 Linux sizes), `resources/icon.png` and `build/icon.icns` from the two masters in `build/`.
  Only files matching `NxN.png` in `build/icons/` are collected by electron-builder, so a stray
  size there ships; `scripts/icons.test.mjs` asserts the directory holds those eight and no more.
- **Structural guards, for faults whose failure mode is silence.** Several bugs here could not
  fail loudly by construction: a fuse that stops applying, a build input missing from the
  runner, `disableHardwareAcceleration()` after `ready`, a test file the runner never collects,
  a save handler missing one of two lines, a hand-written copy of a shared component that stopped
  matching it, a page restating a string it should import. Each produces a working app and a green
  gate. So the guard asserts the **artifact or the source**, not the intent —
  `scripts/buildPaths.test.mjs`, `icons.test.mjs`, `testCollection.test.mjs`,
  `remoteSession.test.js`'s call-site position, `src/main/__tests__/ipcSchemaCoverage.test.js`,
  `src/main/__tests__/splashLayout.test.js`, and five under
  `src/renderer/src/__tests__/`: `pageSaveFlow.test.js`, `editorHeader.test.js`,
  `reportPresetSource.test.js`, `indexRefreshOnSave.test.js` and `duplicateNameSource.test.js`.

  **The recurring shape is worth naming: a pattern that reached most of its sites, not all.**
  Five separate cards were that — 13 of 14 pages had the first-save fix (HTOO-130), 12 of 14
  editors used the shared header (HTOO-159), one page held a second copy of six preset strings
  (WP2), 13 of 14 pages refreshed the index on save (HTOO-372), and 13 editors held one
  hand-rolled name comparison each (HTOO-375). None could fail loudly, because each site looks
  correct read on its own. When you apply a pattern, count the sites and assert the count.

  **The splash spinner is a third variant: the defect was not in the source at all.** `body` is
  a flex column, so it absorbs overflow by squashing whichever child CAN squash — and only the
  spinner could, being an empty div with an automatic minimum size of 0. It took 100% of a 5px
  overflow, and a 32px circle rendered 32x26.7. Every declaration in that stylesheet is correct
  read on its own; the fault is a size the browser computed, so there is no wrong line to find
  and no gate that could go red. It also varies with display scale and with the fallback font,
  which is how it was first read as a Linux problem and then as a regression from the new CSP
  header — the header makes no difference, which was settled by rendering the document in
  Electron with it and without it. **When the artifact is a computed layout, assert the source
  property that makes the computation safe** (`flex-shrink: 0` on every child, derived from the
  markup) rather than the appearance, which no unit test can see.

  **HTOO-370 is the same shape one level up, and its lesson is different: a count in a document
  cannot hold a boundary.** That card was filed as "4 of 89 handlers" and found at 7 of 92 — it
  had moved, in the good direction, unnoticed. A sweep does not stay swept. So the guard does not
  assert a number; it requires every channel to carry a decision (validated, or exempt with a
  reason), which no edit to a number can satisfy. Prefer that shape whenever the thing being
  guarded is a set that grows.

  Three conventions these share, learned the hard way and worth keeping:
  1. **Guard the guard.** Every one asserts it found something to check. A walk that returns
     nothing, or a regex that stops matching, otherwise makes the real assertions pass
     vacuously — the same silent pass being defended against.
  2. **Derive the rule, don't restate it.** `testCollection.test.mjs` reads the `include`
     patterns out of `vitest.config.mjs`; `pageSaveFlow.test.js` detects pages by
     `resolveSavePath`, and `editorHeader.test.js` detects editors by the `initialFileName`
     prop, instead of a hardcoded list. A restated rule drifts. The same applies outside the
     tests: `schemas/reports.js` validates against the rule vocabulary, and `RuleList.jsx`
     builds its selects from it, so the UI cannot offer a rule the compiler then refuses.
  3. **Prove it can fail.** Each was verified by reintroducing the fault and checking that
     exactly the expected assertion fails. Two of these tests passed against the bug on their
     first draft.

## Release notes (CHANGELOG-driven)

Author user-facing changes in `CHANGELOG.md` under `## [Unreleased]` as PRs land — **not** by
hand-editing the GitHub release afterward. Cutting a release promotes `[Unreleased]` →
`## [X.Y.Z] - YYYY-MM-DD` (fresh empty `[Unreleased]` above), `npm version X.Y.Z
--no-git-tag-version`, then tag `vX.Y.Z`. CI runs `scripts/changelog-extract.mjs` to put that
section atop the GitHub release body (`generate_release_notes` appends the auto PR list below).

## Verifying changes

`npm run dev` and `npm run e2e` launch a real Electron window, and they **do** run from an agent
shell. The long-standing note here said otherwise; it was wrong. The symptom behind it was
`ELECTRON_RUN_AS_NODE=1` in the environment, which makes the Electron binary a plain Node
interpreter, so `require('electron')` returns a stub with no `app` and the first line of the main
process throws `Cannot read properties of undefined (reading 'isPackaged')`. That reads as a
broken environment rather than a set variable.

**`unset ELECTRON_RUN_AS_NODE` first**, in the same shell call, and `npm run dev`,
`npm run e2e:only` and a throwaway main script with `show: false` all work. The third is how the
splash oval was measured: load the document, then read `getBoundingClientRect` back through
`executeJavaScript`. Prefer an `e2e/` spec over an owed manual check whenever the assertion is
mechanical. Still hand over what needs a human eye — whether a layout _looks_ right, an installer
click-through, a real remote-desktop session.

## MUI v9 gotchas

Prop APIs differ from v5–v7 and fail cryptically:

- `ListItemText` has no `primaryTypographyProps` — use `slotProps={{ primary: { … } }}`.
- `Stack`: `alignItems`/`justifyContent` go in `sx`, not top-level props.
- Icons v9 drops deprecated base names (e.g. `HelpOutlineOutlined`, not `HelpOutline`).
- `Autocomplete`'s `renderInput` params carry **`slotProps`** (v5–v7 used `InputProps` +
  `inputProps`). Setting your own `slotProps` on the inner `TextField` _replaces_ that object and
  silently drops the classes/refs Autocomplete styles itself through — the field renders ~12px
  taller than a plain `size="small"` one and the popup anchors wrong. Always spread:
  `slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps?.htmlInput, … } }}`.
- `Alert` renders its own close X only when `onClose` is set **and** `action` is absent — `action`
  replaces it. Passing both compiles, looks right, and produces no close button (HTOO-65). If you
  supply `action`, put your own close control inside it.

## Known divergences from the template (intentional / out of scope)

- **JavaScript, not TypeScript** — a TS port is out of scope indefinitely; ignore TS-only steps
  in the skeleton doc (`ThemeName` union, `augmentation.ts`, `typecheck`).
- **Bridge name `window.electronAPI`** (template standard is `window.api`) — eventual, not urgent.
- **`react-window`** for virtualization (template prefers `@tanstack/react-virtual`) — eventual.
- **~~Windows portable-only~~ — CLOSED (HTOO-373).** Creidhne now ships the same five targets as
  taliesin and epona: `nsis`, `portable`, `deb`, `AppImage`, `dmg`. Kept here rather than deleted
  because the gap was load-bearing while it lasted — HTOO-351 was written against an installer
  Creidhne did not ship, so its prescribed fix could not have worked. **Read that card's two
  faults as target-specific:** the portable extraction-collision fix (`unpackDirName: true`)
  stands on its own, and `_CHECK_APP_RUNNING` becomes reachable now that an NSIS target exists.

  The target list lives in `electron-builder.yml` and nowhere else. Do not name targets in the
  workflow's packaging step: Taliesin shipped for months with `--win portable` against a config
  declaring both, publishing four assets where five were configured, with every gate green —
  a list of globs cannot report the entry missing from the list.
  `scripts/release-artifacts.test.mjs` pins the config's targets against the release globs in
  both directions, plus the signing steps, the upload paths and the per-platform fuse checks.
