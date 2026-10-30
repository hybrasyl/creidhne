import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { STAGED_TYPES } from '@shared/staging.js'

/**
 * HTOO-453 and HTOO-628. Staging and the page shell reach each file-backed
 * page in several places, and each one fails silently if a page misses it:
 *
 *  - the staged files and the Stage and Release actions (the panel props) — a
 *    page without them shows no staged file and offers no way in;
 *  - the editor column inside the panel — outside it, the toolbar and the
 *    alerts area cannot reach it, and the page renders a second column;
 *  - the Staging box (the page's `saveStaged`, set by New, by a selection and
 *    by the box) — without it, a new staged entity saves live, or a staged file
 *    opens with the box clear and its next Save releases it;
 *  - the editor inside a StagingScope with that box — without it, the header
 *    shows no box, and a staged editor's pickers offer live names only;
 *  - the staged-reference notice — without it, a live file that names a
 *    staged-only entity looks fine;
 *  - the saved file from resolveSavePath — a page that builds its own next file
 *    from <library>/<type> selects a live path after a staged save;
 *  - a staged Save, and a Save that crosses roots, that rename in place — the
 *    archive branch would leave a second file, or move a staged file into the
 *    live tree's .ignore/;
 *  - confirmMove before the write and its apply after — without them, a box
 *    move skips Stage's and Release's checks.
 *
 * The pages are detected as the other page guards detect them.
 */

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesDir = join(srcDir, 'pages')

function pages() {
  return readdirSync(pagesDir)
    .filter((n) => n.endsWith('Page.jsx'))
    .map((n) => ({ name: n, src: readFileSync(join(pagesDir, n), 'utf8') }))
}

function fileBackedPages() {
  return pages()
    .filter(({ src }) => /const \{[^}]*\} = resolveSavePath\(/.test(src))
    .map((p) => ({ ...p, type: p.src.match(/IGNORE_SUBDIR = '([^/']+)\/\.ignore'/)?.[1] }))
}

const lacking = (pattern) =>
  fileBackedPages()
    .filter(({ src }) => !pattern.test(src))
    .map((p) => p.name)

describe('staging and the page shell reach every file-backed page (HTOO-453, HTOO-628)', () => {
  it('finds the pages, one per staged type', () => {
    // Guards the guard, and ties the pages to the type list main validates.
    const found = fileBackedPages()
    expect(found.length).toBeGreaterThanOrEqual(16)
    expect(found.map((p) => p.type).sort()).toEqual([...STAGED_TYPES].sort())
  })

  it('renders the editor column inside the panel, on every page that has one', () => {
    const withPanel = pages().filter(({ src }) => /<EditorFileListPanel\b/.test(src))
    // Guards the guard: the sixteen, and Formulas.
    expect(withPanel.length).toBeGreaterThanOrEqual(17)
    const wrong = withPanel
      .filter(
        ({ src }) =>
          !/<EditorFileListPanel\b[^>]*?>\s*<Box\b[\s\S]*<\/EditorFileListPanel>/.test(src)
      )
      .map((p) => p.name)
    expect(wrong).toEqual([])
  })

  it('lists the staged files and offers Stage and Release in the panel', () => {
    expect(lacking(/stagedFiles=\{stagedFiles\}/)).toEqual([])
    expect(lacking(/stagedNamesByFilename=\{stagedNamesByFilename\}/)).toEqual([])
    expect(lacking(/onStage=\{handleBulkStage\}/)).toEqual([])
    expect(lacking(/onRelease=\{handleBulkRelease\}/)).toEqual([])
  })

  it('keeps the Staging box: New, a selection and the box itself set it', () => {
    expect(
      lacking(/const handleNew = \(opts\) => guard\(\(\) => doNew\(opts\?\.staged === true\)\)/)
    ).toEqual([])
    expect(lacking(/const doNew = \(staged = false\) => \{\s*setSaveStaged\(staged\)/)).toEqual([])
    expect(
      lacking(
        /const doSelect = async \(file\) => \{\s*setSelectedFile\(file\)\s*setSaveStaged\(file\.staged === true\)/
      )
    ).toEqual([])
    expect(
      lacking(
        /const handleSaveStagedChange = useCallback\(\s*\(staged\) => \{\s*setSaveStaged\(staged\)\s*markDirty\(\)/
      )
    ).toEqual([])
    expect(lacking(/resolveSavePath\([^)]*\bsaveStaged \? stagedDir : undefined\s*\)/)).toEqual([])
  })

  it('renders the editor inside a StagingScope with the box', () => {
    expect(
      lacking(
        /<StagingScope\s+saveStaged=\{saveStaged\}\s+onSaveStagedChange=\{handleSaveStagedChange\}\s*>\s*<\w+Editor\b/
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
    // Anchored on the destructuring itself: `$2file: savedFile` once passed a
    // looser match and read a property that does not exist.
    expect(
      lacking(/\bisRename,\s*crossesRoot,\s*file: savedFile\s*\}\s*=\s*resolveSavePath\(/)
    ).toEqual([])
    expect(lacking(/const nextFile = \(\) => savedFile\b/)).toEqual([])
    expect(lacking(/^(?![\s\S]*toSectionFile\()[\s\S]*$/)).toEqual([])
  })

  it('renames in place for a staged file and for a box move, on both branches of the save', () => {
    const wrong = fileBackedPages()
      .filter(
        ({ src }) =>
          (src.match(/isRename && \(mode === 'rename' \|\| wasStaged \|\| crossesRoot\)/g) || [])
            .length !== 2
      )
      .map((p) => p.name)
    expect(wrong).toEqual([])
  })

  it('checks a box move before the write, and applies it after', () => {
    const wrong = []
    for (const { name, src } of fileBackedPages()) {
      const confirm = src.search(
        /const move = await confirmMove\(crossesRoot \? selectedFile : null, data\.name\)\s*if \(move\.cancelled\) return/
      )
      const write = src.search(/await window\.electronAPI\.moveFile\(selectedFile\.path, newPath\)/)
      const apply = src.search(/await move\.apply\(newPath\)/)
      if (confirm === -1) wrong.push(`${name}: no confirmMove`)
      else if (apply === -1) wrong.push(`${name}: no move.apply`)
      else if (!(confirm < write && write < apply)) wrong.push(`${name}: wrong order`)
    }
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
