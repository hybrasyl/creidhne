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
npm test             # vitest run (node project; ~1080 tests incl. scripts/)
npm run test:coverage
npm run lint:check   # eslint, no writes
npm run lint         # eslint --fix
npm run format       # prettier --write .
npm run build        # electron-vite build (main + preload + renderer)
npm run build:win    # packaged portable Windows build
npm run e2e          # build, then Playwright-drives the built app (local-only, needs a GUI)
npm run e2e:only     # E2E against the existing out/ build
```

There is **no `typecheck`** — Creidhne is JavaScript, not TypeScript. Gate before committing:
`npm run lint:check && npm test && npm run build`.

## Stack

electron-vite 5 · Electron 41 · **React 19** · **JavaScript (`.jsx`, not TS)** ·
MUI v9 + Emotion (style via `sx`, never styled-components) · **Zustand 5** · Zod 4 ·
Vitest 4 (node project) · Playwright (E2E). Package manager: **npm**. Shared packages:
`@eriscorp/hybindex-ts` (world index cache), `@eriscorp/dalib-ts` (`.datf` asset packs).

## Layout

```text
src/
  main/        main process — the only code that touches disk. index.js (lifecycle + window +
               IPC wiring), handlerContext.js, fsHandlers.js, pathSafety.js, settingsManager.js,
               schemaLog.js, splash.js, updateCheck.js, indexService.js + indexWorker.js
               (index build off the main thread), schemas/ (Zod), and per-domain XML
               (de)serializers: itemXml.js, castableXml.js, creatureXml.js, npcXml.js, …
  preload/     index.js — contextBridge, exposes window.electronAPI (+ toolkit window.electron)
  renderer/src/
    App.jsx          ThemeProvider + CssBaseline + settings-hydration gate
    components/ pages/ (23) store/appStore.js (zustand) themes/ (6) hooks/ utils/ data/
scripts/       release + XSD tooling (changelog-extract.mjs, validate-xml.mjs, generate-lua-stubs.js)
e2e/           Playwright specs against the built app
```

## Load-bearing house patterns (don't reinvent)

- **Main owns all disk/IPC I/O; the renderer only calls `window.electronAPI`** (the bridge in
  `src/preload/index.js`). Adding a feature = IPC handler → preload method → renderer call.
- **Path safety**: every renderer-supplied path is validated against session-allowed roots via
  `assertInsideAnyRoot` (`src/main/pathSafety.js`) before any fs op — never trust a renderer path.
- **Zod at the IPC boundary**: `settings:save`, `constants:*`, `formulas:save` payloads are
  validated (`src/main/schemas/`); failures log a breadcrumb next to settings (`schemaLog.js`).
- **Frameless window + custom chrome** (`MainToolbar.jsx` inside an `AppBar`); window controls
  message main via `minimize/maximize/close-window`.
- **Splash + `app:ready` reveal handshake**: the main window stays hidden until `App.jsx` finishes
  hydrating settings and calls `window.electronAPI.appReady()`.
- **Crash-safe JSON settings** under `%LOCALAPPDATA%\Erisco\Creidhne` (atomic tmp→rename + `.bak`).
  The renderer save effect is gated on `settingsLoaded` so defaults never clobber the real file.
- **World index is a rebuildable cache** outside the world's git folder
  (`%LOCALAPPDATA%\Erisco\hybindex`, shared with Taliesin), built incrementally off-thread and
  self-healed on load. Authoritative `constants.json`/`formulas.json` stay in `world/.creidhne/`.
- **Six themes** — hybrasyl (default) · chadul · danaan · grinneal · mundanes (light corporate) ·
  dubhaimid (dark corporate). `MainToolbar` swaps to flat window-control glyphs for the two
  corporate themes (`PLAIN_CHROME_THEMES`).

## Release notes (CHANGELOG-driven)

Author user-facing changes in `CHANGELOG.md` under `## [Unreleased]` as PRs land — **not** by
hand-editing the GitHub release afterward. Cutting a release promotes `[Unreleased]` →
`## [X.Y.Z] - YYYY-MM-DD` (fresh empty `[Unreleased]` above), `npm version X.Y.Z
--no-git-tag-version`, then tag `vX.Y.Z`. CI runs `scripts/changelog-extract.mjs` to put that
section atop the GitHub release body (`generate_release_notes` appends the auto PR list below).

## Verifying changes

`npm run dev` and `npm run e2e` launch a real Electron window and **cannot run
headless/sandboxed** — verify logic via `npm test` and `npm run build`, and hand GUI
click-throughs (and E2E runs) to the user.

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

## Known divergences from the template (intentional / out of scope)

- **JavaScript, not TypeScript** — a TS port is out of scope indefinitely; ignore TS-only steps
  in the skeleton doc (`ThemeName` union, `augmentation.ts`, `typecheck`).
- **Bridge name `window.electronAPI`** (template standard is `window.api`) — eventual, not urgent.
- **`react-window`** for virtualization (template prefers `@tanstack/react-virtual`) — eventual.
- **Windows portable-only** build target (template ships nsis + portable) — eventual.
