import { describe, it, expect } from 'vitest'
import { join } from 'path'
import { readFileSync } from 'fs'
import { pickerStartPath, pickedFolder } from '../pickerStart.js'

describe('pickerStartPath', () => {
  const onDisk = new Set(['/worlds/ceridwen', '/home/me/Documents', '/home/me'])
  const exists = (p) => onDisk.has(p)

  it('takes the first candidate that exists', () => {
    expect(pickerStartPath(['/worlds/ceridwen', '/home/me'], exists)).toBe('/worlds/ceridwen')
  })

  it('skips a stale setting, an empty string and a missing value', () => {
    expect(
      pickerStartPath([null, undefined, '', '/worlds/moved', '/home/me/Documents'], exists)
    ).toBe('/home/me/Documents')
  })

  it('returns undefined when nothing exists, so the dialog gets no defaultPath', () => {
    expect(pickerStartPath(['/nope'], exists)).toBeUndefined()
    expect(pickerStartPath([], exists)).toBeUndefined()
  })
})

describe('pickedFolder', () => {
  it('keeps a picked folder, and takes the parent of a picked file', () => {
    expect(pickedFolder('/worlds/ceridwen', true)).toBe('/worlds/ceridwen')
    expect(pickedFolder(join('/worlds', 'formulas.lua'), false)).toBe(join('/worlds'))
  })
})

// Count the sites (CLAUDE.md, structural guards). A picker added later without a
// defaultPath opens in Downloads on Electron 43+, and nothing else would notice.
describe('every picker in main passes a defaultPath', () => {
  const src = readFileSync(join(__dirname, '..', 'index.js'), 'utf8')
  const calls = [...src.matchAll(/dialog\.show(?:Open|Save)Dialog\(/g)].map((m) => {
    // The options object: from the call to its closing `})`.
    const rest = src.slice(m.index)
    return rest.slice(0, rest.indexOf('})') + 2)
  })

  it('finds the pickers (guard the guard)', () => {
    expect(calls.length).toBeGreaterThanOrEqual(5)
  })

  it('gives each one a start folder', () => {
    const missing = calls.filter((c) => !/defaultPath\s*:/.test(c))
    expect(missing).toEqual([])
  })
})
