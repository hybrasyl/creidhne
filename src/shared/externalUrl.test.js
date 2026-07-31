import { describe, it, expect } from 'vitest'
import { isSafeExternalUrl } from './externalUrl.js'

describe('isSafeExternalUrl', () => {
  it('allows http, https and mailto', () => {
    expect(isSafeExternalUrl('http://example.com')).toBe(true)
    expect(isSafeExternalUrl('https://github.com/hybrasyl/creidhne/issues')).toBe(true)
    expect(isSafeExternalUrl('mailto:someone@example.com')).toBe(true)
  })

  it('refuses OS-reachable and script schemes', () => {
    expect(isSafeExternalUrl('file:///C:/Windows/System32/calc.exe')).toBe(false)
    expect(isSafeExternalUrl('smb://server/share')).toBe(false)
    expect(isSafeExternalUrl('ms-msdt:/id')).toBe(false)
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('refuses malformed / non-URL input rather than repairing it', () => {
    expect(isSafeExternalUrl('not a url')).toBe(false)
    expect(isSafeExternalUrl('/relative/path')).toBe(false)
    expect(isSafeExternalUrl('')).toBe(false)
    expect(isSafeExternalUrl(null)).toBe(false)
    expect(isSafeExternalUrl(undefined)).toBe(false)
    expect(isSafeExternalUrl(42)).toBe(false)
  })

  it('matches the scheme case-insensitively (URL normalizes it)', () => {
    expect(isSafeExternalUrl('HTTPS://example.com')).toBe(true)
    expect(isSafeExternalUrl('MailTo:x@y.com')).toBe(true)
  })
})
