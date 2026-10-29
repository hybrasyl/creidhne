import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

// The Lua stubs that "Set up Lua environment" copies into a world (HTOO-577).
// A regeneration once dropped 13 enums with no error, and the stubs still
// loaded: the language server only stops knowing the types. So this reads the
// committed stubs and asserts that each type a global names is defined.

const stubsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'lua-stubs')
const read = (f) => readFileSync(join(stubsDir, f), 'utf8')
const stubFiles = readdirSync(stubsDir).filter((f) => f.endsWith('.lua'))

const defined = new Set(
  stubFiles.flatMap((f) => [...read(f).matchAll(/^---@(?:class|alias) (\w+)/gm)].map((m) => m[1]))
)
const BUILTIN = new Set(['string', 'number', 'boolean', 'integer', 'table', 'any', 'nil'])

// The enums the server puts in every script's globals (Script.cs), by C# type.
// Element is the global for ElementType.
const ENUM_GLOBALS = ['Gender', 'LegendIcon', 'LegendColor', 'ElementType', 'Direction', 'Class']

describe('the Lua stubs', () => {
  it('define each type that _globals.lua names', () => {
    const types = [...read('_globals.lua').matchAll(/^---@(?:type|return) (\w+)/gm)].map(
      (m) => m[1]
    )
    // Guards the guard: a regex that stops matching would pass with nothing checked.
    expect(types.length).toBeGreaterThanOrEqual(15)
    expect(types.filter((t) => !BUILTIN.has(t) && !defined.has(t))).toEqual([])
  })

  it('define each enum the server makes a script global', () => {
    expect(ENUM_GLOBALS.filter((e) => !defined.has(e))).toEqual([])
  })
})
