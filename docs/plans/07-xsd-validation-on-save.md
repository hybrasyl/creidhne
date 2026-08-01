# WP7 — XSD validation at the IPC save boundary

**Size:** L. **Depends on:** —. **Status:** Planned, blocked. **Prompted by:** `docs/xsd-validation.md`, "Why we don't validate XML on save (yet)" — promoted to a WP 2026-07-31.

## Goal

Validate serialized XML against the Hybrasyl XSDs **before it is written to disk**, so creidhne
cannot save a file the server will reject.

## The prerequisite claim is false — read this first

`docs/xsd-validation.md` said this is "a one-helper change when prerequisites clear — the validator
is already wired up, just not called." **Verified 2026-07-31: it is not wired up.** The only
validator is `validateHybrasylXml(xml, fileName)` at `src/main/__tests__/xsdValidator.js:77`, and its
only two importers are `scripts/validate-xml.mjs:13` and `src/main/__tests__/xsdValidation.test.js:21`.
Nothing in production `src/main/` imports it. Four structural blockers stand between here and a call
site, and the WP is sized L because of them:

1. **It lives in the test tree.** Importing `src/main/__tests__/xsdValidator.js` from
   `src/main/index.js` pulls `__tests__` into the electron-vite main bundle. It must move to
   `src/main/xsdValidator.js`.
2. **`xmllint-wasm` is a devDependency** (`package.json:67`). It is absent from a packaged build and
   must be promoted to `dependencies` — which lands it in `app.asar`, so weigh it against the
   payload work R-003/R-005 just finished.
3. **The XSDs are not shipped.** `xsdValidator.js:10` resolves the schema directory relative to
   `process.cwd()`, which is meaningless in a packaged main process. `xsd/` is gitignored
   (`.gitignore:109`) and populated only by `npm run fetch-xsd`, so no build contains it. The 15
   `.xsd` files need bundling as an extraResource plus a dev/packaged path resolver.
4. **Serializer output currently fails validation.** The Tier-2 round-trip suite is `describe.skip`
   at `xsdValidation.test.js:115`. Turning validation on before those close would block saves.

Two implementation details must come along with the move: `sanitizeXsd()` (`:53`), which patches the
upstream `type="Foo "` trailing-whitespace bug, and the synthesized `MASTER_XSD` (`:33-42`), which
adds the missing top-level `<xs:element name="SpawnGroup" …/>` declaration.

## Blocked on

**Seven of the 14 types are `it.skip`ped** for known XSD-vs-reality drift — `KNOWN_DRIFT` at
`xsdValidation.test.js:67-75`: items (`<Description>` required inside `<Vendor>`), npcs (X/Y required),
localizations (element ordering), elementtables (exactly 9 Target per Source), castables
(`<Descriptions>` omitted from expected children), spawngroups (`SpawnFlags maxLength=3` vs 4+ flags),
serverconfigs (child ordering). Seven run clean: recipes, nations, lootsets, variantgroups, creatures,
statuses, creaturebehaviorsets.

**Every drift entry is an upstream `hybrasyl/xml` fix, not creidhne work.** This WP cannot start
until either those land or creidhne ships a locally patched XSD set — and the second is a real
decision with a maintenance cost, not a shortcut. `docs/xsd-validation.md` keeps the per-entry
**Fix:** lines; that catalog stays the authority.

## Design

- **One factory, not 14 edits.** All 14 XML save handlers in `src/main/index.js` share an identical
  two-line shape — `serialize…` then `writeFile(validatePath(filePath), xml)` (`xml:saveItem` `:302`
  … `xml:saveServerConfig` `:432`). Replace them with a `saveXml(channel, serializeFn)` factory that
  wraps serialize → validate → write. The 14 call sites collapse to 14 factory calls.
- **`fs:writeFile` (`:291`) is a second, bypassing write path.** A raw passthrough that reaches disk
  without serialization. Either route it through the same guard or document why it is exempt —
  otherwise validation-on-save is trivially circumventable and will read as enforced when it is not.
- **Validation must be advisory before it is blocking.** Ship it warning-only first, with the failure
  surfaced in the editor, so a drift case nobody predicted does not make a type unsaveable in the
  field. Promote to blocking per type only once that type is clean.

## Tests

- `xsdValidator` keeps its existing coverage after the move out of `__tests__/`.
- The `saveXml` factory: a valid document writes; an invalid one surfaces the error and (in blocking
  mode) does not write.
- The path resolver returns a real XSD directory in both dev and packaged layouts.

## Non-goals

- **Do not fix the XSDs here.** Every `KNOWN_DRIFT` entry is a `hybrasyl/xml` change.
- Do not unskip the Tier-2 suite as part of this WP; that is the prerequisite, tracked in
  `docs/xsd-validation-tier2-report.md`.
- No validation of `constants.json` / `formulas.json` — those are Zod-validated already and are not
  XSD-governed.

## Open questions (resolve at promotion)

- Locally patched XSDs or wait for upstream? Patching unblocks the WP now and buys a permanent
  divergence to maintain against every `fetch-xsd`.
- Does `xmllint-wasm` in `dependencies` cost enough package weight to prefer validating only on an
  explicit user action rather than on every save?
