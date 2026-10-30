import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { STAGED_TYPES } from '@shared/staging.js'

/**
 * HTOO-453. Staging reaches each file-backed page in five places, and each one
 * fails silently if a page misses it:
 *
 *  - the Staged tab and the Stage and Release actions (the panel props) — a
 *    page without them shows no staged file and offers no way in;
 *  - the editor inside a StagingScope — without it, a staged editor's pickers
 *    offer live names only, and its header shows Archive in place of Release;
 *  - the staged-reference notice — without it, a live file that names a
 *    staged-only entity looks fine;
 *  - the saved file from resolveSavePath — a page that builds its own next file
 *    from <library>/<type> selects a live path after a staged save;
 *  - a staged Save that renames in place — the archive branch would move the
 *    old staged file into the live tree's .ignore/, which git tracks.
 *
 * The pages are detected as the other page guards detect them.
 */

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesDir = join(srcDir, 'pages')

function fileBackedPages() {
  return readdirSync(pagesDir)
    .filter((n) => n.endsWith('Page.jsx'))
    .map((n) => ({ name: n, src: readFileSync(join(pagesDir, n), 'utf8') }))
    .filter(({ src }) => /const \{[^}]*\} = resolveSavePath\(/.test(src))
    .map((p) => ({ ...p, type: p.src.match(/IGNORE_SUBDIR = '([^/']+)\/\.ignore'/)?.[1] }))
}

const lacking = (pattern) =>
  fileBackedPages()
    .filter(({ src }) => !pattern.test(src))
    .map((p) => p.name)

describe('staging reaches every file-backed page (HTOO-453)', () => {
  it('finds the pages, one per staged type', () => {
    // Guards the guard, and ties the pages to the type list main validates.
    const pages = fileBackedPages()
    expect(pages.length).toBeGreaterThanOrEqual(16)
    expect(pages.map((p) => p.type).sort()).toEqual([...STAGED_TYPES].sort())
  })

  it('lists the staged files and offers Stage and Release in the panel', () => {
    expect(lacking(/stagedFiles=\{stagedFiles\}/)).toEqual([])
    expect(lacking(/stagedNamesByFilename=\{stagedNamesByFilename\}/)).toEqual([])
    expect(lacking(/onStage=\{handleBulkStage\}/)).toEqual([])
    expect(lacking(/onRelease=\{handleBulkRelease\}/)).toEqual([])
  })

  it('renders the editor inside a StagingScope for the selected file', () => {
    expect(
      lacking(
        /<StagingScope file=\{selectedFile\} onStage=\{handleStage\} onRelease=\{handleRelease\}>\s*<\w+Editor\b/
      )
    ).toEqual([])
  })

  it('renders the staged-reference notice beside the shared-key notice', () => {
    expect(
      lacking(
        /<SharedKeyNotice type=\{(\w+)\} file=\{selectedFile\} \/>\s*<StagedReferenceNotice type=\{\1\} file=\{selectedFile\} \/>/
      )
    ).toEqual([])
  })

  it('selects the file resolveSavePath returns, not one it builds itself', () => {
    expect(lacking(/file: savedFile[\s\S]*const nextFile = \(\) => savedFile/)).toEqual([])
    expect(lacking(/^(?![\s\S]*toSectionFile\()[\s\S]*$/)).toEqual([])
  })

  it('renames a staged file in place on both branches of the save', () => {
    const wrong = fileBackedPages()
      .filter(
        ({ src }) =>
          (src.match(/isRename && \(mode === 'rename' \|\| wasStaged\)/g) || []).length !== 2
      )
      .map((p) => p.name)
    expect(wrong).toEqual([])
  })

  it('tells the rename repair when the entity is staged', () => {
    // Only the pages that offer the repair call confirmRename.
    const wrong = fileBackedPages()
      .filter(({ src }) => /confirmRename\(/.test(src))
      .filter(({ src }) => !/staged: selectedFile\?\.staged === true/.test(src))
      .map((p) => p.name)
    expect(wrong).toEqual([])
  })
})
