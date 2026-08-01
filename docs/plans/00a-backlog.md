# Creidhne backlog & deferral register

Read `00-overview.md` first. This register holds what is **not** a WP: work owed to another repo, and
items parked behind a named trigger. A parked item may hold a WP number so it can be referenced and
branched without renumbering — **a number is not a commitment.**

**Replaces `docs/future-ideas.md`** (retired 2026-07-31). All three of its entries were promoted to
real WPs — weapons tab and creature revamp → **WP4**, the Formulas category chip → **WP5**,
spawngroup spellbook support → **WP6** — so the file had nothing left to hold. Its fourth
descendant, XSD validation on save, came out of `docs/xsd-validation.md` and is **WP7**.

## Owed to another repo — not creidhne code, so not a creidhne WP

- **`@eriscorp/hybindex-ts` — two `itemWeaponDamage` scrape bugs.** In `dist/index.js:762-779`: the
  regex matches **self-closing `<Damage … />` only**, so a paired `<Damage>…</Damage>` contributes
  nothing; and the `sMin?.[1] && …` guard drops any weapon with `SmallMin="0"`, because `"0"` is
  falsy. Both silently shrink the weapon list every consumer sees. Per the shared-package rule these
  are fixed in the package and consumed by version bump — **do not work around them in creidhne.**
  WP4 depends on this. Found 2026-07-31 while scoping WP4.

- **`hybrasyl/xml` — the seven XSD drift fixes.** Each entry in `docs/xsd-validation.md`'s drift
  catalog carries its own **Fix:** line: items, npcs, localizations, elementtables, castables,
  spawngroups, serverconfigs. They are the standing blocker on **WP7**, and the catalog in that doc
  stays the authority — do not duplicate the fixes here.

## Parked — behind a named trigger

- **`fs:writeFile` is a second write path that bypasses serialization** (`src/main/index.js:291`).
  Harmless today; it becomes a correctness hole the moment WP7 makes validation-on-save look
  enforced, because a raw write skips the guard entirely. _Trigger:_ WP7 reaching blocking mode.
  Recorded there too, so it cannot be missed from either end.

- **Unskip the Tier-2 serializer round-trip suite** (`src/main/__tests__/xsdValidation.test.js:115`,
  `describe.skip`). `docs/xsd-validation-tier2-report.md` found the real regression count is 1, not
  14, and that one is already fixed — so this may be closer than the skip implies. _Trigger:_ the
  `hybrasyl/xml` drift fixes landing, which is the same trigger as WP7.

- **`src/shared/externalUrl.test.js` never runs.** `vitest.config.mjs:6` collects only
  `src/**/__tests__/**/*.test.js`; that file sits beside its source, so it is silently skipped _and_
  counted as uncovered source in the coverage report. Moving it into `src/shared/__tests__/` is a
  one-line fix, but it may fail once it actually runs, which is why it is not a drive-by. _Trigger:_
  the next piece of work that touches `externalUrl.js`. Found 2026-08-01 while building WP1.

- **`npm run test:coverage` emits a Rollup `Expression expected` parse warning.** Present on `main`,
  confirmed against a clean worktree; coverage still exits 0 and thresholds still apply, so nothing
  is silently unmeasured. _Trigger:_ a coverage number that looks wrong, or a vitest/rollup bump.
  Found 2026-08-01 while building WP1.

- **`EditorFileListPanel` secondary for the other 14 pages.** WP5 shipped the `renderSecondary` prop
  (2026-08-01) and uses it on Formulas only. Items showing category and statuses showing duration
  were the named candidates. _Trigger:_ someone actually wanting one — the prop makes each an opt-in
  of a few lines, so there is nothing to pre-build. Note the prop must be `useCallback`-stable; the
  panel feeds it into a memoized row-props object.

## Non-goals — no trigger, these stay out

- **A TypeScript port.** Out of scope indefinitely (`CLAUDE.md`, _Known divergences_). Recorded here
  so it is not re-proposed as a cleanup.
- **XSD edits from creidhne.** `xsd/` is a fetched artifact (`.gitignore:109`). Schema changes are
  always `hybrasyl/xml` work; a local patch set is a decision WP7 raises explicitly, not a default.
