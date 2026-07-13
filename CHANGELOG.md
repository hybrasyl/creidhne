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

Sections below 1.5.0 predate this file; the older release history lives on GitHub
Releases. Entries from 1.5.0–1.7.0 were backfilled from those published notes when
this changelog was introduced.
-->

## [Unreleased]

### Fixed

- About dialog links now use the theme's info color so they're readable on the
  Hybrasyl theme (they previously used the near-black primary color).
- Recognize the new `town_maps` asset-pack content type (a Brigid runtime/UI type
  Creidhne doesn't consume) so loading such a pack is silently skipped instead of
  logging an "unknown content_type" warning.

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
