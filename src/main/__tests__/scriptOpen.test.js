import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readdirSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { spawn as spawnChild } from 'child_process'
import { join } from 'path'
import { resolveVsCode, vsCodeArgs, openWorldScript } from '../scriptOpen.js'

// Opening a world script runs no command interpreter (HTOO-680). The file name
// is world text, so a name such as `x & echo PWNED > marker` must reach VS Code
// as one literal argument and run nothing else.

let dir
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'creidhne-scriptopen-'))
})
afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

// File names a shell would act on, on each platform.
const HOSTILE_NAMES =
  process.platform === 'win32'
    ? // `>` and `|` cannot be in a Windows file name; `&` and `%` can.
      ['a & mkdir marker-amp', 'b && mkdir marker-and', 'c %COMSPEC% & mkdir marker-var']
    : [
        'a$(echo PWNED > marker-sub.txt)',
        'b; echo PWNED > marker-semi.txt',
        'c `touch marker-tick.txt`'
      ]

describe('resolveVsCode', () => {
  it('finds Code.exe beside the bin folder that holds code.cmd on Windows', () => {
    const bin = join('C:', 'VSCode', 'bin')
    const exe = join('C:', 'VSCode', 'Code.exe')
    const present = new Set([join(bin, 'code.cmd'), exe])
    expect(
      resolveVsCode({
        platform: 'win32',
        env: { PATH: `C:\\Windows;${bin}` },
        exists: (p) => present.has(p)
      })
    ).toBe(exe)
  })

  it('finds `code` on PATH on macOS and Linux', () => {
    const present = new Set([join('/usr/local/bin', 'code')])
    expect(
      resolveVsCode({
        platform: 'linux',
        env: { PATH: '/usr/bin:/usr/local/bin' },
        exists: (p) => present.has(p)
      })
    ).toBe(join('/usr/local/bin', 'code'))
  })

  it('finds nothing when VS Code is not installed', () => {
    expect(resolveVsCode({ platform: 'win32', env: { PATH: 'C:\\x' }, exists: () => false })).toBe(
      null
    )
  })
})

describe('openWorldScript', () => {
  it('starts VS Code with an argument array and no shell', async () => {
    const calls = []
    const spawn = (file, args, opts) => {
      calls.push({ file, args, opts })
      return { on() {}, unref() {} }
    }
    const scriptPath = join(dir, 'scripts', 'a$(touch x) & y.lua')
    const r = await openWorldScript({
      scriptsDir: join(dir, 'scripts'),
      scriptPath,
      platform: 'linux',
      env: { PATH: '/bin', ELECTRON_RUN_AS_NODE: '1' },
      exists: (p) => p === join('/bin', 'code'),
      spawn,
      openPath: async () => ''
    })
    expect(r.ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].opts.shell).toBe(false)
    expect(calls[0].args).toEqual(vsCodeArgs(join(dir, 'scripts'), scriptPath))
    expect(calls[0].opts.env.ELECTRON_RUN_AS_NODE).toBeUndefined()
  })

  it('opens the file with the OS default program when VS Code is not found', async () => {
    const opened = []
    const r = await openWorldScript({
      scriptsDir: dir,
      scriptPath: join(dir, 'x.lua'),
      exists: () => false,
      spawn: () => {
        throw new Error('must not spawn')
      },
      openPath: async (p) => {
        opened.push(p)
        return ''
      }
    })
    expect(r).toEqual({ ok: true, path: join(dir, 'x.lua') })
    expect(opened).toEqual([join(dir, 'x.lua')])
  })

  it('runs no second command for a hostile file name, with a real process', async () => {
    // A real child: Node stands in for VS Code. It is given the same argument
    // array and exits on the unknown flag; a shell would have run the marker
    // command first.
    const work = join(dir, 'real')
    mkdirSync(join(work, 'scripts'), { recursive: true })
    for (const name of HOSTILE_NAMES) {
      const scriptPath = join(work, 'scripts', `${name}.lua`)
      writeFileSync(scriptPath, '-- script')
      const { child } = await openWorldScript({
        scriptsDir: join(work, 'scripts'),
        scriptPath,
        platform: 'linux',
        env: { PATH: work, Path: work },
        exists: () => true,
        spawn: (_file, args, opts) =>
          // `detached` and `stdio: 'ignore'` as the real call; cwd is the work dir.
          spawnChild(process.execPath, args, { ...opts, cwd: work }),
        openPath: async () => ''
      })
      await new Promise((resolve) => child.on('exit', resolve))
    }
    const markers = readdirSync(work).filter((f) => f.startsWith('marker'))
    expect(markers).toEqual([])
  })
})

describe('no command shell in main', () => {
  it('no main-process source passes shell: true', () => {
    const srcDir = join(__dirname, '..')
    const files = []
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.name === '__tests__' || e.name === 'node_modules') continue
        const p = join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.(c|m)?js$/.test(e.name)) files.push(p)
      }
    }
    walk(srcDir)
    // Guard the guard: the walk found the main sources.
    expect(files.length).toBeGreaterThan(20)
    expect(files.some((f) => f.endsWith('scriptOpen.js'))).toBe(true)
    const offenders = files.filter((f) => {
      const code = readFileSync(f, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      return /shell\s*:\s*true/.test(code)
    })
    expect(offenders).toEqual([])
  })
})

describe('the handler wiring', () => {
  it('script:open goes through openWorldScript', () => {
    const index = readFileSync(join(__dirname, '..', 'index.js'), 'utf-8')
    const start = index.indexOf("ipc.handle('script:open'")
    expect(start).toBeGreaterThan(0)
    const body = index.slice(start, index.indexOf('ipc.handle(', start + 10))
    expect(body).toContain('openWorldScript(')
    expect(body).not.toMatch(/spawn\(/)
  })
})
