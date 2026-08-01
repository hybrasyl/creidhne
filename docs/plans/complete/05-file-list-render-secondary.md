# WP5 — `EditorFileListPanel` secondary render prop (restores the Formulas category chip)

**Size:** S. **Depends on:** —. **Status:** Built 2026-08-01. **Prompted by:** `docs/future-ideas.md`, "FormulasPage: restore category chip on the file list" — promoted to a WP 2026-07-31.

**Deviations from the design as planned:** the pure category mapping went to
`src/renderer/src/utils/formulaCategory.js` rather than being exported from the chip component, so
the node test project can cover it without importing MUI (see _Tests_). `FormulaEditor`'s duplicate
category list was folded onto the same source.

## Goal

Give `EditorFileListPanel` a `renderSecondary` render prop, and use it to put the category chip back
on the Formulas file list. The chip was dropped in `11d68a8` when Formulas migrated off its bespoke
`FormulaListPanel` onto the shared panel; nothing underneath broke, so this is a visual regression
with a one-prop fix.

## Current state (verified 2026-07-31)

- **The panel** is `src/renderer/src/components/shared/EditorFileListPanel.jsx` (755 lines). Its prop
  list (`:169-198`) has no `renderSecondary`. Secondary text is derived inside the memoized
  `VirtualRow` (`:121-124`) and rendered by one `<ListItemText>` at `:135-146`.
- **Row height is real and fixed at 52px** — `src/renderer/src/utils/fileTree.js:15-17`
  (`ITEM_HEIGHT = 52`, `FOLDER_HEIGHT = 32`), applied both as `sx={{ height: ITEM_HEIGHT }}`
  (`:133`) and as the react-window row height via `rowHeightFor` (`fileTree.js:245-247`, consumed at
  `EditorFileListPanel.jsx:247`). The height does not vary with whether a secondary line renders, so
  **a single-line chip needs no `itemHeight` override** — only a two-line secondary would.
- **It virtualizes** — `react-window`'s `List` (`:2`, rendered `:659-665`).
- **Consumers: 15 pages**, not the 13 the old note guessed — Behaviors, Castables, Creatures,
  Elements, Formulas, Items, Loot, Nations, NPCs, Recipes, ServerConfig, Spawngroups, Statuses,
  Strings, Variants (all under `src/renderer/src/pages/`).
- **Formulas renders no secondary line at all today.** `toPseudoFile` (`FormulasPage.jsx:34-37`) sets
  `name`, `rel` and `treePath` all to the formula name, and the page does not pass
  `namesByFilename` (`:396-412`), so `displayName === filenameBare` and `showSubtitle` is always
  false. The chip is not competing with a filename subtitle — the slot is empty.
- **`CATEGORY_COLORS` is module-local and not exported** — `FormulaPickerDialog.jsx:23-31`. The chip
  JSX is `:176-181` (`size="small"`, `sx={{ height: 16, fontSize: '0.65rem' }}`).
- **No path→formula map exists.** `FormulasPage` looks formulas up by linear scan (`findById`,
  `:96-99`). Note `toPseudoFile` puts the formula **`id`** in `file.path`, so the map is keyed on id.

## Design

1. **Export the chip, not the colors.** Hoist `CATEGORY_COLORS` and the chip into a small shared
   component (`src/renderer/src/components/shared/FormulaCategoryChip.jsx`) and have
   `FormulaPickerDialog` import it. Exporting the bare color map would let the two chips drift in
   size and shape again, which is how the styling diverged the first time.
2. **Add `renderSecondary?: (file) => ReactNode`** to `EditorFileListPanel`. When supplied, its
   return value replaces the `secondary` slot for **file rows only** (folder rows keep
   `secondary={null}`, `:105-111`). When absent, behavior is exactly today's — the filename fallback
   gated on `showSubtitle`. All 15 consumers are untouched.
3. **Thread it through the memo correctly.** `renderSecondary` must go into the `rowProps` memo
   (`:392-413`) **and its dependency array**, and `VirtualRow` is `memo`-wrapped (`:80`). Consumers
   must pass a `useCallback`-stable identity or every visible row re-renders on each parent render.
   Say so in a comment at the prop site — this is the failure mode a future consumer will hit.
4. **`FormulasPage`** builds a `Map<id, formula>` from `formulasData.formulas` in a `useMemo` (which
   also retires the `findById` linear scan) and passes a stable `renderSecondary` returning
   `<FormulaCategoryChip category={formula.category} />`.
5. **No `itemHeight` prop.** 52px already fits a chip at `height: 16`; adding a size knob with no
   caller is speculative. If a consumer later needs a two-line secondary, that WP adds it.

## Tests

**Corrected at build time (2026-08-01).** This section originally called for component-render tests.
**They cannot run:** `vitest.config.js` sets `environment: 'node'` and the repo has no `jsdom`,
`happy-dom` or `@testing-library/react` — every renderer test is a pure-helper test, and the config
states the UI layer is "intentionally not thresholded — validated by manual smoke tests." E2E is no
substitute either: `e2e/` covers boot, settings and the security boundary only, with no world-library
fixture that would give a Formulas list any rows. Adding a jsdom tier is its own decision, not a
rider on an S-sized visual fix.

What was built instead:

- The category→label and category→color mappings live in `src/renderer/src/utils/formulaCategory.js`
  as plain functions, unit-tested in `src/renderer/src/__tests__/formulaCategory.test.js` (8 cases):
  every known category maps to its own palette color, an unknown one to `'default'`, an absent one is
  labelled `'damage'` while staying colored `'default'`, and `knownFormulaCategories()` returns a
  fresh array so a caller cannot mutate the map.
- The JSX itself — chip in the file list, chip in the picker — is verified by hand.

**A behavior asymmetry was preserved deliberately.** `FormulaPickerDialog` labelled an absent
category `'damage'` (`:177`) but colored it `'default'`, not `'error'` (`:179`). The extracted chip
reproduces this exactly so nothing on screen changed; the test pins it and the source comments say
why. Whether the two should agree is a design question, and is left open.

**One extra consolidation.** `FormulaEditor.jsx:40` held a third copy of the category list, identical
in content and order. It now calls `knownFormulaCategories()`, so a category cannot reach the editor
dropdown without also having a chip color.

## Non-goals

- Do not migrate the other 14 pages onto `renderSecondary`. The prop makes items-showing-category and
  statuses-showing-duration possible later; opting them in is each page's own change.
- No `itemHeight` override (see design 5).
- Do not touch the formulas schema — `formulas.js` is `.passthrough()` and `description`, `category`,
  `patternId` and per-formula coefficient overrides already round-trip.

## Acceptance criteria

1. The Formulas file list shows a colored category chip under each formula name, matching the chip in
   the formula picker dialog.
2. The other 14 consumer pages render identically to before.
3. Scrolling a long formula list stays smooth — no per-row re-render from an unstable prop.
4. All checks green (`npm run lint:check && npm test && npm run build`).
