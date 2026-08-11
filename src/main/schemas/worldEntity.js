import { z } from 'zod'

/**
 * Payload validation for the fourteen `xml:save*` channels — the handlers that
 * write the world.
 *
 * ## Why these are the ones that matter
 *
 * `pathSafety.js` already stops a bad *path* escaping the allowed roots. Nothing
 * stopped a bad *payload* being serialized into a file inside them, and the four
 * handlers that did validate were the four writing JSON Creidhne reads back —
 * the wrong way round.
 *
 * The exposure is not even across the fourteen. Feeding each serializer
 * `undefined`, `null`, `{}`, a string, a number and an array:
 *
 * - **Six write a file for every one of those inputs** — localization, creature,
 *   status, castable, behavior set, spawngroup. `serializeCastableXml('a string')`
 *   returns a complete, well-formed castable whose name element is `<Name/>`.
 *   That file loads, and the server indexes it under an empty key. It is
 *   HTOO-346's collision fault reached from a third direction.
 * - **Eight already fail closed** — item, recipe, npc, nation, loot, variant
 *   group, element table, server config each throw a `TypeError` from inside the
 *   serializer. Nothing is written, which is the right outcome reached by
 *   accident, and the renderer gets "Cannot read properties of undefined
 *   (reading 'tags')" with no channel name attached.
 *
 * So this schema does two jobs: it closes the six, and it gives the eight a
 * message that names the channel and the field, logged next to settings.
 *
 * ## Why it is deliberately shallow
 *
 * A full per-type schema mirroring each model is the obvious reading of "derive
 * it from the parse/serialize pair", and it is the wrong trade here. Those models
 * are large — the castable record alone catalogues 70 fields — and every field
 * whose optionality is guessed wrong becomes a REFUSED save of valid work. That
 * is a worse fault than the one being fixed, and it would land on whoever is mid
 * edit rather than on the developer who guessed.
 *
 * A shallow schema cannot make that mistake, and it catches every measured
 * failure, because all six writing cases fail "is a plain object" alone. Deepen a
 * type when there is a real defect to point at, not on principle.
 *
 * ## The rules are measured, not assumed
 *
 * Every rule below was checked against all 4201 XML files in the production world
 * by parsing each one and testing the result. Two types earned an exception that
 * way rather than by argument:
 *
 * - **Localizations carry no `name` at all.** Not an omission; a localization is
 *   keyed by its filename and its string keys.
 * - **`serverconfigs/config.xml` has an empty name**, in production, today. So a
 *   server config's name must be a string and may not be required to be filled.
 *
 * Guessing either would have refused a save of a file that already exists.
 */

/**
 * The floor every entity payload has to clear: a plain object.
 *
 * `z.object()` rejects `null`, `undefined`, a string, a number and an array on
 * its own, which is the whole of the measured exposure. `.loose()` keeps unknown
 * keys, because Zod strips them by default and a stripped entity is a silently
 * truncated save — every field these shallow schemas do not name is every field
 * the entity actually has.
 *
 * Even so, the handlers serialize the ORIGINAL payload rather than the parsed
 * result. `requiredName` trims, so parsing is not quite identity, and a
 * validation card must not quietly start rewriting what gets written. The parse
 * is a gate; it is not a transform. See the note beside the save handlers in
 * `index.js`.
 */
const entityObject = z.object({}).loose()

/** A name that is a key: present, a string, and not blank. */
const requiredName = z.string().trim().min(1, 'name is required')

/** Twelve of the fourteen: a plain object carrying a usable name. */
export const namedEntitySchema = entityObject.extend({ name: requiredName })

/**
 * Localizations. No name — see the header. Still worth a schema, because
 * `serializeLocalizationXml` is one of the six that writes a file for a string,
 * a number or an array.
 */
export const localizationEntitySchema = entityObject

/**
 * Server configs. A name, but one that production proves may be empty, so this
 * checks the type and not the content.
 */
export const serverConfigEntitySchema = entityObject.extend({ name: z.string() })

// No channel→schema table here on purpose. `ipcSchemaCoverage.test.js` detects a
// validated channel by a `parseOrLog(schemaCtx, '<literal>'` call, so registering
// the fourteen from a table would hide every one of them from the check that
// exists to keep them registered. The call sites spell the channel out; this file
// owns the rules they pass.
