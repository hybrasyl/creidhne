import { describe, it, expect, beforeEach } from 'vitest'
import { normalize } from 'path'
import {
  applySettingsRoots,
  bless,
  allRoots,
  reconcileSettingsSave,
  withGrantedTaliesin,
  _resetRootsForTests
} from '../handlerContext.js'

const norm = (p) => normalize(p)

// A settings path is a root only when a grant or a blessed root covers it
// (HTOO-679). These tests grant what they need through the test reset.
function grant(...dirs) {
  _resetRootsForTests({ grants: { dirs: new Set(dirs.map(norm)), executables: {} } })
}

beforeEach(() => {
  _resetRootsForTests()
})

describe('applySettingsRoots', () => {
  it('blesses every granted library plus its world parent', () => {
    grant('/data/world1/xml', '/data/world2/xml')
    applySettingsRoots({
      libraries: ['/data/world1/xml', '/data/world2/xml']
    })
    const roots = new Set(allRoots())
    expect(roots.has(norm('/data/world1/xml'))).toBe(true)
    expect(roots.has(norm('/data/world2/xml'))).toBe(true)
    expect(roots.has(norm('/data/world1'))).toBe(true)
    expect(roots.has(norm('/data/world2'))).toBe(true)
  })

  it('blesses a granted clientPath as a separate root', () => {
    grant('/data/world/xml', '/games/DA')
    applySettingsRoots({
      libraries: ['/data/world/xml'],
      clientPath: '/games/DA'
    })
    const roots = new Set(allRoots())
    expect(roots.has(norm('/games/DA'))).toBe(true)
  })

  it('makes no root of a settings path that no grant covers, and reports it', () => {
    grant('/data/world/xml')
    const refused = applySettingsRoots({
      libraries: ['/data/world/xml', '/evil/xml'],
      clientPath: '/evil',
      brigidAssetsPath: '/evil/assets'
    })
    const roots = new Set(allRoots())
    expect(roots.has(norm('/evil/xml'))).toBe(false)
    expect(roots.has(norm('/evil'))).toBe(false)
    expect(roots.has(norm('/evil/assets'))).toBe(false)
    expect(refused).toEqual(['/evil/xml', '/evil', '/evil/assets'])
  })

  it('accepts a settings path inside a path a dialog returned this session', () => {
    bless('/picked/world/xml')
    expect(applySettingsRoots({ libraries: ['/picked/world/xml'] })).toEqual([])
    expect(new Set(allRoots()).has(norm('/picked/world'))).toBe(true)
  })

  it('never makes a filesystem root a root', () => {
    // Even a grant cannot cover `/`, and the world parent of `/xml` is `/`.
    _resetRootsForTests({ grants: { dirs: new Set(['/', norm('/xml')]), executables: {} } })
    applySettingsRoots({ libraries: ['/', '/xml'] })
    const roots = [...allRoots()]
    expect(roots).not.toContain(norm('/'))
    expect(roots).toContain(norm('/xml'))
  })

  it('handles missing fields without throwing', () => {
    expect(() => applySettingsRoots({})).not.toThrow()
    expect(() => applySettingsRoots(null)).not.toThrow()
    expect(() => applySettingsRoots(undefined)).not.toThrow()
  })

  it('clears prior settings roots on re-apply', () => {
    grant('/old/world/xml', '/new/world/xml')
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
    grant('/valid/world/xml')
    applySettingsRoots({ libraries: ['', null, undefined, 0, '/valid/world/xml'] })
    const roots = [...allRoots()]
    // Only the valid entry + its parent should be present.
    expect(roots).toContain(norm('/valid/world/xml'))
    expect(roots).toContain(norm('/valid/world'))
  })
})

describe('reconcileSettingsSave', () => {
  it('prunes a grant the settings no longer name, and adds none', async () => {
    grant('/a/world/xml', '/b/world/xml')
    await reconcileSettingsSave({ libraries: ['/a/world/xml', '/evil/xml'], taliesinPath: null })
    applySettingsRoots({ libraries: ['/a/world/xml', '/b/world/xml', '/evil/xml'] })
    const roots = new Set(allRoots())
    expect(roots.has(norm('/a/world/xml'))).toBe(true)
    expect(roots.has(norm('/b/world/xml'))).toBe(false)
    expect(roots.has(norm('/evil/xml'))).toBe(false)
  })

  it("replaces the renderer's taliesinPath with main's record", async () => {
    const exe = { path: '/apps/taliesin', size: 1, mtimeMs: 1, sha256: 'x', isDirectory: false }
    _resetRootsForTests({ grants: { dirs: new Set(), executables: { taliesin: exe } } })
    const saved = await reconcileSettingsSave({ libraries: [], taliesinPath: '/evil/payload' })
    expect(saved.taliesinPath).toBe('/apps/taliesin')
    expect(withGrantedTaliesin({ taliesinPath: '/evil/payload' }).taliesinPath).toBe(
      '/apps/taliesin'
    )
  })

  it('clears the approval when the renderer clears taliesinPath', async () => {
    const exe = { path: '/apps/taliesin', size: 1, mtimeMs: 1, sha256: 'x', isDirectory: false }
    _resetRootsForTests({ grants: { dirs: new Set(), executables: { taliesin: exe } } })
    const saved = await reconcileSettingsSave({ libraries: [], taliesinPath: null })
    expect(saved.taliesinPath).toBeNull()
    expect(withGrantedTaliesin({}).taliesinPath).toBeNull()
  })

  it('gives no program to a renderer value when nothing is approved', async () => {
    const saved = await reconcileSettingsSave({ libraries: [], taliesinPath: '/evil/payload' })
    expect(saved.taliesinPath).toBeNull()
  })
})

describe('bless', () => {
  it('adds a path to the blessed root set', () => {
    bless('/dialog/picked')
    expect([...allRoots()]).toContain(norm('/dialog/picked'))
  })

  it('ignores empty / non-string inputs and filesystem roots', () => {
    bless('')
    bless(null)
    bless(undefined)
    bless('/')
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
    grant('/data/world/xml')
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
