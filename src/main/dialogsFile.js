import { promises as fs } from 'fs'
import { join } from 'path'
import { getCreidhnePath } from './worldData.js'
import { dialogDocumentSchema, dialogNameSchema } from './schemas/dialogs.js'
import { normalizeDocument } from '../shared/dialogDocument.js'

// world/.creidhne/dialogs/<name>.json — the dialog builder's documents (HTOO-458).
//
// One file per document, in the folder Creidhne already owns beside
// constants.json, formulas.json and reports.json, so a dialog goes with the
// world and is shareable through the world repo. Nothing here touches
// scripts/: the writer pastes what the builder exports.
//
// The document's `name` is the file's basename, and the schema pins it to a Lua
// identifier, so a name can never carry a path separator. The library path is
// validated by the caller (pathSafety) before it reaches here.

export function getDialogsDir(libraryPath) {
  return join(getCreidhnePath(libraryPath), 'dialogs')
}

function documentPath(libraryPath, name) {
  return join(getDialogsDir(libraryPath), `${dialogNameSchema.parse(name)}.json`)
}

/**
 * Every document in the folder, as `{ name, title, sequences }` summaries plus
 * the names of any file that could not be read. One bad file must not cost the
 * list — these are hand-editable.
 */
export async function listDialogs(libraryPath) {
  let files
  try {
    files = await fs.readdir(getDialogsDir(libraryPath))
  } catch (err) {
    if (err?.code === 'ENOENT') return { dialogs: [], problems: [] }
    return { dialogs: [], problems: [`dialogs folder could not be read: ${err.message}`] }
  }
  const dialogs = []
  const problems = []
  for (const file of files.filter((f) => f.endsWith('.json')).sort()) {
    try {
      const raw = JSON.parse(await fs.readFile(join(getDialogsDir(libraryPath), file), 'utf-8'))
      const parsed = dialogDocumentSchema.safeParse(raw)
      if (!parsed.success) {
        problems.push(`${file}: ${parsed.error.issues[0]?.message ?? 'invalid'}`)
        continue
      }
      if (`${parsed.data.name}.json` !== file) {
        problems.push(`${file}: the document is named "${parsed.data.name}"; the file must match`)
        continue
      }
      dialogs.push({
        name: parsed.data.name,
        title: parsed.data.title,
        sequences: parsed.data.sequences.length
      })
    } catch (err) {
      problems.push(`${file}: ${err.message}`)
    }
  }
  return { dialogs, problems }
}

export async function loadDialog(libraryPath, name) {
  const raw = JSON.parse(await fs.readFile(documentPath(libraryPath, name), 'utf-8'))
  return normalizeDocument(dialogDocumentSchema.parse(raw))
}

/**
 * Writes one document. Validates the shape first so a renderer fault cannot put
 * a file on disk the loader then refuses. A rename is a save under the new
 * name plus a delete of the old; the caller decides that, not this function.
 */
export async function saveDialog(libraryPath, doc) {
  const parsed = dialogDocumentSchema.parse(doc)
  await fs.mkdir(getDialogsDir(libraryPath), { recursive: true })
  const target = documentPath(libraryPath, parsed.name)
  const tmp = `${target}.tmp`
  await fs.writeFile(tmp, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8')
  await fs.rename(tmp, target)
  return parsed
}

export async function deleteDialog(libraryPath, name) {
  await fs.rm(documentPath(libraryPath, name), { force: true })
}

export async function dialogExists(libraryPath, name) {
  try {
    await fs.access(documentPath(libraryPath, name))
    return true
  } catch {
    return false
  }
}
