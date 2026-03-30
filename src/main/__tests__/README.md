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
| Loot | `lootXml.test.js` | 33 |

## Bugs found during test writing

### BehaviorSet — Hostility wrapper (`behaviorSetXml.js`)

The parser read `<Monsters>`/`<Players>` as direct children of `<Behavior>`, but the XSD and serializer both wrap them in `<Hostility>`. Fixed: unwrap through `first(beh.Hostility)` before reading children.

### Creature — bare empty elements (`creatureXml.js`)

`mapHostility` used `!!players` to detect presence. xml2js parses attribute-less empty elements (e.g. `<Players />`) as `''`, so `!!''` was `false` even when the element existed. Fixed: check `Array.isArray(hosNode.Players) && hosNode.Players.length > 0`.

## Known schema discrepancy

### Nation — `Territory/Map` format

The XSD defines `<Map>` as type `NationMap` (a complex type with a `Name` attribute). The serializer and parser both use `<Map>text content</Map>` instead. The XSD may be stale relative to actual game files. Noted in `nationXml.test.js`.
