import { describe, it, expect } from 'vitest'
import {
  namedEntitySchema,
  localizationEntitySchema,
  serverConfigEntitySchema
} from '../worldEntity.js'
import {
  writeFileArgsSchema,
  saveDialogArgsSchema,
  addCategoryBulkArgsSchema,
  spellbookApplyArgsSchema
} from '../ipcArgs.js'

/**
 * HTOO-370. `ipcSchemaCoverage.test.js` asserts that every world-writing channel
 * parses SOMETHING. This file asserts the something is worth parsing — the
 * coverage check reads source, so a schema of `z.any()` would satisfy it
 * completely.
 *
 * The inputs below are the exact set measured against the serializers while
 * scoping the card. Six of the fourteen returned a complete, well-formed XML
 * document for every one of them; `serializeCastableXml('a string')` produced a
 * castable whose name element was `<Name/>`, which loads and then keys nothing on
 * the server.
 */

// Everything a renderer bug can send instead of an entity.
const NON_ENTITIES = [undefined, null, 'a string', 42, [], true]

describe('world entity payloads (HTOO-370)', () => {
  it('rejects every non-entity', () => {
    for (const bad of NON_ENTITIES) {
      expect(namedEntitySchema.safeParse(bad).success, JSON.stringify(bad) ?? 'undefined').toBe(
        false
      )
      expect(
        localizationEntitySchema.safeParse(bad).success,
        JSON.stringify(bad) ?? 'undefined'
      ).toBe(false)
      expect(
        serverConfigEntitySchema.safeParse(bad).success,
        JSON.stringify(bad) ?? 'undefined'
      ).toBe(false)
    }
  })

  it('rejects an entity with no usable name', () => {
    // The `<Name/>` case, which is what made the castable write dangerous rather
    // than merely wrong.
    for (const name of [undefined, '', '   ', 42, null, { a: 1 }]) {
      expect(namedEntitySchema.safeParse({ name }).success, JSON.stringify(name)).toBe(false)
    }
  })

  it('accepts a minimal named entity and keeps every field', () => {
    // Zod strips unknown keys by default. A stripped entity is a silently
    // truncated save, so this pins the loose behaviour rather than assuming it.
    const payload = { name: 'Iron Sword', properties: { physical: { weight: 3 } }, tags: ['a'] }
    const parsed = namedEntitySchema.parse(payload)
    expect(parsed).toEqual(payload)
  })

  it('lets a localization through with no name', () => {
    // Measured: the one localization in the production world has no name at all.
    expect(localizationEntitySchema.safeParse({ groups: [] }).success).toBe(true)
  })

  it('lets a server config through with an empty name', () => {
    // Measured: serverconfigs/config.xml ships with one today. Requiring a
    // non-empty name here would refuse a save of a file that already exists.
    expect(serverConfigEntitySchema.safeParse({ name: '' }).success).toBe(true)
    expect(serverConfigEntitySchema.safeParse({ name: 42 }).success).toBe(false)
    expect(serverConfigEntitySchema.safeParse({}).success).toBe(false)
  })

  it('does not rewrite the name it validates', () => {
    // `requiredName` trims, so parsing is not identity. The handlers serialize the
    // ORIGINAL payload for this reason; if that ever changes, a save would start
    // silently trimming names. Pinned so the choice is deliberate.
    expect(namedEntitySchema.parse({ name: '  Padded  ' }).name).toBe('Padded')
  })
})

describe('argument payloads (HTOO-370)', () => {
  it('rejects file content that is not a string', () => {
    // The sharpest case: fs.writeFile COERCES, so an object reaches disk as
    // `[object Object]` and the write reports success.
    for (const content of [{}, [], 42, null, undefined, true]) {
      expect(
        writeFileArgsSchema.safeParse({ filePath: '/w/x.xml', content }).success,
        JSON.stringify(content) ?? 'undefined'
      ).toBe(false)
      expect(
        saveDialogArgsSchema.safeParse({ defaultName: 'x.csv', content }).success,
        JSON.stringify(content) ?? 'undefined'
      ).toBe(false)
    }
    expect(writeFileArgsSchema.safeParse({ filePath: '/w/x.xml', content: '' }).success).toBe(true)
  })

  it('rejects a bulk category payload the old guard let through', () => {
    // The old guard was `!Array.isArray(names) || !categoryName`.
    const ok = { castableNames: ['Bash'], categoryName: 'Book' }
    expect(addCategoryBulkArgsSchema.safeParse(ok).success).toBe(true)
    // A number passes `!categoryName` and is then written into every file.
    expect(
      addCategoryBulkArgsSchema.safeParse({ ...ok, categoryName: 42 }).success,
      'a numeric category'
    ).toBe(false)
    expect(
      addCategoryBulkArgsSchema.safeParse({ ...ok, categoryName: '   ' }).success,
      'a blank category'
    ).toBe(false)
    // An array of objects passes Array.isArray.
    expect(
      addCategoryBulkArgsSchema.safeParse({ ...ok, castableNames: [{ name: 'Bash' }] }).success,
      'names that are objects'
    ).toBe(false)
  })

  it('accepts a spellbook that clears its castables', () => {
    // Empty and omitted mean different things: empty is "remove this book's tag
    // from everything", which is what the delete path sends.
    expect(
      spellbookApplyArgsSchema.safeParse({ name: 'Book', castables: [], categories: [] }).success
    ).toBe(true)
    expect(spellbookApplyArgsSchema.safeParse({ name: 'Book' }).success, 'omitted lists').toBe(
      false
    )
    expect(
      spellbookApplyArgsSchema.safeParse({ name: '  ', castables: [], categories: [] }).success
    ).toBe(false)
  })
})
