# Manually validating XML against the Hybrasyl XSDs

When something looks wrong with a save / round-trip / fixture, the first
question is usually: *is the file actually invalid, or is the bundled XSD
out of date?* This doc captures the workflow and the cases we already know
the answer for.

## Quick start

The repo ships [`scripts/validate-xml.mjs`](../scripts/validate-xml.mjs),
which wraps `xmllint-wasm` against the same `xsd/src/XSD/` collection the
test suite uses. No extra setup beyond `npm install`.

```sh
# Validate one file (or several)
node scripts/validate-xml.mjs path/to/some.xml

# Validate every fixture under src/main/__tests__/fixtures/xml/
node scripts/validate-xml.mjs
```

For each failing file the script prints the raw `xmllint` error: line
number, the offending element, and what the XSD expected at that position.

## Reading an error

A typical failure looks like:

```
FAIL src/main/__tests__/fixtures/xml/castables/priest_usk_wield-holy-staff.xml
     priest_usk_wield-holy-staff.xml:4: Schemas validity error :
     Element '{http://www.hybrasyl.com/XML/Hybrasyl/2020-02}Descriptions':
     This element is not expected. Expected is one of (
     {http://www.hybrasyl.com/XML/Hybrasyl/2020-02}Categories, ... ).
```

Three things to check, in order:

1. **Is the element in the XSD at all?** `git grep 'name="Descriptions"' xsd/src/XSD/`.
   If it's missing, the XSD lags the codebase (we added a feature but
   upstream hasn't landed it).
2. **Is the XSD using `<xs:sequence>`?** `<xs:sequence>` enforces strict
   element order; `<xs:all>` allows any order. The error message lists what
   `xmllint` was *expecting at that position* — if your element is real but
   it's expected in a different slot, this is an ordering issue.
3. **Is a count or length restriction firing?** Look for `minOccurs` /
   `maxOccurs` on the parent type, or `<xs:maxLength>` on a list type.

A run on the whole fixture set against the *unpatched* upstream XSDs
currently produces 7 known failures — see the catalog below.

## Why we don't validate XML on save (yet)

Branch 4's path-safety pass set up the wiring needed for IPC validation,
and we considered shipping XSD validation on every `xml:save*` handler.
The remaining blocker:

- **The XSD-vs-real-data drift catalog below** — wrapping save handlers
  with strict XSD validation would refuse legitimate user data on 7 of
  the 14 XML payload types until upstream `hybrasyl/xml` lands the
  fixes (or we ship a creidhne-local patched XSD set).

The Tier-2 serializer round-trip suite was originally cited as a
second blocker (the existing `describe.skip` comment in
[`xsdValidation.test.js`](../src/main/__tests__/xsdValidation.test.js)
claims "14 real serializer regressions"). A targeted re-run showed
the actual count was **1, not 14** — `serverconfigs` was reordering
`<Motd>` to the front of its output. That regression is fixed; see
[`xsd-validation-tier2-report.md`](xsd-validation-tier2-report.md) for
the full per-type analysis. Once the upstream XSD drifts close, every
Tier-2 case becomes a clean round-trip.

Flipping XSD validation on at the IPC boundary is a one-helper change
when prerequisites clear — the validator is already wired up, just
not called.

## Drift catalog (current as of 2026-04-25)

These are the cases where a real-world fixture fails XSD validation. None
are bugs in the data; the data is what the game server actually accepts
and uses. Each entry is mirrored in `KNOWN_DRIFT` in
[`xsdValidation.test.js`](../src/main/__tests__/xsdValidation.test.js)
so the corresponding fixture validity test stays `it.skip`'d.

### items — `Vendor.Description` required

```
Vendor: Missing child element(s). Expected is ( ...Description ).
```

