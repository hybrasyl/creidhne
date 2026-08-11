# WP3 — Report builder for other XML types

**Size:** L (grows per type). **Depends on:** WP2. **Status:** Detailed 2026-08-11, not built.
**Prompted by:** Sabrael — "adapting for other xml types as needed (items comes to mind
specifically)."

## Goal

Generalize WP2's castables report builder into an **entity-agnostic** one. Items first, because
items is the named driver. Same builder, same serializers, same rule engine; each type contributes
a record mapper and a field catalogue.

## Decisions

1. **Per-entity validation, not one union catalogue.** A report's `columns` and `rules` are checked
   against the catalogue for its own `entity`. A union catalogue would accept `damageFormula` on an
   items report, and `recordsToCsv` would then write a blank column into a file somebody reads as
   data — the exact fault WP2 refused. The cost is that the schema must read `entity` before it can
   check anything else, so the definition validates at the object level rather than per field.
2. **Items ship one built-in report, not three.** Castables have three because two consumers
   outside this repo read them. Items have no such consumer, and inventing a contract that nothing
   reads is worse than shipping the one obvious report. `Items CSV` covers identity, physical
   values, slot, damage and the common stat modifiers.
3. **The type order after items stays demand-driven**, as the outline says. Creatures, NPCs,
   statuses and spawngroups each get a mapper when a report for them is actually wanted. Do not
   front-load them: an unused mapper is a field catalogue nobody has checked against real data.

## Measured: what items need, and one thing to fix first

**Items need no new `@eriscorp/hybindex-ts` field.** That answers the outline's second open
question. The item XML carries value, weight, durability, slot, weapon type, damage, restrictions
and every stat modifier directly. The index already exposes the two things the XML cannot say:

| Index field    | Report column              | Parallel                                   |
| -------------- | -------------------------- | ------------------------------------------ |
| `itemVendors`  | which NPCs sell it         | castables' `castableTrainers` → `location` |
| `itemLootSets` | which loot sets contain it | new, same shape                            |

Both arrive through `ctx`, exactly as `castableTrainers` does, so `itemToRecord` stays pure.

### The 69 stat keys exist twice, and WP3 would have made it three

