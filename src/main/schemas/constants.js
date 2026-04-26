import { z } from 'zod'

// constants.json is a free-form record of category → list. The
// constants:addValue handler accepts arbitrary `type` keys, so the
// schema doesn't pin the key set. Known categories vary in shape:
//   - string[]:   vendorTabs, itemCategories, castableCategories,
//                 statusCategories, npcJobs, creatureFamilies
//   - object[]:   cookies ({ name, sourceFile, comment }),
//                 motions ({ id, speed, name }),
//                 weapons ({ name, minDmg, maxDmg }),
//                 spellBooks ({ id, name, castables })
// What we CAN assert at the IPC boundary: top-level values are always
// arrays. That catches shape disasters (e.g. libraries: "string") while
// accepting both string and object entries.
export const constantsSchema = z.record(z.string(), z.array(z.unknown()))

// constants:addValue(libraryPath, type, value) — `type` and `value` are
// renderer-supplied. Both must be non-empty strings.
export const constantsAddValueSchema = z.object({
  type: z.string().min(1),
  value: z.string().min(1)
})
