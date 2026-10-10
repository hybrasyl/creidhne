// The renderer runs SANDBOXED, so Node's globals are not there (HTOO-393).
//
// Ported from balor, where it exists because of a real failure: a page read
// `process.platform` for one sentence, passed typecheck, lint, 2430 unit and jsdom
// assertions and 30 of 30 e2e, and threw `ReferenceError` the first time a person
// clicked its tab. Creidhne's main window has run `sandbox: true` since HTOO-54.
//
// **Every gate was blind to it, and one for a reason no care fixes: vitest runs in
// Node.** The jsdom environment gives a component a DOM, never a renderer, and
// Node's globals are present in it by construction. The environment cannot be made
// to tell the truth either (react-dom's development build reads `NODE_ENV` off the
// very global that would have to go), so the check reads the SOURCE.
//
// Renderer only. `src/main` is Node and uses these freely; `src/shared` is loaded
// by the node environment and by the renderer bundle, and is kept electron-free by
// its own rule. e2e/nav-pages.spec.js catches the rest of the class by opening
// every page in the real renderer.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

// The renderer source root, from this file's own location, as the other source
// guards in this folder find it.
const RENDERER_SRC = join(__dirname, '..')

/**
 * The globals a bundler leaves alone and a sandboxed renderer does not have.
 *
 * **Two groups, because the false-positive risk differs.** `process`, `Buffer`
 * and `require` are ordinary English words, so a bare match reds on prose — and
 * stripping comments does not save it, because the prose that matters is JSX
 * TEXT. Porting this check to `epona` found exactly that: `Epona cannot reach
 * its background process.` matched, on the full stop ending the sentence. So
 * these three must be followed by a real USE — a property access, a call or an
 * index — and a trailing `.` with nothing after it is not one.
 *
 * `__dirname` and `__filename` are not words, and their ordinary use is BARE
 * (`join(__dirname, x)`), so requiring an access there would miss every real
 * case. They are matched as identifiers.
 */
const WORD_LIKE = ['process', 'Buffer', 'require']
const BARE = ['__dirname', '__filename']
const NODE_GLOBALS = [...WORD_LIKE, ...BARE]

/** A property access, a call or an index. **No whitespace is allowed after the
 *  dot**, which is what separates `process.platform` from `cannot reach the
 *  process. Restart it.` — the second sentence puts a capital letter two
 *  characters after the full stop and matched until this was tightened. The
 *  cost is a chained `process` split across lines, which no formatter here
 *  produces for a global.
 *
 *  A property access, a call or an index — and for `.`, something must follow
 *  it. `\\.[A-Za-z_$]` is what separates `process.platform` from a sentence
 *  that happens to end in the word. */
function useOf(name) {
  return WORD_LIKE.includes(name)
    ? new RegExp(`\\b${name}\\s*(?:\\.[A-Za-z_$]|\\(|\\[)`)
    : new RegExp(`\\b${name}\\b`)
}

/** Comments first. A sentence in a comment may legitimately name any of these —
 *  this file's own header does — and the rule is to describe the pattern rather
 *  than reproduce it. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/** A hand-rolled walk rather than `fs.globSync`, which is still marked
 *  experimental on the Node this project builds against. */
function rendererSources(dir = RENDERER_SRC) {
  const found = []
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (item.name !== '__tests__') found.push(...rendererSources(join(dir, item.name)))
    } else if (/\.jsx?$/.test(item.name)) {
      found.push(join(dir, item.name))
    }
  }
  return found
}

describe('the renderer never touches a Node global', () => {
  // The assertion that would have caught WP33 before it reached a click.
  it.each(NODE_GLOBALS)('never reads `%s`', (name) => {
    const pattern = useOf(name)
    const offenders = rendererSources()
      .filter((file) => pattern.test(stripComments(readFileSync(file, 'utf8'))))
      .map((file) => file.slice(RENDERER_SRC.length + 1))

    // Named in the failure, so the message is the fix rather than a boolean.
    expect(offenders).toEqual([])
  })

  // Without this the suite above passes on an empty list — the failure mode the
  // fuse verifier calls a zero-wire pass. A walk that silently matches nothing
  // reads as coverage.
  it('actually read the renderer', () => {
    const files = rendererSources()
    expect(files.length).toBeGreaterThan(100)
    expect(files.some((f) => f.endsWith('MainToolbar.jsx'))).toBe(true)
  })

  // And that the matcher can fail at all. A regex that matches nothing anywhere
  // would pass every case above for the wrong reason.
  it('matches a use, and not a mention', () => {
    const pattern = useOf('process')
    expect(pattern.test('const p = process' + '.platform')).toBe(true)
    expect(pattern.test('the build process is slow')).toBe(false)
  })

  // The regression this check earned by being ported. A sentence in JSX TEXT
  // ending in the word matched, because the full stop looked like a property
  // access. Comment-stripping cannot help — it is not a comment. Found in
  // `epona`: "Epona cannot reach its background process."
  it('does not match a sentence that merely ENDS in the word', () => {
    const pattern = useOf('process')
    expect(pattern.test('Creidhne cannot reach its background process.')).toBe(false)
    expect(pattern.test('cannot reach the process. Restart it.')).toBe(false)
  })

  // And the bare pair still match the way they are really written — requiring
  // an access there would miss `join(__dirname, x)`, which is every real use.
  it('matches __dirname bare, because that is how it is used', () => {
    expect(useOf('__dirname').test('join(__dirname, x)')).toBe(true)
    expect(useOf('__filename').test('const f = __filename')).toBe(true)
  })
})
