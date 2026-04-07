# XML Module Tests

Automated tests for every XML parse/serialize module in `src/main/`.

## Running

```sh
npm test
```

## Pattern

Each schema gets a test file with four standard blocks:

| Block | What it checks |
| --- | --- |
| **Parse round-trip** | `parseX(xml)` → `serializeX()` → `parseX()` → deep equal to first parse |
| **All fields** | Full fixture with every optional field populated; one assertion per field |
| **Minimal** | Required-only fixture; every optional field defaults to the right empty value |
| **Output structure** | Serialize a JS object → re-parse with xml2js → assert elements, attributes, and nesting are correct. Structural assertions only — does **not** perform real XSD validation and will not catch divergences between creidhne and the XSD. |

## Coverage

| Schema | Test file | Tests |
| --- | --- | --- |
| Nation | `nationXml.test.js` | 21 |
| BehaviorSet | `behaviorSetXml.test.js` | 32 |
| Creature | `creatureXml.test.js` | 33 |
| NPC | `npcXml.test.js` | 38 |
| Recipe | `recipeXml.test.js` | 20 |
| Variant | `variantXml.test.js` | 32 |
| ElementTable | `elementTableXml.test.js` | 22 |
| Loot | `lootXml.test.js` | 35 |
| Localization | `localizationXml.test.js` | 25 |
| ServerConfig | `serverConfigXml.test.js` | 54 |
| Spawns | `spawngroupXml.test.js` | 37 |
| Status | `statusXml.test.js` | 42 |
| Item | `itemXml.test.js` | 70 |
| Castable | `castableXml.test.js` | 138 |

## Assumptions and conventions

### xml2js parsing model

All modules use xml2js to parse XML into JavaScript objects. A few xml2js behaviours affect how the parsers and tests are written:

- **Attributes** are stored under a `$` key: `<Foo Bar="1" />` → `{ $: { Bar: '1' } }`. All attribute values come back as strings regardless of XSD type.
- **Element arrays** — xml2js always wraps repeated or single child elements in arrays: `<Items><Item/><Item/></Items>` → `{ Item: [{...}, {...}] }`. The `first()` helper used throughout the parsers extracts `arr[0]` safely.
- **Attribute-less empty elements** — `<Players />` (no attributes, no text) parses as the string `''`, not an object. This means truthy checks like `if (node.Players)` silently fail even when the element is present. Tests that probe this are deliberately asserting the corrected behaviour after bugs were found.
- **Mixed content** — elements with both text and attributes (e.g. `<Map X="5" Y="10">Mileth</Map>`) parse as `{ $: { X: '5', Y: '10' }, _: 'Mileth' }`. The `_` key holds the text body.
- **Text-only elements** — `<Name>Foo</Name>` parses as the string `'Foo'` inside an array: `{ Name: ['Foo'] }`. The `textOf()` helper handles both the string and mixed-content forms.

### Comment annotations

Most schemas embed an editor comment as an XML comment on the second line:

```xml
<!-- Comment: This is the note -->
<LootSet ...>
```

The `extractComment` utility strips and returns this before xml2js parses the document (xml2js discards comments). The parsed JS object then has a `comment` field. Schemas that use this: Nation, BehaviorSet, Creature, NPC, Recipe, Loot, Localization, ElementTable.

**Exception — VariantGroup:** uses a real `<Comment>` child element instead of the annotation. No `extractComment` involved.

**Exception — ServerConfig:** has no comment field at all.

**Exception — Castable:** uses BOTH the `<!-- Comment: ... -->` annotation AND a second `<!-- creidhne:meta {...} -->` annotation (JSON object carrying `isTest`, `isGM`, `givenViaScript`, `deprecated`, `specialty`). Both are extracted via regex before xml2js parsing.

### creidhne is ahead of the XSD

The XSD represents the last formally released schema version. creidhne implements fields that the game server already supports but the XSD has not yet been updated to include. Tests assert creidhne's actual behaviour, not the XSD. Known schema-ahead fields:

- NPC role structure (`Adjustment`, `ExceptCookie`, `OnlyCookie` on Bank/Post/Repair roles)
- ServerConfig: `Sentry` under `ApiEndpoints`, `ExternalAddress` on `Grpc`, `WorldDataDir` root element
- These are preserved on round-trip even though they would not pass XSD validation

### Output structure tests are not XSD validation

The fourth test block serializes a JS object, then re-parses the resulting XML string with raw xml2js and makes structural assertions (element names, attribute names, nesting). These assertions are written by reading the serializer code — they confirm what creidhne actually outputs, not what the XSD requires. Divergences between the two will not be caught.

### Round-trip non-identity cases

Most parse → serialize → parse sequences produce identical JS objects. Known exceptions where this is intentional, not a bug:

- **VariantGroup `class: 'All'`** — the editor stores `'All'` as shorthand; the serializer expands it to the full class string `'Peasant Wizard Rogue Monk Warrior Priest'`. Re-parsing yields the full string. The round-trip test fixture uses an explicit class string to avoid this.
- **NPC `displayName`** — if `displayName` is empty the serializer writes `name` in its place. Re-parsing reads back `name`. The round-trip fixture uses an explicit `displayName` to avoid this.
- **Castable `lines`/`icon`/`cooldown`** — these attributes are omitted from the XML entirely when empty. Absent attributes parse back as `''`. Round-trips are identity.

### Presence vs absence distinctions

Some fields use `null` or `undefined` specifically to mean "this element was not present in the XML" rather than "this element was present but empty":

