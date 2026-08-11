import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * HTOO-159. One component owns the save-destination row: the Filename field, the folder
 * picker, and the warning that a save will write somewhere new.
 *
 * The folder picker was grafted from Taliesin in PR #39 and reached all 14 editors. Two
 * of them — SpawngroupEditor and LocalizationEditor — held a hand-written copy of
 * `EditorHeader`'s markup instead of the component, and the copies had drifted. Each
 * copy carried the picker but none of the warning: no colour on the Filename field for a
 * rename, a move or a pending computed name, no helper text naming the destination, and a
 * recycle button that never disabled. A rename in Spawn Groups or Localizations wrote a
 * new file and archived the old one, and said neither thing first.
 *
 * Duplicated markup drifts silently. Both copies render, each looks correct on its own,
 * and only a comparison shows the missing helper text — so no test of behaviour in one
 * page can report that another page lost a warning. This asserts the source instead:
 * exactly one component may own that row, and every file-backed editor must use it.
 */

const componentsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'components')
const rendererDir = join(dirname(fileURLToPath(import.meta.url)), '..')

function jsxFilesUnder(dir) {
  return readdirSync(dir, { recursive: true })
    .map((n) => String(n).replace(/\\/g, '/'))
    .filter((n) => n.endsWith('.jsx'))
    .map((rel) => ({ rel, name: rel.split('/').pop(), src: readFileSync(join(dir, rel), 'utf8') }))
}

/**
 * Editors that own one file per entity. Detected by the `initialFileName` prop, which is
 * the filename the entity loaded with and exists only where there is a file to rename.
 *
 * Deliberately NOT a hardcoded list, and deliberately not every `*Editor.jsx`:
 * FormulaEditor, SpellbookEditor, DamageEditor and HealEditor edit a part of a document
 * rather than a file of their own, so they have no save destination to warn about.
 */
function fileBackedEditors() {
  return jsxFilesUnder(componentsDir).filter(
    ({ name, src }) => name.endsWith('Editor.jsx') && src.includes('initialFileName')
  )
}

describe('editor save-destination header (HTOO-159)', () => {
  it('finds the editors it is meant to be checking', () => {
    // Guards the guard. A walk that returns nothing, or a prop rename, makes every
    // assertion below pass against an empty list — the same silent pass this file exists
    // to catch.
    //
    // A floor, not an exact count: a 15th editor is legitimate and the tests below pick
    // it up on their own. Both names are asserted because those two are the editors that
    // drifted, so losing them from the detector loses the regression.
    const editors = fileBackedEditors()
    expect(
      editors.length,
      'no file-backed editors detected — the initialFileName detector has stopped working'
    ).toBeGreaterThanOrEqual(14)
    const names = editors.map((e) => e.name)
    expect(names).toContain('SpawngroupEditor.jsx')
    expect(names).toContain('LocalizationEditor.jsx')
  })

  it('renders the shared header rather than its own', () => {
    const missing = fileBackedEditors()
      .filter(({ src }) => !/<EditorHeader\b/.test(src))
      .map((e) => e.name)
    expect(
      missing,
      'these editors hand-roll the header, so they lose every warning EditorHeader adds'
    ).toEqual([])
  })

  it('keeps the Filename field in one place', () => {
    // The field and its warning states are one rule, so they live in one file. A second
    // Filename field is a second copy of that rule, and the copy is what drifts.
    const owners = jsxFilesUnder(rendererDir)
      .filter(({ src }) => src.includes('label="Filename"'))
      .map((f) => f.rel)
    expect(owners).toEqual(['components/shared/EditorHeader.jsx'])
  })

  it('keeps the folder picker in one place', () => {
    // Same rule for the picker half: `EditorHeader` decides when it renders and when it
    // warns, from `initialFolder`. A direct FolderSelect gets neither decision.
    const owners = jsxFilesUnder(rendererDir)
      .filter(({ src }) => /<FolderSelect\b/.test(src))
      .map((f) => f.rel)
    expect(owners).toEqual(['components/shared/EditorHeader.jsx'])
  })
})
