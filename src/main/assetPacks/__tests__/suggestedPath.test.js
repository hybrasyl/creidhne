import { describe, it, expect } from 'vitest'
import { join } from 'path'
import { suggestedBrigidAssetsPath } from '../index.js'

// Brigid's assets folder, platform by platform (HTOO-585, the tests ported
// from Taliesin). Expectations use `join`, as the code does, so the suite
// gives the same answer on any OS.
describe('suggestedBrigidAssetsPath', () => {
  const home = join('/home', 'a')

  it('Windows: %LOCALAPPDATA%\\Erisco\\Brigid\\assets', () => {
    const local = join('C:', 'Users', 'a', 'AppData', 'Local')
    expect(suggestedBrigidAssetsPath('win32', { LOCALAPPDATA: local }, home)).toBe(
      join(local, 'Erisco', 'Brigid', 'assets')
    )
  })

  it("Windows without LOCALAPPDATA: the home folder's AppData\\Local", () => {
    expect(suggestedBrigidAssetsPath('win32', {}, home)).toBe(
      join(home, 'AppData', 'Local', 'Erisco', 'Brigid', 'assets')
    )
  })

  it('Linux: ~/.config/Erisco/Brigid/assets', () => {
    expect(suggestedBrigidAssetsPath('linux', {}, home)).toBe(
      join(home, '.config', 'Erisco', 'Brigid', 'assets')
    )
  })

  it('macOS: ~/Library/Application Support/Erisco/Brigid/assets', () => {
    expect(suggestedBrigidAssetsPath('darwin', {}, home)).toBe(
      join(home, 'Library', 'Application Support', 'Erisco', 'Brigid', 'assets')
    )
  })

  it('Linux: an absolute XDG_CONFIG_HOME wins, a relative one does not', () => {
    const xdg = join('/srv', 'cfg')
    expect(suggestedBrigidAssetsPath('linux', { XDG_CONFIG_HOME: xdg }, home)).toBe(
      join(xdg, 'Erisco', 'Brigid', 'assets')
    )
    expect(suggestedBrigidAssetsPath('linux', { XDG_CONFIG_HOME: 'cfg' }, home)).toBe(
      join(home, '.config', 'Erisco', 'Brigid', 'assets')
    )
  })

  it('macOS: XDG_CONFIG_HOME does not move the folder', () => {
    const xdg = join('/srv', 'cfg')
    expect(suggestedBrigidAssetsPath('darwin', { XDG_CONFIG_HOME: xdg }, home)).toBe(
      join(home, 'Library', 'Application Support', 'Erisco', 'Brigid', 'assets')
    )
  })

  it('null only when there is no base', () => {
    expect(suggestedBrigidAssetsPath('win32', {}, '')).toBeNull()
    expect(suggestedBrigidAssetsPath('linux', {}, '')).toBeNull()
  })
})
