import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PAGE_FOR_TYPE } from '../utils/typePages'

/**
 * HTOO-625. The duplicate-key report opens a file on its editor page, and the
 * page names the other files that hold the key. Both halves live on each
 * file-backed page, so this is the shape this repo keeps finding: a pattern
 * that reaches most of its sites, not all. A page without the request hook
 * ignores Open with no error; a page without the notice hides the collision.
 *
 * The pages are detected as `pageSaveFlow` detects them, and the report's
 * type-to-page table is checked against PageRenderer, not restated.
 */

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesDir = join(srcDir, 'pages')
const renderer = readFileSync(join(srcDir, 'components', 'PageRenderer.jsx'), 'utf8')

function fileBackedPages() {
  return readdirSync(pagesDir)
    .filter((n) => n.endsWith('Page.jsx'))
    .map((n) => ({ name: n, src: readFileSync(join(pagesDir, n), 'utf8') }))
    .filter(({ src }) => /const \{[^}]*\} = resolveSavePath\(/.test(src))
    .map((p) => ({ ...p, type: p.src.match(/IGNORE_SUBDIR = '([^/']+)\/\.ignore'/)?.[1] }))
}

describe('the duplicate-key report reaches every file-backed page (HTOO-625)', () => {
  it('finds the pages and their types', () => {
    // Guards the guard: a detector that stops matching passes with nothing checked.
    const pages = fileBackedPages()
    expect(pages.length).toBeGreaterThanOrEqual(16)
    expect(pages.filter((p) => !p.type).map((p) => p.name)).toEqual([])
  })

  it('takes an open request on each page', () => {
    const missing = fileBackedPages()
      .filter(({ src }) => !/useOpenFileRequest\(\w+, files, loading, handleSelect\)/.test(src))
      .map((p) => p.name)
    expect(missing).toEqual([])
  })

  it('renders the shared-key notice above the editor on each page', () => {
    const missing = fileBackedPages()
      .filter(({ src }) => !/<SharedKeyNotice type=\{\w+\} file=\{selectedFile\} \/>/.test(src))
      .map((p) => p.name)
    expect(missing).toEqual([])
  })

  it('maps each type to the key under which PageRenderer renders its page', () => {
    const wrong = fileBackedPages()
      .filter(({ name, type }) => {
        const key = PAGE_FOR_TYPE[type]
        const component = name.replace(/\.jsx$/, '')
        return !key || !new RegExp(`case '${key}':\\s*page = <${component}\\b`).test(renderer)
      })
      .map((p) => `${p.name} (${p.type})`)
    expect(wrong).toEqual([])
  })
})
