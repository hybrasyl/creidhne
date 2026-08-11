import { describe, it, expect } from 'vitest'
import {
  extractComment,
  extractLocation,
  extractMeta,
  injectComment,
  injectMeta,
  injectNameAnnotations
} from '../xmlCommentUtils.js'

const ROOT = '<Thing xmlns="urn:x">\n  <Name>thing</Name>\n</Thing>'

describe('extractComment / injectComment', () => {
  it('reads a Comment annotation', () => {
    expect(extractComment('<!-- Comment: hello -->')).toBe('hello')
  })

  it('returns empty string when absent', () => {
    expect(extractComment(ROOT)).toBe('')
  })

  it('injects after the root tag', () => {
    const out = injectComment(ROOT, 'hi', 'Thing')
    expect(out).toContain('<!-- Comment: hi -->')
    expect(out.indexOf('<!-- Comment:')).toBeLessThan(out.indexOf('<Name>'))
  })

  it('is a no-op for an empty comment', () => {
    expect(injectComment(ROOT, '', 'Thing')).toBe(ROOT)
  })
})

describe('extractLocation', () => {
  it('reads a Location annotation', () => {
    expect(extractLocation('<!-- Location: Mileth Inn -->')).toBe('Mileth Inn')
  })

  it('trims surrounding whitespace', () => {
    expect(extractLocation('<!--   Location:    Rucesion Bank   -->')).toBe('Rucesion Bank')
  })

  it('returns empty string when absent', () => {
    expect(extractLocation(ROOT)).toBe('')
  })

  it('does not confuse a Comment annotation for a Location one', () => {
    expect(extractLocation('<!-- Comment: not a location -->')).toBe('')
  })
})

describe('injectNameAnnotations', () => {
  it('writes Location then Comment, both after </Name>', () => {
    const out = injectNameAnnotations(ROOT, 'Somewhere', 'A note')
    expect(out.indexOf('</Name>')).toBeLessThan(out.indexOf('<!-- Location:'))
    expect(out.indexOf('<!-- Location:')).toBeLessThan(out.indexOf('<!-- Comment:'))
  })

  it('writes only Location when there is no comment', () => {
    const out = injectNameAnnotations(ROOT, 'Somewhere', '')
    expect(out).toContain('<!-- Location: Somewhere -->')
    expect(out).not.toContain('<!-- Comment:')
  })

  it('writes only Comment when there is no location', () => {
    const out = injectNameAnnotations(ROOT, '', 'A note')
    expect(out).toContain('<!-- Comment: A note -->')
    expect(out).not.toContain('<!-- Location:')
  })

  it('is a no-op when both are empty', () => {
    expect(injectNameAnnotations(ROOT, '', '')).toBe(ROOT)
  })
})

describe('extractMeta', () => {
  it('merges the annotation over the supplied defaults', () => {
    const out = extractMeta('<!-- creidhne:meta {"job":"smith"} -->', { job: '', location: '' })
    expect(out).toEqual({ job: 'smith', location: '' })
  })

  it('returns the defaults untouched when the annotation is absent', () => {
    expect(extractMeta(ROOT, { job: '', location: '' })).toEqual({ job: '', location: '' })
  })

  it('returns the defaults when the JSON is malformed', () => {
    expect(extractMeta('<!-- creidhne:meta {not json} -->', { job: 'x' })).toEqual({ job: 'x' })
  })

  it('keeps keys that are not in the defaults', () => {
    // Extraction was already key-agnostic — the parsed object is spread OVER the
    // defaults, not filtered by them. This pins that, because it is the half of
    // the round trip that was never broken and could regress silently.
    const out = extractMeta('<!-- creidhne:meta {"family":"wolf"} -->', {})
    expect(out).toEqual({ family: 'wolf' })
  })
})

describe('injectMeta is key-agnostic (HTOO-129)', () => {
  it('writes a key the module has never heard of', () => {
    // The bug: this tested a hardcoded seven-field chain of castable keys, so
    // any other domain's meta was dropped with no throw and no warning.
    const out = injectMeta(ROOT, { family: 'wolf' }, 'Thing')
    expect(out).toContain('<!-- creidhne:meta {"family":"wolf"} -->')
  })

  it('writes several unknown keys together', () => {
    const out = injectMeta(ROOT, { job: 'smith', weapon: 'hammer' }, 'Thing')
    expect(out).toContain('"job":"smith"')
    expect(out).toContain('"weapon":"hammer"')
  })

  it('still recognises the castable keys it used to hardcode', () => {
    expect(injectMeta(ROOT, { isTest: true }, 'Thing')).toContain('"isTest":true')
    expect(injectMeta(ROOT, { specialty: 'magic' }, 'Thing')).toContain('"specialty":"magic"')
  })

  it('omits falsy values rather than recording a default', () => {
    const out = injectMeta(ROOT, { isTest: false, specialty: 'magic', job: '' }, 'Thing')
    expect(out).toContain('<!-- creidhne:meta {"specialty":"magic"} -->')
  })

  it('is a no-op when every value is falsy', () => {
    expect(injectMeta(ROOT, { job: '', isTest: false }, 'Thing')).toBe(ROOT)
  })

  it('is a no-op for an empty object, null and undefined', () => {
    expect(injectMeta(ROOT, {}, 'Thing')).toBe(ROOT)
    expect(injectMeta(ROOT, null, 'Thing')).toBe(ROOT)
    expect(injectMeta(ROOT, undefined, 'Thing')).toBe(ROOT)
  })

  it('injects after the root tag', () => {
    const out = injectMeta(ROOT, { job: 'smith' }, 'Thing')
    expect(out.indexOf('creidhne:meta')).toBeLessThan(out.indexOf('<Name>'))
  })

  it('round-trips through extractMeta', () => {
    const meta = { family: 'wolf', weapon: 'claw' }
    const xml = injectMeta(ROOT, meta, 'Thing')
    expect(extractMeta(xml, { family: '', weapon: '' })).toEqual(meta)
  })
})
