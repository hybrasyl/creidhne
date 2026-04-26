import { z } from 'zod'

// constants.json is a free-form record of category → list-of-strings.
// Known categories (vendorTabs, itemCategories, castableCategories,
// statusCategories, cookies, npcJobs, creatureFamilies, motions) live in
// constantsJson.js's EMPTY object, but the constants:addValue handler
// accepts arbitrary `type` keys, so the schema doesn't pin the key set.
// What we CAN assert: every value is a string array (no nested objects,
// no numbers, no nulls).
export const constantsSchema = z.record(z.string(), z.array(z.string()))

// constants:addValue(libraryPath, type, value) — `type` and `value` are
// renderer-supplied. Both must be non-empty strings.
export const constantsAddValueSchema = z.object({
  type: z.string().min(1),
  value: z.string().min(1)
})