- **ServerConfig `boards: null`** means the `<Boards>` element was absent. `boards: []` means `<Boards/>` was present but had no children. The serializer preserves this distinction.
- **ServerConfig network nodes** (`lobby`, `login`, `world`, `grpc`) are `null` when the corresponding element is absent. The serializer omits them when null.
- **ServerConfig handler sub-nodes** (`death`, `chat`, `newPlayer`) are `null` when absent.

### ElementTable float/integer boundary

XML always stores element multipliers as floats (`1.0`, `0.8`, `1.5`). The editor represents them as integers for simplicity: `100` = `1.0`, `80` = `0.8`, `150` = `1.5`. The parser converts via `Math.round(multiplier * 100)`; the serializer converts back via `(pct / 100).toFixed(4)` then `parseFloat().toString()`. The XSD default for a missing target is `1` (float), which the parser stores as `100` (integer).

### Loot item defaults

Per `Common.xsd` `LootItem`: `Unique`, `Always`, and `InInventory` all default to `false` when the attribute is absent. `Variants` is an optional space-separated list; absent means no variants (`[]`).

### ServerConfig DataStore `hasCredentials`

The `hasCredentials` flag is set to `true` when `<Username>` or `<Password>` elements were explicitly present in the XML, even if their text content is empty. This ensures the serializer round-trips those elements rather than omitting them when blank — preserving the file's intent to configure credentials.

### Castable deprecated forms

MaxLevel, Mastery, and Prerequisites can be "deprecated" — stored as XML comments so the values are preserved but ignored by the game server. The serializer writes these as normal XML elements then regex-replaces them to comment form. The parser reads them back by running regex on the raw XML string before passing to xml2js.

`Status Remove` elements with no attributes (`isCategory: false`, no `quantity`) serialize to `<Remove>name</Remove>` (plain text). xml2js parses this back as a string, not an object. Tests for this case assert `rem === 'name'` rather than `rem._`.

Castable animation `onCast` player motions default to `{id:'1',speed:'20'}` when no `<OnCast>` element is present. `onEnd` player motions default to `{id:'',speed:''}`. The serializer only writes motions where `id` is non-empty; defaults are reconstructed on re-parse.

### Castable requirement physical stat defaults

Physical stat attributes (`Str`, `Int`, `Wis`, `Con`, `Dex`) default to `'3'` in the parser even when the `<Physical>` element is entirely absent. Because `'3' !== ''`, the serializer will always write an explicit `<Physical>` element on the first serialize of a requirement parsed without one. The round-trip JS objects are still identical since both passes produce `'3'`.

### ServerConfig Constants and Formulas

Both sections contain a large fixed list of possible keys. Only keys that have a non-empty value are written to the output XML. Partial configs (e.g. only `ClassName0`–`ClassName5` set) round-trip cleanly without writing blank elements for every other key.

---

## Bugs found during test writing

### BehaviorSet — Hostility wrapper (`behaviorSetXml.js`)

The parser read `<Monsters>`/`<Players>` as direct children of `<Behavior>`, but the XSD and serializer both wrap them in `<Hostility>`. Fixed: unwrap through `first(beh.Hostility)` before reading children.

### Creature — bare empty elements (`creatureXml.js`)

`mapHostility` used `!!players` to detect presence. xml2js parses attribute-less empty elements (e.g. `<Players />`) as `''`, so `!!''` was `false` even when the element existed. Fixed: check `Array.isArray(hosNode.Players) && hosNode.Players.length > 0`.

### Item — three bugs found (`itemXml.js`)

- **`IncludeInMetafile` defaults to false when absent** — `a()` returns `''` (not `undefined`) for absent attributes; `toBool('')` = `false` via `Boolean('')`, ignoring the `true` default. Fixed: bypass `a()` and read `root?.$?.IncludeInMetafile` directly.
- **Categories `Unique` attribute silently dropped on save** — serializer only wrote category names, not attributes. Fixed: write `{ _: c.name, $: { Unique: 'true' } }` when `unique` is true.
- **`<Motions>` container serialized as `<Motion>`** — XSD defines the outer element as `<Motions>`. Fixed: `propsObj.Motions` instead of `propsObj.Motion`. Parser already accepted both names as a workaround.

### SpawnGroup — bare `<Players />`/`<Monsters />` elements (`spawngroupXml.js`)

Same root cause as the Creature fix. `mapHostility` used `!!players` to detect presence; bare elements with no attributes parse as `''` (falsy). Fixed: check `Array.isArray(hosNode.Players) && hosNode.Players.length > 0`.

### Loot — wrong `unique`/`always` defaults and missing `inInventory` (`lootXml.js`)

Parser defaulted `Unique` and `Always` to `'true'` when absent; `Common.xsd` defines both as `default="false"`. `InInventory` on `LootItem` was missing entirely from parser, serializer, and editor. Fixed all three, and corrected the editor's new-item defaults to match.

### ServerConfig — empty `<Chat/>` drops to null (`serverConfigXml.js`)

When `Chat` has all-default values (`commandsEnabled: true`, `commandPrefix: '/'`), the serializer omits both attributes via `omitEmpty`, producing `<Chat/>`. xml2js parses attribute-less empty elements as `''` (falsy), so the chat handler was read back as `null`. Fixed: detect presence via `n.Chat !== undefined` rather than a truthy check on the extracted value.

---

## Known schema discrepancies (not bugs, flagged in test comments)

### Nation — `Territory/Map` format

The XSD defines `<Map>` as type `NationMap` (a complex type with a `Name` attribute). The serializer and parser both use `<Map>text content</Map>` instead. The XSD may be stale relative to actual game files. Noted in `nationXml.test.js`.
