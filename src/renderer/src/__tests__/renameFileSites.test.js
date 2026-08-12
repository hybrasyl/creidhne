import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * Renaming a file keeps one file. Every editor offers it, and every page can
 * carry it out.
 *
 * Before this, a changed filename had exactly one outcome: write a new file and
 * archive the old one. That is a reasonable thing to want — it keeps the
 * superseded entity as a record — but it is not what "rename" means, and it was
 * the only option. It also accumulated: every rename left a permanent file in
 * `.ignore/` whose name the duplicate check then reported as taken.
 *
 * Two intents, two buttons. `Save` supersedes, unchanged. `Rename` changes the
 * file's name and leaves nothing behind. Neither touches `<Name>`, which is the
 * server's key — a filename is Creidhne's business alone, which is why a rename
 * needs no reference repair (HTOO-378) and a `<Name>` change still does.
 *
 * ## Why this is a guard and not a behaviour test
 *
 * It spans 28 sites — fourteen editors passing the prop and fourteen pages
 * honouring the mode — and this epic has found the same shape six times: a
 * pattern applied to most of its sites, not all. Each site looks correct read on
 * its own, so a missed one is silent. Worse here than usual: a page that takes
 * the prop but ignores the mode ARCHIVES when the user asked for a rename, which
 * looks like it worked until they find the extra file.
 */

const rendererDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesDir = join(rendererDir, 'pages')
const componentsDir = join(rendererDir, 'components')

function jsxFilesUnder(dir) {
  return readdirSync(dir, { recursive: true })
    .map((n) => String(n).replace(/\\/g, '/'))
    .filter((n) => n.endsWith('.jsx'))
    .map((rel) => ({ rel, name: rel.split('/').pop(), src: readFileSync(join(dir, rel), 'utf8') }))
}

/** Editors with a file of their own, detected exactly as `editorHeader` does. */
function fileBackedEditors() {
  return jsxFilesUnder(componentsDir).filter(
    ({ name, src }) => name.endsWith('Editor.jsx') && src.includes('initialFileName')
  )
}

/** Pages that own one file per entity, detected exactly as `pageSaveFlow` does. */
function fileBackedPages() {
  return readdirSync(pagesDir)
    .filter((n) => n.endsWith('Page.jsx'))
    .map((n) => ({ name: n, src: readFileSync(join(pagesDir, n), 'utf8') }))
    .filter(({ src }) => /const \{[^}]*\} = resolveSavePath\(/.test(src))
}

describe('rename keeps one file, everywhere', () => {
  it('finds the editors and pages it is meant to be checking', () => {
    // Guards the guard, on both halves. Either detector returning nothing makes
    // every assertion below pass against an empty list.
    expect(fileBackedEditors().length, 'the initialFileName detector broke').toBeGreaterThanOrEqual(
      14
    )
    expect(fileBackedPages().length, 'the resolveSavePath detector broke').toBeGreaterThanOrEqual(
      14
    )
  })

  it('offers Rename from every file-backed editor', () => {
    const missing = fileBackedEditors()
      .filter(({ src }) => !/onRenameFile=/.test(src))
      .map((e) => e.rel)
    expect(missing, 'these editors can only supersede, never rename').toEqual([])
  })

  it('asks for the rename mode by name, not by position', () => {
    // `onSave(data, fileName, folder, 'rename')` — the literal is what the page
    // switches on, so a pass-through that forgets it silently archives.
    const missing = fileBackedEditors()
      .filter(({ src }) => !/'rename'/.test(src))
      .map((e) => e.rel)
    expect(missing, 'these editors request a rename without saying so').toEqual([])
  })

  it('accepts the mode on every page, defaulting to the old behaviour', () => {
    // The default matters: `saveRef.current()` is called with no arguments from
    // the unsaved-changes dialog and from navigating away, and neither of those
    // is a rename.
    const missing = fileBackedPages()
      .filter(
        ({ src }) => !/handleSave = async \(data, fileName, folder, mode = 'archive'\)/.test(src)
      )
      .map((p) => p.name)
    expect(missing, 'these pages ignore the mode and always archive').toEqual([])
  })

  it('renames the file before it writes, on every page', () => {
    // Order is the correctness argument. The rename has to happen while BOTH
    // names still exist, or the collision check has nothing to compare: writing
    // first creates the destination, and on a case-insensitive filesystem it
    // writes over the very file about to be renamed.
    const wrong = []
    for (const { name, src } of fileBackedPages()) {
      const move = src.search(/await window\.electronAPI\.moveFile\(selectedFile\.path, newPath\)/)
      const save = src.search(/await window\.electronAPI\.save[A-Za-z]+\(newPath, data\)/)
      if (move === -1) wrong.push(`${name}: never renames the file`)
      else if (save === -1) wrong.push(`${name}: save call not recognised`)
      else if (move > save) wrong.push(`${name}: writes before renaming`)
    }
    expect(wrong).toEqual([])
  })

  it('refuses a collision instead of overwriting, on every page', () => {
    const missing = fileBackedPages()
      .filter(({ src }) => !/moved\?\.conflict/.test(src))
      .map((p) => p.name)
    expect(missing, 'these pages would overwrite another entity').toEqual([])
  })

  it('keeps the archiving branch, because Save still supersedes', () => {
    // The point is two outcomes, not a replacement. A page that dropped the
    // archive branch would quietly change what Save means.
    const missing = fileBackedPages()
      .filter(({ src }) => !/await window\.electronAPI\.archiveFile\(/.test(src))
      .map((p) => p.name)
    expect(missing, 'these pages lost the supersede behaviour').toEqual([])
  })
})
