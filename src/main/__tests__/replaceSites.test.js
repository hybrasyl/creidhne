// HTOO-469: a `replace` whose replacement is a STRING built from a value.
//
// `String.prototype.replace` (and `replaceAll`) expands `$&`, `$'`, `` $` ``,
// `$1`–`$9` and `$$` inside a replacement string. Every annotation Creidhne
// writes (Comment, Location, creidhne:meta) was spliced in with a template
// literal, so a value holding one of those was corrupted on save: `a $& b`
// came back as `a <Name>Bob</Name> b`. Nothing threw, and the file stayed
// well-formed XML. No world file has one today, which is why nobody saw it.
//
// Two parts. The round trips prove each writer keeps a `$`-bearing value. The
// source check holds the rule for the writer nobody has added yet: the fix
// for this class is a replacer FUNCTION, and a sixth injector written the old
// way would pass every round trip that does not know about it.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import * as espree from 'espree'
import {
  injectComment,
  extractComment,
  injectNameAnnotations,
  extractLocation,
  injectMeta,
  extractMeta
} from '../xmlCommentUtils.js'
import { parseCreatureXml, serializeCreatureXml } from '../creatureXml.js'
import { parseStatusXml, serializeStatusXml } from '../statusXml.js'
import { assembleFormula } from '../../renderer/src/utils/formulaAssembly.js'

const REPO = join(__dirname, '..', '..', '..')

// The first two are the positive control: a plain value and a `$` that is not
// a special both survive, so a failure below is about the specials.
const VALUES = ['Mileth Inn', 'costs $5', 'a $& b', "a $' b", 'a $` b', 'shop $1 tier', 'a $$ b']

const NPC = `<?xml version="1.0"?>\n<Npc xmlns="x">\n  <Name>Bob</Name>\n</Npc>\n`

describe('every annotation writer keeps a value that holds $', () => {
  it.each(VALUES)('%s', async (v) => {
    expect(extractComment(injectComment(NPC, v, 'Npc'))).toBe(v)

    const named = injectNameAnnotations(NPC, v, v)
    expect(extractLocation(named)).toBe(v)
    expect(extractComment(named)).toBe(v)

    expect(extractMeta(injectMeta(NPC, { note: v }, 'Npc'), {}).note).toBe(v)

    // The creature and status writers are their own injectors, so each goes
    // through a save.
    const creature = await parseCreatureXml(
      `<?xml version="1.0"?>\n<Creature xmlns="x" Name="Wolf" Sprite="1"/>`
    )
    creature.meta = { family: v, weapon: '' }
    expect((await parseCreatureXml(serializeCreatureXml(creature))).meta.family).toBe(v)

    const status = await parseStatusXml(
      `<?xml version="1.0"?>\n<Status xmlns="x" Name="Stun" Icon="0"/>`
    )
    status.prohibitedMessageKey = v
    expect((await parseStatusXml(serializeStatusXml(status))).prohibitedMessageKey).toBe(v)
  })
})

describe('formula assembly keeps a parameter value that holds $', () => {
  const defs = [{ key: 'Base', type: 'number' }]

  it.each(VALUES)('%s', (v) => {
    expect(assembleFormula('{Base} + 1', { Base: v }, defs)).toBe(`${v} + 1`)
  })

  it('ends when a value holds its own placeholder', () => {
    // The old `while (includes)` loop never ended here.
    expect(assembleFormula('{Base}', { Base: '{Base}' }, defs)).toBe('{Base}')
  })
})

// ── The source check ──────────────────────────────────────────────────────────

/**
 * Sites whose replacement is neither a literal nor a function, each with the
 * reason it cannot hold a `$` special. A new site fails until it is a
 * function or is listed here. Keyed by file and the argument's source text.
 */
const ALLOWED = {
  'src/renderer/src/utils/daClient.js sep': 'a path separator: "/" or "\\"',
  'src/renderer/src/components/formulas/FormulaEditor.jsx String(effectiveAcquiredLevel)':
    'a number'
}

const ROOTS = ['src', 'scripts']
const SOURCE = /\.(m?js|jsx)$/

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === '__tests__' || name === 'fixtures') return []
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walk(p)
    return SOURCE.test(name) && !/\.test\.m?jsx?$/.test(name) ? [p] : []
  })
}

/** Every replace/replaceAll call in a file, as { arg, text }. */
function replaceCalls(source) {
  const ast = espree.parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    range: true
  })
  const calls = []
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      !node.callee.computed &&
      ['replace', 'replaceAll'].includes(node.callee.property.name) &&
      node.arguments.length === 2
    ) {
      const arg = node.arguments[1]
      calls.push({ arg, text: source.slice(arg.range[0], arg.range[1]) })
    }
    for (const key of espree.VisitorKeys[node.type] ?? []) {
      const child = node[key]
      if (Array.isArray(child)) child.forEach(visit)
      else visit(child)
    }
  }
  visit(ast)
  return calls
}

/** A replacement that cannot carry a value into replace's $ expansion. */
function isSafe(arg) {
  if (arg.type === 'Literal' && typeof arg.value === 'string') return true
  if (arg.type === 'TemplateLiteral' && arg.expressions.length === 0) return true
  return arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression'
}

describe('every replace in the source has a safe replacement', () => {
  const files = ROOTS.flatMap((r) => walk(join(REPO, r)))
  const sites = files.flatMap((file) =>
    replaceCalls(readFileSync(file, 'utf8')).map((c) => ({
      ...c,
      key: `${relative(REPO, file).replace(/\\/g, '/')} ${c.text}`
    }))
  )

  it('finds the calls it checks', () => {
    // Guard the guard: a walk that parsed nothing would pass vacuously.
    expect(files.length).toBeGreaterThan(200)
    expect(sites.length).toBeGreaterThan(50)
    expect(sites.filter((s) => s.arg.type === 'ArrowFunctionExpression').length).toBeGreaterThan(5)
  })

  it('uses a literal or a replacer function, or is listed with a reason', () => {
    const unsafe = sites.filter((s) => !isSafe(s.arg) && !(s.key in ALLOWED))
    expect(
      unsafe.map((s) => s.key),
      'Use a replacer function: xml.replace(re, (m) => `${m}…`). See injectAfter.'
    ).toEqual([])
  })

  it('lists no site that no longer exists', () => {
    // An entry outliving its site would excuse the next one written there.
    const keys = new Set(sites.map((s) => s.key))
    expect(Object.keys(ALLOWED).filter((k) => !keys.has(k))).toEqual([])
  })
})
