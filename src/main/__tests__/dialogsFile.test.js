import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  listDialogs,
  loadDialog,
  saveDialog,
  deleteDialog,
  dialogExists,
  getDialogsDir
} from '../dialogsFile.js'
import { dialogDocumentSchema } from '../schemas/dialogs.js'
import { newDocument, newSequence, newDialog } from '../../shared/dialogDocument.js'

// world/.creidhne/dialogs/<name>.json (HTOO-458). `libraryPath` is world/xml;
// the folder is one level up, beside reports.json.

function sample(name = 'greet') {
  const doc = newDocument(name)
  doc.title = 'Greeting'
  const seq = newSequence('greet_hello')
  seq.scope = 'pursuit'
  seq.dialogs = [{ ...newDialog('text'), text: 'Well met.' }]
  doc.sequences = [seq]
  return doc
}

describe('dialogs folder', () => {
  let world
  let lib

  beforeEach(() => {
    world = mkdtempSync(join(tmpdir(), 'creidhne-dialogs-'))
    lib = join(world, 'xml')
    mkdirSync(lib, { recursive: true })
  })
  afterEach(() => rmSync(world, { recursive: true, force: true }))

  it('lists nothing, without error, when the folder does not exist', async () => {
    expect(await listDialogs(lib)).toEqual({ dialogs: [], problems: [] })
    expect(await dialogExists(lib, 'greet')).toBe(false)
  })

  it('saves, lists, loads, and leaves no temp file behind', async () => {
    await saveDialog(lib, sample())
    expect(readdirSync(getDialogsDir(lib))).toEqual(['greet.json'])
    expect(await listDialogs(lib)).toEqual({
      dialogs: [{ name: 'greet', title: 'Greeting', sequences: 1 }],
      problems: []
    })
    const loaded = await loadDialog(lib, 'greet')
    expect(loaded.sequences[0].dialogs[0]).toMatchObject({ kind: 'text', text: 'Well met.' })
    expect(await dialogExists(lib, 'greet')).toBe(true)
  })

  it('a file that does not parse, or that names a different document, is a problem and not a loss', async () => {
    await saveDialog(lib, sample('good'))
    writeFileSync(join(getDialogsDir(lib), 'broken.json'), '{ not json', 'utf-8')
    writeFileSync(
      join(getDialogsDir(lib), 'renamed.json'),
      JSON.stringify({ ...sample('other'), sequences: [] }),
      'utf-8'
    )
    writeFileSync(join(getDialogsDir(lib), 'notes.txt'), 'ignored', 'utf-8')
    const { dialogs, problems } = await listDialogs(lib)
    expect(dialogs.map((d) => d.name)).toEqual(['good'])
    expect(problems).toHaveLength(2)
    expect(problems[0]).toMatch(/^broken\.json: /)
    expect(problems[1]).toMatch(/^renamed\.json: the document is named "other"/)
  })

  it('deletes, and a delete of a missing document is not an error', async () => {
    await saveDialog(lib, sample())
    await deleteDialog(lib, 'greet')
    expect(existsSync(join(getDialogsDir(lib), 'greet.json'))).toBe(false)
    await expect(deleteDialog(lib, 'greet')).resolves.toBeUndefined()
  })

  it('refuses a name that is not a Lua identifier, so a name can never be a path', async () => {
    await expect(saveDialog(lib, sample('../escape'))).rejects.toThrow()
    await expect(loadDialog(lib, '../escape')).rejects.toThrow()
    await expect(deleteDialog(lib, 'Bad Name')).rejects.toThrow()
    expect(existsSync(getDialogsDir(lib))).toBe(false)
  })

  it('the boundary schema accepts a draft with a dangling jump and refuses an unknown kind', () => {
    const draft = sample()
    draft.sequences[0].dialogs.push({ ...newDialog('jump'), sequence: 'nowhere' })
    expect(dialogDocumentSchema.safeParse(draft).success).toBe(true)
    draft.sequences[0].dialogs.push({ id: 'x', kind: 'bogus' })
    expect(dialogDocumentSchema.safeParse(draft).success).toBe(false)
  })
})
