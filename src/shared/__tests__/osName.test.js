import { describe, it, expect } from 'vitest'
import { simplifyPlatform } from '../osName.js'

describe('simplifyPlatform', () => {
  it('maps win32 to windows', () => {
    expect(simplifyPlatform('win32')).toBe('windows')
  })
  it('maps darwin to macOS', () => {
    expect(simplifyPlatform('darwin')).toBe('macOS')
  })
  it('maps linux to linux', () => {
    expect(simplifyPlatform('linux')).toBe('linux')
  })
  it('maps anything else to other', () => {
    expect(simplifyPlatform('freebsd')).toBe('other')
    expect(simplifyPlatform(undefined)).toBe('other')
  })
})
