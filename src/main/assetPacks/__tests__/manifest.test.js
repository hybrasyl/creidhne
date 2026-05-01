import { describe, it, expect } from 'vitest'
import { validateManifest } from '../manifest.js'

const valid = {
  schema_version: 1,
  pack_id: 'test-pack',
  pack_version: '0.1.0',
  content_type: 'ability_icons',
  covers: {}
}

describe('validateManifest', () => {
  it('accepts a minimally-valid manifest', () => {
    const r = validateManifest(valid)
    expect(r.ok).toBe(true)
    expect(r.manifest).toBe(valid)
  })

  it('rejects null and non-object inputs', () => {
    expect(validateManifest(null).ok).toBe(false)
    expect(validateManifest(undefined).ok).toBe(false)
    expect(validateManifest('not-an-object').ok).toBe(false)
    expect(validateManifest(42).ok).toBe(false)
  })

  it('rejects unsupported schema versions', () => {
    const r = validateManifest({ ...valid, schema_version: 99 })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('schema_version')
  })

  it('rejects missing or non-string content_type', () => {
    expect(validateManifest({ ...valid, content_type: undefined }).ok).toBe(false)
    expect(validateManifest({ ...valid, content_type: 42 }).ok).toBe(false)
    expect(validateManifest({ ...valid, content_type: '' }).ok).toBe(false)
  })

  it('rejects missing or non-string pack_id', () => {
    expect(validateManifest({ ...valid, pack_id: undefined }).ok).toBe(false)
    expect(validateManifest({ ...valid, pack_id: 42 }).ok).toBe(false)
    expect(validateManifest({ ...valid, pack_id: '' }).ok).toBe(false)
  })

  it('passes through extra fields untouched (handlers consume them)', () => {
    const m = { ...valid, covers: { item_icons: { no_dye: [13688] } } }
    const r = validateManifest(m)
    expect(r.ok).toBe(true)
    expect(r.manifest.covers.item_icons.no_dye).toEqual([13688])
  })
})