`src/main/itemXml.js` holds `STAT_KEYS` (a Set, for deciding which XML attributes are stats), and
`src/renderer/src/data/itemConstants.js` holds `STAT_MODIFIERS` (`{ key, label, type }`, for the
editor's fields). Measured: **69 keys each, identical, in the same order.** They are two copies of
one list, in step by luck.

A report needs the same list a third time, and it needs the labels. So the list moves to
`src/shared/itemStats.js` as the canonical `{ key, label, type }`, `itemXml.js` builds its Set from
it, and `itemConstants.js` re-exports it. **This lands first, as its own commit**, because it is a
fix to an existing drift risk rather than part of the feature.

The failure mode if it stayed: the parser drops a stat the editor can edit, or accepts one the
editor cannot show. Neither raises anything — a dropped attribute lands in `unknownStatKeys`, which
only the diagnostics panel reads.

## What generalizes, and what does not

Everything WP2 built that was expensive to get right is already type-agnostic:

| Piece                                      | Change needed                                       |
| ------------------------------------------ | --------------------------------------------------- |
| `exportSerializers.js`                     | none                                                |
| `compileRules` / the operator table        | none                                                |
| `reports.json`, its `version` and `entity` | none — `entity` is already written                  |
| The storage loader's per-report validation | none                                                |
| `resolveColumns`                           | takes an entity                                     |
| `FILTERABLE_FIELDS`                        | becomes per-entity                                  |
| `reportDefinitionSchema`                   | object-level, reads `entity` first                  |
| `collectCastableRecords`                   | becomes `collectRecords(libraryPath, entity, ctx)`  |
| `ReportsPage`                              | gains an entity selector; the list groups by entity |

## The registry, split by what each process can do

```text
src/shared/reportEntities.js      entity → { label, subdir, columns, filterFields, presets }
src/shared/castableRecord.js      castableToRecord + CASTABLE_COLUMNS   (exists)
src/shared/itemRecord.js          itemToRecord + ITEM_COLUMNS           (new)
src/shared/itemStats.js           the one stat-key list                 (new)
src/main/reportRun.js             entity → { parse } + the run engine   (renamed from exportCastables.js)
```

The mappers are pure and live in `src/shared/`, so the renderer's preview compiles the same record
main exports. The **parsers** cannot: `itemXml.js` and `castableXml.js` use `xml2js`. So main keeps
a small dispatch of entity → parse function, and that is the only per-entity thing main knows.

`src/main/exportCastables.js` is renamed to `reportRun.js`, with its two test files. The name would
otherwise say castables while the module reads items.

## `itemToRecord`

One flat record, the same shape as `castableToRecord`. Groups for the picker:

- **Identity** — `name`, `unidentifiedName`, `comment`, `includeInMetafile`, `tags`, `flags`
- **Appearance** — `sprite`, `equipSprite`, `displaySprite`, `bodyStyle`, `color`, `hideBoots`
- **Physical** — `value`, `weight`, `durability`, `stackMax`
- **Equipment** — `slot`, `weaponType`, and derived `isEquipment`, `isWeapon`
- **Damage** — `smallMin`, `smallMax`, `largeMin`, `largeMax`, and derived `hasDamage`
- **Vendor** — `shopTab`, `vendorDescription`, and from the index `vendors`, `hasVendor`
- **Loot** — from the index `lootSets`, `hasLootSet`
- **Restrictions** — `levelMin`, `levelMax`, `abMin`, `abMax`, `class`, `gender`, `castables`
- **Categories** — `category1`…`category6`, flattened as castables are
- **Use** — `useScript`, `useEffectId`, `useSoundId`, `teleportMap`
- **Stats** — one column per stat key, `stat<Key>`, generated from `itemStats.js`

The derived booleans are there for the same reason `hasTrainer` is: a filter must not test a display
string. `isWeapon` is `weaponType` present and not `None`, decided once here rather than in a rule.

## The item filter vocabulary

Ten logical fields, all reusing WP2's eight operators:

| Rule          | Reads           | Operators                  |
| ------------- | --------------- | -------------------------- |
| Name          | `name`          | contains                   |
| Slot          | `slot`          | is, is not                 |
| Weapon type   | `weaponType`    | is, is not                 |
| Is equipment  | `isEquipment`   | is                         |
| Is weapon     | `isWeapon`      | is                         |
| Has a vendor  | `hasVendor`     | is                         |
| In a loot set | `hasLootSet`    | is                         |
| Shop tab      | `shopTab`       | is, is not                 |
| Category      | `category1`…`6` | has, does not have         |
| Value         | `value`         | between, at least, at most |
| Level         | `levelMin`      | between, at least, at most |

`class` is deliberately absent for v1: an item's `<Class>` is a single value rather than the
space-separated list a castable carries, so it needs its own rule rather than the castable one, and
nothing has asked for it yet. Recorded rather than half-built.

## Tests

- `itemRecord.test.js` — every derivation, and the vendor and loot-set columns from a `ctx`.
- `itemStats.test.js` — the parser's Set and the editor's list both come from the shared list, and
  the report's stat columns cover all 69. **This is the guard that stops the third copy**, and it
  asserts the count so a shortened list cannot pass vacuously.
- `reportEntities.test.js` — every registered entity resolves its own columns, and **a column valid
  for one entity is rejected for another**. That is decision 1, and it is the assertion that would
  fail if the union catalogue crept back.
- The castable golden fixtures must still match byte for byte after the generalization. They are the
  proof that making the engine entity-aware changed no output.
- `reportsFile.test.js` gains an items report, and a report whose `columns` name castable fields
  under `entity: items`.

## Non-goals

- No schema or storage change for any type.
- No cross-type joined reports. One entity per report.
- No mappers beyond items.
- No new hybindex field.

## Acceptance criteria

1. The three castable built-ins produce byte-identical output to before.
2. `Items CSV` runs against a real library and its rows match the item count.
3. The entity selector switches the column catalogue, the filter fields and the built-in list
   together.
4. A report saved under `entity: items` survives a restart.
5. A hand-edited report naming a castable column under `entity: items` is rejected, and names the
   column.
6. Both stat-key consumers read the shared list, and the guard fails if either stops.
7. `npm run lint:check && npm test && npm run build` clean, with no coverage threshold regression.

## Open, and deliberately so

- Which type comes after items. Demand-driven; ask when one is asked for.
- An item `class` rule, if anyone wants to filter by it.
