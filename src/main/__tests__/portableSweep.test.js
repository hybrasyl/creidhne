import { existsSync, promises } from 'fs'
import { mkdir, mkdtemp, readdir, rm, symlink, utimes, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MIN_AGE_MS, ownUnpackDir, sweepPortableLeftovers } from '../portableSweep.js'

/**
 * The portable sweep (HTOO-494), over a fake `%TEMP%`.
 *
 * Each folder here has the layout that the NSIS stub makes:
 * `nsXXXX.tmp\app\creidhne.exe` with `app\resources\app.asar`, next to the
 * package. The rules under test are a safety case, so most of these tests say
 * what the sweep must NOT delete.
 */

const NOW = Date.UTC(2026, 8, 28, 12, 0, 0)
const OLD = NOW - MIN_AGE_MS - 60_000
const EXE = 'creidhne.exe'

let temp

async function unpack(name, options = {}) {
  const dir = join(temp, name)
  await mkdir(join(dir, 'app', 'resources'), { recursive: true })
  await writeFile(join(dir, 'app', options.exe ?? EXE), 'exe')
  if (options.asar !== false) await writeFile(join(dir, 'app', 'resources', 'app.asar'), 'asar')
  await writeFile(join(dir, 'app-64.7z'), 'package')
  const stamp = new Date(options.mtime ?? OLD)
  await utimes(dir, stamp, stamp)
  return dir
}

function run(extra = {}) {
  return sweepPortableLeftovers({
    execPath: join(temp, 'nsOWN1.tmp', 'app', EXE),
    isPortable: true,
    now: NOW,
    ...extra
  })
}

beforeEach(async () => {
  temp = await mkdtemp(join(tmpdir(), 'creidhne-sweep-'))
  // The folder of this process. It is old enough to remove if it were not ours.
  await unpack('nsOWN1.tmp')
})

afterEach(async () => {
  await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
})

describe('ownUnpackDir', () => {
  it('finds the ns*.tmp folder above app\\creidhne.exe', () => {
    expect(ownUnpackDir(join('C:', 'T', 'nsm78D5.tmp', 'app', EXE))).toBe(
      join('C:', 'T', 'nsm78D5.tmp')
    )
    // The number of hex digits changes, so the pattern must not fix it.
    expect(ownUnpackDir(join('C:', 'T', 'nskBBD.tmp', 'app', EXE))).toBe(
      join('C:', 'T', 'nskBBD.tmp')
    )
  })

  it('returns null for each other layout, so the sweep does nothing', () => {
    // An installed copy and a dev run. Neither is under the folder of a stub.
    expect(ownUnpackDir(join('C:', 'Program Files', 'Creidhne', EXE))).toBeNull()
    expect(
      ownUnpackDir(join('E:', 'creidhne', 'node_modules', 'electron', 'dist', 'electron.exe'))
    ).toBeNull()
  })
})

describe('sweepPortableLeftovers', () => {
  it('removes an old leftover of this app', async () => {
    const leak = await unpack('nsA1B2.tmp')
    const result = await run()
    expect(result.removed).toEqual([leak])
    expect(existsSync(leak)).toBe(false)
  })

  it('never touches its own folder, also when it is old', async () => {
    await run()
    expect(existsSync(join(temp, 'nsOWN1.tmp', 'app', EXE))).toBe(true)
  })

  it('does nothing when the stub did not start this process', async () => {
    const leak = await unpack('nsA1B2.tmp')
    const result = await run({ isPortable: false })
    expect(result.removed).toEqual([])
    expect(existsSync(leak)).toBe(true)
  })

  it('does nothing when it cannot identify its own folder', async () => {
    // It cannot prove that it does not delete itself, so it stops.
    const leak = await unpack('nsA1B2.tmp')
    const result = await run({ execPath: join(temp, 'Creidhne', EXE) })
    expect(result.removed).toEqual([])
    expect(existsSync(leak)).toBe(true)
  })

  it('keeps a recent folder, because a second launch can still unpack into it', async () => {
    const fresh = await unpack('nsA1B2.tmp', { mtime: NOW - 60_000 })
    const result = await run()
    expect(result.skipped).toEqual([fresh])
    expect(existsSync(fresh)).toBe(true)
  })

  it('keeps a folder whose rename is refused, because that means it is in use', async () => {
    // Windows refuses the rename while the exe of a running copy is mapped
    // (EBUSY) or the stub holds the folder (EPERM). Measured on the real exe.
    const live = await unpack('nsA1B2.tmp')
    const result = await run({
      fs: {
        ...promises,
        rename: async () => {
          throw Object.assign(new Error('busy'), { code: 'EBUSY' })
        }
      }
    })
    expect(result.skipped).toEqual([live])
    expect(result.removed).toEqual([])
    expect(existsSync(join(live, 'app', EXE))).toBe(true)
  })

  it('never touches a path that ends in app.asar', async () => {
    // Electron's patched fs opens each `app.asar` that it is asked about and
    // keeps the handle. Windows then refuses the rename, because this process
    // holds the file. Oghma's first packaged build skipped each real leftover
    // for that reason, and its tests passed under plain Node. This fs fails the
    // way Electron's fs does, so a check that stats or opens the archive fails.
    const leak = await unpack('nsA1B2.tmp')
    const asarTouched = []
    const guard =
      (fn) =>
      (...args) => {
        const path = String(args[0])
        if (/app\.asar$/i.test(path)) {
          asarTouched.push(path)
          throw new Error('opened as an archive')
        }
        return fn(...args)
      }
    const result = await run({
      fs: {
        readdir: guard(promises.readdir),
        lstat: guard(promises.lstat),
        rename: guard(promises.rename),
        rm: promises.rm
      }
    })
    expect(asarTouched).toEqual([])
    expect(result.removed).toEqual([leak])
  })

  it('leaves the unpack folder of another app alone', async () => {
    const other = await unpack('nsC3D4.tmp', { exe: 'taliesin.exe' })
    await run()
    expect(existsSync(other)).toBe(true)
  })

  it('leaves a folder with our exe name and no app.asar alone', async () => {
    const notOurs = await unpack('nsC3D4.tmp', { asar: false })
    await run()
    expect(existsSync(notOurs)).toBe(true)
  })

  it('leaves folders that do not have the NSIS name alone', async () => {
    const named = await unpack('creidhne-backup')
    const other = await unpack('2Xk9cQ1pZ7yLmN4vB8dR3sT6wHf')
    await run()
    expect(existsSync(named)).toBe(true)
    expect(existsSync(other)).toBe(true)
  })

  it('does not follow a link that has the NSIS name', async () => {
    const target = await unpack('real-target')
    await symlink(target, join(temp, 'nsLINK.tmp'), 'junction')
    await run()
    expect(existsSync(join(target, 'app', EXE))).toBe(true)
  })

  it('completes a sweep that stopped after its rename', async () => {
    await unpack('nsE5F6.tmp.creidhne-sweep')
    const result = await run()
    expect(result.removed).toEqual([join(temp, 'nsE5F6.tmp.creidhne-sweep')])
    expect((await readdir(temp)).sort()).toEqual(['nsOWN1.tmp'])
  })

  it('reports a failure and does not throw', async () => {
    const errors = []
    const missing = join(temp, 'no-such-temp')
    const result = await run({
      execPath: join(missing, 'nsOWN1.tmp', 'app', EXE),
      onError: (message) => errors.push(message)
    })
    expect(result).toEqual({ removed: [], skipped: [] })
    expect(errors[0]).toMatch(/cannot read/)
  })
})
