import { describe, it, expect } from 'vitest'
import { scrubText, escapeRegExp } from '../scrub.js'

describe('scrubText', () => {
  it('redacts a Windows user path but keeps the drive + Users prefix (short paths)', () => {
    // 2 components after the drive — not deep enough to fully collapse.
    expect(scrubText('C:\\Users\\alice')).toBe('C:\\Users\\<user>')
  })

  it('collapses a deep Windows user path to its basename', () => {
    expect(scrubText('C:\\Users\\alice\\world\\items\\Foo.xml')).toBe('…\\Foo.xml')
  })

  it('collapses a deep Windows world path with no username', () => {
    expect(scrubText('E:\\Dark Ages Dev\\Repos\\world\\items\\Foo.xml')).toBe('…\\Foo.xml')
  })

  it('redacts a macOS /Users home account name', () => {
    expect(scrubText('/Users/alice')).toBe('/Users/<user>')
  })

  it('redacts a linux /home account name', () => {
    expect(scrubText('/home/alice')).toBe('/home/<user>')
  })

  it('collapses a deep POSIX path to its basename', () => {
    expect(scrubText('/home/alice/hybrasyl/world/Foo.xml')).toBe('…/Foo.xml')
  })

  it('redacts an explicit non-standard home dir', () => {
    const scrubbed = scrubText('opened D:\\myhome\\settings.json', { homeDir: 'D:\\myhome' })
    expect(scrubbed).toContain('<HOME>')
    expect(scrubbed).not.toContain('myhome')
  })

  it('redacts emails', () => {
    expect(scrubText('contact tacolejr@gmail.com now')).toBe('contact <email> now')
  })

  it('redacts IPv4 addresses', () => {
    expect(scrubText('server 192.168.1.42 down')).toBe('server <ip> down')
  })

  it('redacts a bare username token of 3+ chars', () => {
    expect(scrubText('user alice logged in', { userName: 'alice' })).toBe('user <user> logged in')
  })

  it('does NOT over-scrub a short username substring', () => {
    // userName "al" is below the 3-char floor, so "also" is untouched.
    expect(scrubText('also alfalfa', { userName: 'al' })).toBe('also alfalfa')
  })

  it('does not touch a bare username substring inside a larger word', () => {
    // Word-boundary anchored — "malice" must not become "m<user>".
    expect(scrubText('malicious', { userName: 'ali' })).toBe('malicious')
  })

  it('leaves already-clean text unchanged', () => {
    const clean = 'TypeError: Cannot read properties of undefined'
    expect(scrubText(clean)).toBe(clean)
  })

  it('does not mangle a github URL into a path collapse', () => {
    const url = 'https://github.com/hybrasyl/cernunnos'
    expect(scrubText(url)).toBe(url)
  })

  it('returns non-string input unchanged', () => {
    expect(scrubText(null)).toBe(null)
    expect(scrubText('')).toBe('')
  })
})

describe('escapeRegExp', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegExp('a.b*c')).toBe('a\\.b\\*c')
  })
})
