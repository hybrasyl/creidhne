import { describe, expect, it } from 'vitest'
import BUILTIN_PATTERNS from '../formulaPatterns.js'
import { compile } from '../../utils/formulaEval.js'

// Every library formula starts as one of these templates, so a template the
// server cannot evaluate puts the same fault into every formula made from it.
// The `new-hybrasyl` template wrote `MAX(`, and 250 of the 251 formulas in the
// production library inherited it (HTOO-578).

// NCalc's own spellings. A server without IgnoreCaseAtBuiltInFunctions finds
// the math functions in PascalCase and `if` in lowercase, and no other way.
const NCALC_SPELLINGS = new Set([
  'Abs',
  'Ceiling',
  'Floor',
  'Max',
  'Min',
  'Pow',
  'Round',
  'Sign',
  'Sqrt',
  'Truncate',
  'if'
])

/** The template with each {Placeholder} given a value, as the editor assembles it. */
const filled = (ncalc) => ncalc.replace(/\{[A-Za-z]+\}/g, '1')

describe('the built-in formula patterns', () => {
  it('finds the patterns', () => {
    expect(BUILTIN_PATTERNS.length).toBeGreaterThan(0)
    for (const p of BUILTIN_PATTERNS) expect(p.ncalc, p.id).toBeTruthy()
  })

  it.each(BUILTIN_PATTERNS.map((p) => [p.id, p]))('%s compiles in the preview', (_, p) => {
    expect(() => compile(filled(p.ncalc))).not.toThrow()
  })

  it.each(BUILTIN_PATTERNS.map((p) => [p.id, p]))(
    '%s spells each function the way any server finds it',
    (_, p) => {
      const calls = [...p.ncalc.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map((m) => m[1])
      for (const name of calls) expect(NCALC_SPELLINGS, `${p.id}: ${name}(`).toContain(name)
    }
  )

  it('the check sees a function call at all', () => {
    // Guard the guard: at least one template calls a function, so the
    // spelling test above is not passing on an empty list.
    const anyCall = BUILTIN_PATTERNS.some((p) => /\b[A-Za-z_]+\s*\(/.test(p.ncalc))
    expect(anyCall).toBe(true)
  })
})
