import { describe, it, expect, beforeEach } from 'vitest'
import { normalize } from 'path'
import {
  applySettingsRoots,
  bless,
  allRoots,
  _resetRootsForTests
} from '../handlerContext.js'

const norm = (p) => normalize(p)

beforeEach(() => {
  _resetRootsForTests()
})

describe('applySettingsRoots', () => {
  it('blesses every configured library plus its world parent', () => {
    applySettingsRoots({
      libraries: ['/data/world1/xml', '/data/world2/xml']
    })
    const roots = new Set(allRoots())
    expect(roots.has(norm('/data/world1/xml'))).toBe(true)
    expect(roots.has(norm('/data/world2/xml'))).toBe(true)
    expect(roots.has(norm('/data/world1'))).toBe(true)
    expect(roots.has(norm('/data/world2'))).toBe(true)
  })

  it('blesses clientPath as a separate root', () => {
    applySettingsRoots({
      libraries: ['/data/world/xml'],
      clientPath: '/games/DA'
    })
    const roots = new Set(allRoots())
    expect(roots.has(norm('/games/DA'))).toBe(true)
  })

  it('does not bless a drive root when a library lives at one', () => {
    // dirname(rootPath) === rootPath — that branch must not add the path.
    const lib = norm('/')
    applySettingsRoots({ libraries: [lib] })
    const roots = [...allRoots()]
    // Either the library was added once (because dirname == itself triggers
    // the skip) or not at all if normalize swallowed it. Critically: it
    // shouldn't be added a second time as a "world parent."
    const occurrences = roots.filter((r) => r === lib).length
    expect(occurrences).toBeLessThanOrEqual(1)
  })

  it('handles missing fields without throwing', () => {
    expect(() => applySettingsRoots({})).not.toThrow()
    expect(() => applySettingsRoots(null)).not.toThrow()
    expect(() => applySettingsRoots(undefined)).not.toThrow()
  })

  it('clears prior settings roots on re-apply', () => {
    applySettingsRoots({ libraries: ['/old/world/xml'] })
    applySettingsRoots({ libraries: ['/new/world/xml'] })
    const roots = new Set(allRoots())
    expect(roots.has(norm('/old/world/xml'))).toBe(false)
    expect(roots.has(norm('/old/world'))).toBe(false)
    expect(roots.has(norm('/new/world/xml'))).toBe(true)
    expect(roots.has(norm('/new/world'))).toBe(true)
  })

  it('preserves dialog-blessed roots across re-apply', () => {
    bless('/dialog/picked')
    applySettingsRoots({ libraries: ['/data/world/xml'] })
    const roots = new Set(allRoots())
    expect(roots.has(norm('/dialog/picked'))).toBe(true)
  })

  it('skips empty / non-string library entries', () => {
    applySettingsRoots({ libraries: ['', null, undefined, 0, '/valid/world/xml'] })
    const roots = [...allRoots()]
    // Only the valid entry + its parent should be present.
    expect(roots).toContain(norm('/valid/world/xml'))
    expect(roots).toContain(norm('/valid/world'))
  })
})

describe('bless', () => {
  it('adds a path to the blessed root set', () => {
    bless('/dialog/picked')
    expect([...allRoots()]).toContain(norm('/dialog/picked'))
  })

  it('ignores empty / non-string inputs', () => {
    bless('')
    bless(null)
    bless(undefined)
    expect([...allRoots()]).toEqual([])
  })

  it('is idempotent — same path added twice only appears once', () => {
    bless('/dialog/picked')
    bless('/dialog/picked')
    const roots = [...allRoots()]
    expect(roots.filter((r) => r === norm('/dialog/picked')).length).toBe(1)
  })
})

describe('allRoots ordering', () => {
  it('yields settingsRoots before blessedRoots', () => {
    bless('/blessed/path')
    applySettingsRoots({ libraries: ['/data/world/xml'] })
    const ordered = [...allRoots()]
    const settingsIdx = ordered.indexOf(norm('/data/world/xml'))
    const blessedIdx = ordered.indexOf(norm('/blessed/path'))
    expect(settingsIdx).toBeGreaterThanOrEqual(0)
    expect(blessedIdx).toBeGreaterThanOrEqual(0)
    expect(settingsIdx).toBeLessThan(blessedIdx)
  })
})

