import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { nodeProbe, launcherDir, setPortableLauncherDir } from '../companion.js'

// The portable stub's variables (HTOO-667). Main reads them, keeps this app's
// own launcher folder, and removes them before any other statement reads
// process.env, so no child inherits them. Read from the source, because the
// order is the whole fix and a running test cannot see module-load order.

const MAIN = readFileSync(join(__dirname, '..', 'index.js'), 'utf-8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')

describe('portable launch variables (HTOO-667)', () => {
  it('are read and removed before any other statement reads process.env', () => {
    const save = MAIN.search(
      /^setPortableLauncherDir\(ownPortableLauncherDir\(process\.env, PACKAGE_NAME\)\)/m
    )
    const take = MAIN.search(
      /^const isOwnPortable = takePortableLaunch\(process\.env, PACKAGE_NAME\)/m
    )
    // Guard the guard: both statements are there.
    expect(save).toBeGreaterThan(-1)
    expect(take).toBeGreaterThan(save)
    // Every read of process.env up to the end of the take line is one of the
    // two statements: one on each line, and none before them.
    const takeLineEnd = MAIN.indexOf('\n', take)
    const reads = [...MAIN.slice(0, takeLineEnd).matchAll(/process\.env/g)].map((m) => m.index)
    expect(reads).toHaveLength(2)
    expect(reads[0]).toBeGreaterThan(save)
    expect(reads[1]).toBeGreaterThan(take)
    expect(take).toBeLessThan(MAIN.indexOf("app.setPath('userData'"))
  })

  it('leaves no other reader of the stub variables in main', () => {
    expect(MAIN).not.toMatch(/process\.env\[?['".]?PORTABLE_EXECUTABLE/)
    expect(MAIN).toMatch(/isPortable: app\.isPackaged && isOwnPortable/)
  })
})

describe('the companion search after the variables are gone', () => {
  afterEach(() => setPortableLauncherDir(null))

  it("looks beside this app's own portable exe on Windows", () => {
    setPortableLauncherDir('D:\\tools')
    const probe = { ...nodeProbe(), platform: 'win32' }
    expect(launcherDir(probe)).toBe('D:\\tools')
  })

  it('falls back to the executable folder when no own folder was saved', () => {
    const probe = { ...nodeProbe(), platform: 'win32', execPath: 'C:\\app\\creidhne.exe' }
    probe.env = { ...probe.env }
    delete probe.env.PORTABLE_EXECUTABLE_DIR
    expect(launcherDir(probe)).toBe('C:\\app')
  })
})
