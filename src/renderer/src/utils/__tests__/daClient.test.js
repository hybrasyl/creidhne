import { describe, it, expect } from 'vitest'
import { joinPath } from '../daClient.js'

// joinPath normalizes relative separators to the clientPath's style so both
// Windows-native ("C:\Dark Ages") and Unix-style ("/c/Dark Ages") paths work
// for callers on any platform.
describe('joinPath', () => {
  it('uses backslash when clientPath contains backslashes', () => {
    expect(joinPath('C:\\Dark Ages', 'legend.dat')).toBe('C:\\Dark Ages\\legend.dat')
  })

  it('uses forward slash when clientPath does not contain backslashes', () => {
    expect(joinPath('/c/Dark Ages', 'legend.dat')).toBe('/c/Dark Ages/legend.dat')
  })

  it('normalizes mixed separators in the relative path to the client style', () => {
    expect(joinPath('C:\\Dark Ages', 'npc/npcbase.dat')).toBe('C:\\Dark Ages\\npc\\npcbase.dat')
    expect(joinPath('/c/Dark Ages', 'npc\\npcbase.dat')).toBe('/c/Dark Ages/npc/npcbase.dat')
  })

  it('collapses duplicate separators in the relative path', () => {
    expect(joinPath('/dir', 'a//b\\\\c')).toBe('/dir/a/b/c')
  })

  it('strips a trailing separator from clientPath before joining', () => {
    expect(joinPath('C:\\Dark Ages\\', 'legend.dat')).toBe('C:\\Dark Ages\\legend.dat')
    expect(joinPath('/dir/', 'x.dat')).toBe('/dir/x.dat')
  })
})