XSD ([Item.xsd:184](../xsd/src/XSD/Item.xsd#L184)) declares `Description`
as a required child of `Vendor`. **In practice, `Description` is inserted
at runtime from a metafile for stocked items but is legitimately absent
on quest items** (which have `<Vendor ShopTab="Quest"/>` only). The server
handles both shapes without error.

**Fix:** upstream XSD edit — `<xs:element name="Description"
minOccurs="0" .../>`.

### npcs — `Npc.X` / `Npc.Y` required

```
Npc: The attribute 'X' is required but missing.
Npc: The attribute 'Y' is required but missing.
```

XSD ([Common.xsd:1129-1130](../xsd/src/XSD/Common.xsd#L1129-L1130)) marks
`X` and `Y` as required on the `Npc` complexType. The same complexType is
used in two places:

- **Standalone NPC files** (`world/xml/npcs/*.xml`) — these define an NPC
  *template* (name, dialogue, roles). Hundreds of these files exist with
  no `X`/`Y`; the server accepts them.
- **`<Map><Npcs>` placements** — these put a previously-defined NPC on a
  specific tile and *do* need `X`/`Y`.

**Fix:** upstream XSD edit — make `X`/`Y` `use="optional"`, or split the
type into `NpcTemplate` + `NpcPlacement`.

### localizations — element ordering / required elements

```
MonsterSpeak: This element is not expected. Expected is ( ...NpcSpeak ).
```

XSD ([Localization.xsd](../xsd/src/XSD/Localization.xsd)) defines:

```xml
<xs:complexType name="Localization">
  <xs:sequence>
    <xs:element name="Common" .../>
    <xs:element name="Merchant" .../>
    <xs:element name="NpcSpeak" .../>
    <xs:element name="MonsterSpeak" .../>
    <xs:element name="NpcResponses" minOccurs="0" .../>
  </xs:sequence>
</xs:complexType>
```

`<xs:sequence>` enforces strict order. The fixture omits `Common` /
`Merchant` and orders `MonsterSpeak` before `NpcSpeak`. **Real
localization files don't necessarily contain every section, and order
between them isn't semantically meaningful.**

**Fix:** upstream XSD edit — switch to `<xs:all>` and lower
`minOccurs="0"` for sections that aren't always present.

### elementtables — exactly 9 Source × 9 Target

```
Target: This element is not expected.
Source: This element is not expected.
```

XSD ([ElementTable.xsd:36,43](../xsd/src/XSD/ElementTable.xsd#L36))
constrains both Source and Target to exactly 9 children
(`minOccurs="9" maxOccurs="9"`). Real tables now ship with 10 elements
(an `Undead` element was added).

**Status:** an upstream branch is in review to switch these to unbounded.
Creidhne is ahead of the released XSD here.

### castables — element ordering

```
Descriptions: This element is not expected. Expected is one of (
  Categories, CastCosts, Intents, MaxLevel, Requirements, ... ).
```

XSD ([Castable.xsd:344-356](../xsd/src/XSD/Castable.xsd#L344-L356)) lists
`Descriptions` as the *first* child of `Castable`, before `Name`. Real
files (and our serializer) put `Name` first. The XSD's expected-at-this-
position list excludes both `Name` and `Descriptions` because the parser
has already moved past them looking for `Categories`.

**Open question:** does element order matter at the same level? In XML
generally, no. In XSD with `<xs:sequence>`, yes. The fix is either
reorder the XSD entries or switch the type to `<xs:all>`.

**Fix:** upstream XSD edit — reorder `Name` before `Descriptions`, or
switch to `<xs:all>`.

### spawngroups — `SpawnFlags` maxLength

```
Spawn, attribute 'Flags': [facet 'maxLength'] The value
'Active MovementDisabled AiDisabled DeathDisabled' has a length of '4';
this exceeds the allowed maximum length of '3'.
```

XSD ([Spawns.xsd:112-127](../xsd/src/XSD/Spawns.xsd#L112-L127)) defines
`SpawnFlags` as an `<xs:list>` of 4 enumerated values
(`Active`, `MovementDisabled`, `AiDisabled`, `DeathDisabled`) with
`<xs:maxLength value="3"/>` constraining the *list length*.

**The intent is unclear.** Possible readings:

- **maxLength was the count when the type was authored** (3 flags
  existed, then `DeathDisabled` was added). Fix: bump to 4.
- **The intent was: `Active` is mutually exclusive with up to 3 of the
  others.** Modeling that needs business-rule logic, not a single
  maxLength facet.

Either way the fixture has 4 flags and the server accepts them.

**Fix:** open question for upstream — likely bump `maxLength` to 4 or
remove the facet entirely.

### serverconfigs — `WorldDataDir` not declared

```
WorldDataDir: This element is not expected. Expected is ( ...DataStore ).
```

XSD ([ServerConfig.xsd:217-237](../xsd/src/XSD/ServerConfig.xsd#L217-L237))
doesn't declare `WorldDataDir` as a child of `ServerConfig` at all. The
fixture has it between `Logging` and `DataStore`.

`WorldDataDir` is the override path for where the server reads world data
(the alternative to the default location). The element is supposed to
exist; it was never added to the XSD. The existing
[test README](../src/main/__tests__/README.md#creidhne-is-ahead-of-the-xsd)
already lists this as a "creidhne ahead of XSD" element.

**Status:** worth investigating upstream — confirm the element is
definitively part of the supported config shape, then add it to the XSD.

## When you find a NEW failure

If `validate-xml.mjs` reports a failure that's not in the catalog above,
walk through:

1. **Is it the data or the schema?** Check whether the file came from a
   known-good source (production server, committed fixture) or was
   produced by our serializer.
2. **If it came from our serializer**, you may have surfaced a
   round-trip regression. Unskip the relevant `it()` in the Tier-2 block
   of [`xsdValidation.test.js`](../src/main/__tests__/xsdValidation.test.js)
   to capture it as a regression test.
3. **If it came from a known-good source**, add a `KNOWN_DRIFT` entry
   here and in the test file with a one-line explanation, and follow
   up with the upstream `hybrasyl/xml` repo.
