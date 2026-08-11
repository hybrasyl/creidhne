# Changelog

All notable user-facing changes to Creidhne are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is
[Semantic Versioning](https://semver.org/).

<!--
Release process (the notes are authored HERE, not edited on GitHub after the fact):
  1. As you land a PR, add its user-facing change under ## [Unreleased]
     (Added / Changed / Fixed / Removed / Deprecated / Security).
  2. To cut a release: rename ## [Unreleased] to ## [X.Y.Z] - YYYY-MM-DD, add a
     fresh empty ## [Unreleased] above it, and bump package.json to X.Y.Z
     (npm version X.Y.Z --no-git-tag-version).
  3. Tag vX.Y.Z and push. The release workflow runs scripts/changelog-extract.mjs
     to pull THIS version's section into the GitHub release body, then appends the
     auto-generated PR list below it.
Keep entries user-facing — internal refactors/tests show up in the appended auto list.

Entries for 1.0.0–1.7.0 predate this file and were backfilled from the published
GitHub release notes, condensed into the sections above. Those releases remain the
verbatim record; 1.0.0 shipped without notes, hence the bare stub.
-->

## [Unreleased]

### Changed

- **Creidhne now runs as a single instance.** Launching it again brings the window
  you already have to the front instead of starting a second copy — and if that
  window was minimized, it is restored rather than just given focus in the
  taskbar. Two copies previously shared one settings file, one world index and one
  session log, and raced each other over all three.

- **Downloads are named in lowercase**, matching every other Hybrasyl tool —
  `creidhne-1.10.0-portable.exe` rather than `Creidhne-1.10.0-portable.exe`, and
  the Windows program itself is now `creidhne.exe`. The app is still called
  Creidhne everywhere you see its name; only the filenames changed. A desktop
  shortcut to the old filename needs remaking.

- **The world index rebuilds itself once, the first time you open a library.**
  The index format changed, so the old cache is discarded and rebuilt from your
  world. It happens automatically and the progress pill shows it; nothing needs
  doing and nothing in the world folder is touched.

### Fixed

- **Selected things are visible again on the hybrasyl theme.** The theme's primary
  colour was the same value as the page background, so anything that marks itself
  as active or selected painted itself invisible — and it read backwards, because
  the _unselected_ items kept their grey. The selected chip, the highlighted
  border in the sprite, icon, sound, effect and portrait pickers, and the
  monospace snippets on the Lua Helpers page were all affected. Primary is now the
  legible blue that was already sitting in the palette, with dark label text so
  button and chip captions meet the accessibility contrast bar.
- **Names holding an `&` are no longer escaped twice.** A name like
  `The Crow & Cask` was read out of the world index still carrying its `&amp;`,
  so picking it from a list and saving wrote `&amp;amp;` — a value that matches
  no map, which quietly killed the warp pointing at it. Two such warps exist in
  the production world and both can now be repaired by re-picking the
  destination.
- **A missing weapon is back in the weapon pickers.** Weapons that leave the
  large-damage range at its default, or write `<Damage>` as a paired tag rather
  than self-closing, were dropped from the index with no error and no way to
  tell them from a non-weapon. Oak Stick was the one this affected.
- **The portable build no longer shows "Creidhne cannot be closed."** Launching a
  second copy of the portable exe made its launcher try to unpack over the copy
  already running, and after a few seconds of failing it raised that Retry/Cancel
  box — most visibly over Remote Desktop, where everything is slower. Each launch
  now unpacks to its own directory, so the second copy simply hands you the window
  you already have.
- **Formulas show their category again.** Each formula in the list carries its
  colored category chip, the same one the formula picker shows. The chip was
  lost when the Formulas list moved onto the shared file list, so a category was
  only visible after opening the formula.

### Security

- **Electron updated to 41.10.4**, closing five advisories — among them a
  context-isolation bypass and a `contextBridge` prototype-setter leak. Creidhne
  runs its renderer sandboxed, and both of those reach a sandboxed app.
- **The remaining dependency advisories are cleared**, so `npm audit` reports
  nothing outstanding. All of them were in build and lint tooling rather than in
  anything Creidhne ships.

## [1.10.0] - 2026-08-01

### Added

- **Spellbooks** are now a top-level editor. A spellbook is a named bundle of
  castable categories and/or individual castables, with a live preview of the
  full spell list it resolves to (categories expanded to their members). Saving a
  book stamps its name as a category onto every castable it covers, so a behavior
  set can pull in the whole book with one token — the Castables section of the
  behavior-set editor has a new **Add from spellbook** picker for that. A
  confirmation appears first when a book would edit many castable files. This
  replaces the old Spell Books tab in Constants; existing books carry over.

- Every entity editor now has a **Folder** picker next to the filename, so you can
  file a new entity into a subfolder (`castables/universal/…`) or move an existing
  one between folders. Type a folder that doesn't exist yet and it's created on
  save. Previously subfolders could only be read: anything you created landed at
  the type root, and moving a file meant doing it outside the app.

- **What's new** — Settings has a new button that shows the release notes in the
  app. It replaces "Reveal logs folder", which stays available from the "Report an
  issue" dialog.

- **Castables can be exported as JSON** for the Hybrasyl website, alongside the
  existing CSV. It carries the same data as the web CSV and excludes test and GM
  abilities in the same way.

- **macOS builds have a proper app icon** — a gold dividers mark on a dark
  squircle, drawn for the Dock and sized to Apple's icon grid instead of the
  square logo the other platforms use. Windows and Linux are unchanged.

### Changed

- **The two castable exports are now one Castables card with three buttons** —
  Balancing CSV, Web CSV and Web JSON — and all three are built from one shared
  record, so their columns can no longer drift apart. The balancing export saves
  as `castables_balancing.csv` rather than `castables_excel.csv`, and only the
  button you press shows a spinner.

- **A castable with no requirements now exports its minimum stats rather than
  blanks.** 3 is the minimum stat and 1 the minimum level, so the balancing
  export reads the same as the website already did. Two further column fixes:
  requirement stats are ordered Str, Int, Wis, Con, Dex everywhere (the web CSV
  had Dex and Con reversed), and the balancing sheet's status columns are all
  named `StatusAdd1`/`StatusAdd2`/`StatusAdd3` — previously only the first was.

- **The download is smaller and the boot reads as one piece.** The portable build
  dropped from about 105 MB to about 87 MB — Creidhne no longer ships its
  interface libraries, test files or documentation inside the app, and the logo
  art is now sized for where it is drawn instead of decoded from a 1024px master
  every time. The portable extraction screen is also a frozen frame of the app
  splash, so the two screens you see at startup now match.

- The **Lua Helpers page** is now a grid of cards matching Settings, and scrolls
  properly — the setup tips previously ran off the bottom of the window on larger
  displays with no way to reach them.

- Links in the **hybrasyl** theme now use the info accent, so they read clearly
  instead of blending into the low-contrast primary blue.

### Fixed

- Renaming a **spawn group** now actually takes effect. The filename field was
  being ignored on save — the file was always written back under its original
  name — and now behaves like every other editor, archiving the file it replaces.

- **The custom scrollbar now follows the theme.** It was hardcoded to the
  hybrasyl teal on a dark gutter, so it looked wrong under the other themes —
  especially the light corporate one. It now recolors from the active theme's
  palette.

- **Sprites and portraits now render true to the client.** Creidhne moved to
  dalib 3.0, which fixes the SPF decode (NPC portraits and other SPF frames now
  honor each frame's offset and pitch, so frames no longer skew or shift) and draws
  ground tiles like the game does. Some art that looked wrong or misaligned in the
  pickers now matches what players see.

- **Lua IntelliSense is quiet out of the box.** The bundled type stubs no longer
  report problems of their own (they describe a C# API, so Lua lint rules don't
  apply to them), and the generated `.luarc.json` now also silences
  `undefined-global` and accepts Hybrasyl's `!=` inequality operator instead of
  flagging it as a syntax error. The Helpers page documents the equivalent manual
  VS Code settings for anyone whose workspace root isn't `world/scripts/`.

### Security

- **Creidhne's interface now runs in a sandbox, and the boundary around it is
  closed.** The window that draws the editor no longer has direct access to the
  operating system; it reaches the file system only through the small, named set
  of operations Creidhne exposes to it. Each of those requests is now checked to
  come from a real Creidhne window before it runs. Links open in your browser
  only when they are ordinary web or mail links, the window can no longer be
  navigated away from the app itself, and the packaged build closes a known way
  of restarting Electron as a general-purpose script runner. Nothing you do in
  the app changes; this closes routes a malicious world file or link could
  otherwise have taken.

- Cleared a high-severity denial-of-service advisory in `brace-expansion`
  (GHSA-mh99-v99m-4gvg) that reached the project through build tooling only. No
  shipped code was affected, and the app itself is unchanged.

## [1.9.0] - 2026-07-19

### Added

- **Report an issue.** A new bug icon in the toolbar (and a button on the Settings
  About card) opens a report dialog: describe what happened and either open a
  prefilled GitHub issue or copy the report to your clipboard. Creidhne now keeps
  the last five session logs (errors only) under a **logs** folder you can reveal
  from the dialog. Attached diagnostics — app version, OS, and recent errors — are
  automatically scrubbed of usernames, file paths, and other identifying details,
  and shown to you for review before anything is sent.

### Changed

- The **Settings page** is now a grid of cards, each framing a section
  (Appearance, Content Libraries, Dark Ages Client, Brigid Assets, Companion App,
  About) instead of one long scrolling list.
- The theme selector is now a **visual picker**: each theme is a preview card
  painted in its own palette, replacing the plain dropdown.
- **About** moved from the title bar into a Settings **About** card, now modelled
  on the sibling apps: app logo, name, version line, project links, and a **Reveal
  settings folder** button alongside the About dialog.
- The title-bar wordmark and toolbar icons now carry a black keyline outline and a
  soft drop-shadow on the stylized themes, lifting them off the chrome. The
  corporate themes (Mundanes, Dubhaimid) stay flat.

### Fixed

- **Install Lua types** now works in installed builds. The bundled Lua type stubs
  were missing from packaged releases, so the Helpers action failed with a
  "cannot find lua-stubs" error; they now ship with the app. This also restores the
  XSD-derived value lists in the Constants editor, which were empty in packaged
  builds for the same reason.

## [1.8.0] - 2026-07-16

### Added

- Editor file lists now show **Active** and **Archived** as tabs, replacing the
  show/hide-archived eye toggle. The archived list is virtualized too, so large
  archives (Spawngroups has 583) scroll smoothly.
- File lists can **group by folder** or show one flat list, toggled from the
  panel header. The choice is saved and applies to every editor.
- Two new corporate themes — **Mundanes** (light) and **Dubhaimid** (dark) —
  bringing the theme count to six. Both use flat window-control chrome rather
  than the sculpted Hybrasyl-style buttons.

### Changed

- The world index cache format advanced a version. The cache is stored per
  format version, so **the first launch after updating rebuilds the index once
  for each world** — that's expected and needs no action.
- Upgraded to **React 19** and replaced the unmaintained Recoil state layer with
  Zustand. No change to how the app behaves; Recoil couldn't run on React 19 and
  was holding the app back on React 18.

### Fixed

- Castables filed in a subdirectory were **missing from both CSV exports** and
  from the Constants category/vendor-tab/job/family scans. Every place that
  reads world XML now searches subdirectories, and still ignores `.ignore/`.
- Renaming a file filed in a subdirectory silently moved it to the top level of
  its type. It now stays where it was filed.
- Archiving a file from a subdirectory flattened it into the top of `.ignore/`,
  and unarchiving returned it to the top level rather than where it came from.
  Two same-named files in different folders could also collide, silently
  renaming one to `name_1.xml`. Archive now mirrors the folder structure and
  round-trips.
- A reference could resolve to an archived entity when a live one shared its
  name, showing content the server never loads.
- The file list lost its selection highlight after renaming a file.
- About dialog links now use the theme's info color so they're readable on the
  Hybrasyl theme (they previously used the near-black primary color).
- Recognize the new `town_maps` asset-pack content type (a Brigid runtime/UI type
  Creidhne doesn't consume) so loading such a pack is silently skipped instead of
  logging an "unknown content_type" warning.
- Creidhne identified itself to Windows under a boilerplate app id, so it could
  show up wrong in the taskbar and Task Manager and misbehave when pinned.

## [1.7.0] - 2026-07-02

### Added

- **Hybrid formula generator** — "New Hybrid" on the Formulas page creates a linked pair of
  complementary formulas in one step: a direct-hit formula (for a castable) and an over-time
  formula (for a status), split by a direct/over-time percentage that scales each half's
  coefficient. The two stay linked — editing the split re-derives the partner, and
  archiving/deleting one applies to both.
- **Hybrid over-time delivery (HyoT)** — formula delivery now exposes the full model:
  effect-aware DoT/HoT for pure over-time plus HyoT for the hybrid over-time portion, with a
  per-formula split. (The `HDOT` coefficient key was renamed to `HYOT`, auto-migrated on load.)
- **Startup splash screen** — a branded splash appears instantly at launch and the main window
  is held back until the UI has hydrated, so the first frame you see is already populated.

### Fixed

- Heal-over-time formulas were silently assembling with a coefficient of 0 (the editor built
  `HEAL_ST_DOT`, but the catalog key is `HEAL_ST_HOT`) — now resolves correctly.
- Settings page is fixed to the window height with an internal scrollbar.
- Pickers rescan for newly-added `.datf` asset packs each time they open (no restart needed).
- Resolved React console warnings (key-in-spread, DOM `alignItems`).

### Changed

- **~48% smaller startup bundle** — initial JS dropped 2.77 MB → 1.43 MB via route
  code-splitting, and the 4.9 MB SVG logo was replaced with the branded PNG.
- Snappier pickers & editors — resolved pack images are cached in the renderer (far fewer IPC
  round-trips per grid scroll); the file-list panel, sprite canvases, Damage Calculator, and
  Spawngroup editor no longer re-filter/re-allocate/re-render on unrelated changes.
- Less main-process I/O — opening a picker no longer re-unzips every `.datf` when nothing
  changed, and reference lookups resolve via the index instead of parsing a whole directory.

## [1.6.0] - 2026-06-29

### Changed

- **World index moved out of your git repo.** The derived index used to be written into
  `world/.creidhne/` (polluting the world repo); it now lives in a per-machine shared cache —
  `%LOCALAPPDATA%\Erisco\hybindex\` (Windows) / `~/.config/erisco/hybindex/` (macOS/Linux).
  Authoritative `constants.json` / `formulas.json` stay in `world/.creidhne/`. The cache is
  shared with Taliesin, so both tools build it once; multiple libraries get separate caches.
  Creidhne cleans up the old in-repo index files automatically on the next build.
- **Faster, incremental index builds** — each XML file is read once, reads run in parallel, and
  rebuilds skip unchanged sections via a build signature (a no-change rebuild is near-instant).
- **Settings moved to LocalAppData** — settings now live in `%LOCALAPPDATA%\Erisco\Creidhne`
  (Local) instead of Roaming, migrated automatically on first launch.

### Added

- **Self-healing index on load** — opening a library whose index is missing (fresh clone) or
  stale (edited outside Creidhne) rebuilds it automatically; no manual "Rebuild Index" needed.

## [1.5.2] - 2026-06-24

### Added

- Creature sprites render from `hades.dat` at runtime.

### Changed

- Signed + notarized universal macOS dmg builds in the release pipeline.
- Resolved 9 of 10 npm audit advisories.

## [1.5.1] - 2026-06-19

### Changed

- Windows build signing added; Ubuntu `.deb` / AppImage artifacts added to releases.

## [1.5.0] - 2026-04-26

### Added

- **Bulk operations across every editor** — multiselect with Ctrl/Shift, then archive,
  unarchive, delete, or duplicate any number of files at once. Delete moves to the OS Recycle
  Bin / Trash with a confirmation; right-click mirrors the toolbar.
- **Formula archive + Formulas page redesign** — formulas archive in place and the Formulas page
  uses the same shared list panel as every other editor. Castables/statuses referencing an
  archived formula highlight red with a "Replace before saving" prompt; the formula picker hides
  archived entries by default (toggle to show).
- Creature `WeaponPicker` reading from the indexed item set, with subtype-level weapon
  persistence; Castable Reactor `Uses` accepts formulas; a proper Variants section.

### Fixed

- Stuck index-build progress pill after partial rebuilds.
- Dashboard / ManageLibraries rebuild buttons no longer wipe constants-derived index fields.
- `formulasSchema` was silently stripping `description` / `category` / `patternId` on save (zod 4
  strips by default) — now passes them through.

### Security

- Path-safety guards (`assertInsideAnyRoot`) on every IPC handler — the renderer cannot reach
  paths outside the configured library / clientPath / dialog-blessed roots.
- `app:launchCompanion` whitelisted to `settings.taliesinPath`.
- zod schemas validate `settings:save`, `constants:saveUserConstants`, `constants:addValue`,
  `formulas:save`; failures land a breadcrumb in `ipc-validation.log`.

## [1.4.0] - 2026-04-19

### Added

- **Launch Taliesin from Creidhne** — the companion app opens directly, no more hunting for the
  other window (mirroring the "Launch Creidhne" button Taliesin has shipped since v2.0.0). An
  anvil toolbar button launches it from anywhere; the Maps and World Maps dashboard cards are no
  longer disabled and open it too. Configure the path under _Taliesin (Companion App)_ in
  Settings — entry points stay disabled with a tooltip until it's set. Taliesin runs detached, so
  closing Creidhne leaves it open.

### Changed

- **Toolbar restructure** — Formulas, Damage Calculator, Lua Helpers, Exports, and Constants
  moved out of the right-aligned group into the centered group alongside the editors, separated
  by a divider. The right side is now app actions only: Settings · Launch Taliesin · About.
  _About Creidhne_ moved off the Settings page onto the toolbar behind an info icon.

## [1.3.0] - 2026-04-18

### Added

- **Damage Calculator** — a new top-level page for previewing castable damage output before
  shipping XML changes. Per-player test harness with a modal editor (persisted in
  `constants.json`), formula picker with optional castable/weapon/override inputs, Low/Avg/High
  roll evaluation via a hand-rolled NCalc-subset evaluator, and per-player level-sweep
  sparklines. Castable `ACQUIREDLEVEL` and weapon damage ranges autopopulate from the index.
- **Lua authoring environment** — everything needed for IntelliSense on Hybrasyl server scripts
  in VS Code: 20 auto-generated type stubs (1,249 lines) covering `HybrasylUser`,
  `HybrasylWorld`, the dialog DSL and more; a `.luarc.json` template wiring the sumneko Lua LSP
  to them with all magic globals (`world`, `origin`, `source`, `target`, `player_response`,
  `this_script`); a one-click "Install Lua types" button on the Lua Helpers page to deploy both
  into `world/scripts/`; open-script buttons wherever a script is referenced; and an NCalc-aware
  transpiler that saves the current formula set to `formulas.lua` as a usable Lua module.
- **Hybrasyl asset pack support (`.datf`)** — the client install directory can ship custom
  PNG-based packs that override vanilla Dark Ages EPF assets, shipping with `hybicons.datf` (335
  spell + skill icons) and `hybnations.datf` (96 nation crests). A `Vanilla | Hybrasyl` toggle
  appears in the icon and nation crest pickers when a pack is installed, editors preview both
  side by side when each covers the same ID, and pack-only IDs (e.g. `spell0300`) become
  pickable in Hybrasyl mode. The toggle persists across sessions.

### Changed

- **Major dependency sweep** — Vite 6 → 7, `@vitejs/plugin-react` 4 → 5, react-window 1 → 2
  (full API migration across all 9 picker dialogs and the shared file list panel), and MUI 7 → 9
  including a codemod pass migrating `*Props` shortcuts to the `slotProps` API.

## [1.2.0] - 2026-04-15

### Added

- **Spell Books** — a new tab on the Constants page for creating named collections of castables
  via a dual-list picker. Saving writes the book to `constants.json` **and** propagates its name
  as a category onto each selected castable's XML, so BehaviorSets can reference it immediately.
- **Formula "Used by" panel** — the Formula Editor now shows chips for every castable and status
  that references the formula you're editing.
- **Index build progress** — a compact top-left status pill reports scan progress in real time.

### Changed

- **Index rearchitecture** — world indexing moved into a dedicated shared package,
  [`@eriscorp/hybindex-ts`](https://www.npmjs.com/package/@eriscorp/hybindex-ts), consumed by
  both Creidhne and Taliesin; per-type index files (`castables.json`, `items.json`, …) replace
  the monolithic `index.json`, with the legacy file migrating silently on first load; and builds
  now run off the main process via Electron `utilityProcess`, so full scans on large libraries
  no longer freeze the UI. ⚠️ **Existing libraries need an index rebuild** to populate the new
  per-type layout.

## [1.1.0] - 2026-04-14

### Added

- **Formula editor: phase 2** — a settings modal with budget modifier, coefficients, and
  patterns; pattern-driven editors for Base Damage, Weapon Damage, and Stat Block; castable and
  status reference with auto-load; plus a coefficient calculator, the full NCalc variable
  catalog, clean formula assembly, a hand-edit toggle, and per-formula global overrides.
- **Sprite pickers** — all in-scope pickers shipped: item sprite, color swatch, sound, spell
  effects, display sprite (khan), NPC portrait, spell/skill icons, and nation crest.
- **Update alert** — Creidhne checks GitHub Releases on startup and tells you when a new version
  is out, with a link to the release page. A manual "Check for updates" button lives on the
  Settings page.
- **Reference side panel** — a right-side collapsible panel for read-only lookup of any entity
  without leaving your current editor, with a type dropdown and searchable autocomplete.
  Castable, status, item, and creature get formatted summary views; the other 9 types fall back
  to raw XML.

### Changed

- File lists now show the inner `<Name>` as primary text with the bare filename as a muted
  subtitle when the two differ, and the filter matches either — searching "ard sal" finds
  `wizard_psp_ard-sal.xml`. ⚠️ **Existing libraries need an index rebuild** for the name-based
  filter to work.
- Large lists (2,000+ items) render smoothly via virtualization.

### Fixed

- A "no items found" flash on initial load, replaced by a loading spinner.

## [1.0.0] - 2026-04-11

Initial release.
