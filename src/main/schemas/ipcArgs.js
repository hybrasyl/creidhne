import { z } from 'zod'

/**
 * Payloads that are arguments rather than documents.
 *
 * A malformed DOCUMENT is usually caught downstream, because something later
 * reads a field that is not there. A malformed ARGUMENT is not — it is coerced,
 * and the coercion succeeds:
 *
 * - **`fs.writeFile` coerces its data argument.** An object reaches disk as the
 *   nine characters `[object Object]`, over a real file the renderer named, and
 *   the write reports success. Nothing throws, then or later. This is the
 *   sharpest case in the app and it covers both `fs:writeFile` and
 *   `dialog:saveFile`.
 * - **`castable:addCategoryBulk` writes a category name into many castable
 *   files at once.** It checked `!categoryName` and `Array.isArray(names)`, which
 *   passes a number, an object, or an array holding objects. The category is
 *   written; the names select which files to write it to.
 * - **`spellbook:apply` is the same shape**, and reaches more files: it adds and
 *   removes a category across every castable a book lists.
 *
 * Both bulk channels are validated BEFORE the scan rather than inside the write
 * loop. A payload worth rejecting must be rejected before the first file is
 * touched, or the rejection leaves the world half-updated.
 */

/** Text destined for `fs.writeFile`. A string, because everything else coerces. */
const fileContent = z.string()

export const writeFileArgsSchema = z.object({
  filePath: z.string().min(1),
  content: fileContent
})

export const saveDialogArgsSchema = z.object({
  defaultName: z.string().min(1),
  content: fileContent
})

/**
 * A category written onto castable XML. Blank is rejected for the same reason an
 * empty entity name is: it is written, and it keys nothing.
 */
const categoryName = z.string().trim().min(1)

/** The display names used to select which castables to rewrite. */
const castableNames = z.array(z.string().min(1))

export const addCategoryBulkArgsSchema = z.object({
  castableNames,
  categoryName
})

/**
 * A spell book, as the Constants tab applies it.
 *
 * `prevName` is optional because a book being applied for the first time has no
 * previous name. `castables` and `categories` are required: an omitted list and
 * an empty one mean different things here — empty is "remove this book's tag
 * from everything", which is exactly what the delete path sends, so it must stay
 * expressible.
 */
export const spellbookApplyArgsSchema = z.object({
  name: z.string().trim().min(1),
  prevName: z.string().optional(),
  castables: z.array(z.string()),
  categories: z.array(z.string())
})
