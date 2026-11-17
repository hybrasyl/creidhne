import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  symlinkSync,
  utimesSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  applySettingsRoots,
  authorizePath,
  bless,
  grantTaliesin,
  approvedTaliesin,
  reconcileSettingsSave,
  _resetRootsForTests
} from '../handlerContext.js'
import { loadOrMigrateGrants, GRANTS_FILENAME } from '../grants.js'
import { isFilesystemRoot, assertRealInside } from '../pathSafety.js'
import { archiveFile, unarchiveFiles } from '../fsHandlers.js'
import { transferFiles } from '../staging.js'
import { applyRename } from '../entityRefRepair.js'

// The authority model on a real filesystem (HTOO-679, HTOO-681): real
// directories, real junctions on Windows and real symlinks elsewhere, and the
// real grant file. Every IPC handler that takes a path calls `authorizePath`
// (index.js `validatePath`), so a refusal here is a refusal at the boundary.
// e2e/settings-authority.spec.js drives the same rules through the built app.

let base
let world
let library
let outside
let settingsDir

// A directory link that a cloned or unpacked world could carry. Windows makes
// a junction, which needs no privilege; elsewhere a symlink.
function linkDir(target, at) {
  symlinkSync(target, at, process.platform === 'win32' ? 'junction' : 'dir')
}

beforeEach(async () => {
  base = mkdtempSync(join(tmpdir(), 'creidhne-authority-'))
  world = join(base, 'world')
  library = join(world, 'xml')
  mkdirSync(join(library, 'items'), { recursive: true })
  writeFileSync(join(library, 'items', 'Lorica.xml'), '<Item><Name>Lorica</Name></Item>')
  outside = join(base, 'outside')
  mkdirSync(outside)
  writeFileSync(join(outside, 'passwd'), 'OUTSIDE')
  settingsDir = join(base, 'settings')
  mkdirSync(settingsDir)
  const grants = await loadOrMigrateGrants(settingsDir, { libraries: [library] })
  _resetRootsForTests({ grants, settingsDir })
  applySettingsRoots({ libraries: [library] })
})

afterEach(() => {
  _resetRootsForTests()
  rmSync(base, { recursive: true, force: true })
})

describe('a forged settings save (HTOO-679)', () => {
  it('cannot make an outside path readable or writable', async () => {
    const saved = await reconcileSettingsSave({
      libraries: [library, join(outside, 'xml'), '/'],
      clientPath: outside,
      brigidAssetsPath: outside,
      taliesinPath: null
    })
    applySettingsRoots(saved)
    expect(() => authorizePath(join(outside, 'passwd'))).toThrow(/not inside any allowed root/)
    expect(() => authorizePath(join(outside, 'new.xml'))).toThrow(/not inside any allowed root/)
    // The legitimate library still works.
    expect(authorizePath(join(library, 'items', 'Lorica.xml'))).toBe(
      join(library, 'items', 'Lorica.xml')
    )
    const onDisk = JSON.parse(readFileSync(join(settingsDir, GRANTS_FILENAME), 'utf-8'))
    expect(onDisk.dirs).toEqual([library])
  })

  it('cannot approve a program, and a chosen program that changed does not run', async () => {
    const exe = join(outside, 'taliesin.exe')
    writeFileSync(exe, 'MZ-original')
    // A forged save names a program: nothing is approved.
    const forged = await reconcileSettingsSave({ libraries: [library], taliesinPath: exe })
    expect(forged.taliesinPath).toBeNull()
    expect(await approvedTaliesin()).toBeNull()
    // The dialog pick approves it, and it runs while it is unchanged.
    await grantTaliesin(exe)
    expect(await approvedTaliesin()).toBe(exe)
    // Replaced on disk: it no longer runs.
    writeFileSync(exe, 'MZ-replaced-by-something-else')
    utimesSync(exe, new Date(), new Date(Date.now() + 5000))
    await expect(approvedTaliesin()).rejects.toThrow(/changed after you chose it/)
  })

  it('refuses the approved program and the settings folder as file targets', async () => {
    // A dialog blessed the base folder, which holds both.
    const exe = join(outside, 'taliesin.exe')
    writeFileSync(exe, 'MZ')
    await grantTaliesin(exe)
    bless(base)
    expect(() => authorizePath(exe)).toThrow(/a program Creidhne runs/)
    expect(() => authorizePath(join(settingsDir, GRANTS_FILENAME))).toThrow(/own settings folder/)
    expect(authorizePath(join(outside, 'passwd'))).toBe(join(outside, 'passwd'))
  })
})

describe('the one-time migration', () => {
  it('grants what settings.json names once, then reads grants.json', async () => {
    const dir = join(base, 'fresh')
    const first = await loadOrMigrateGrants(dir, { libraries: [library], clientPath: outside })
    expect([...first.dirs].sort()).toEqual([library, outside].sort())
    // The second start reads the file, not settings.json.
    const second = await loadOrMigrateGrants(dir, { libraries: [join(base, 'other')] })
    expect([...second.dirs].sort()).toEqual([library, outside].sort())
  })

  it('grants no filesystem root', async () => {
    const g = await loadOrMigrateGrants(join(base, 'fresh2'), { libraries: ['/', library] })
    expect([...g.dirs]).toEqual([library])
  })

  it('fails closed on a damaged grants.json', async () => {
    const dir = join(base, 'damaged')
    mkdirSync(dir)
    writeFileSync(join(dir, GRANTS_FILENAME), '{ not json')
    const g = await loadOrMigrateGrants(dir, { libraries: [library] })
    expect(g.dirs.size).toBe(0)
  })
})

describe('links below a root (HTOO-681)', () => {
  beforeEach(() => {
    linkDir(outside, join(library, 'link'))
  })

  it('refuses a read through a link', () => {
    expect(existsSync(join(library, 'link', 'passwd'))).toBe(true)
    expect(() => authorizePath(join(library, 'link', 'passwd'))).toThrow(/through a link/)
  })

  it('refuses a new file through a link before any write', () => {
    expect(() => authorizePath(join(library, 'link', 'new', 'x.xml'))).toThrow(/through a link/)
    expect(existsSync(join(outside, 'new'))).toBe(false)
  })

  it('refuses a move or trash target through a link', () => {
    expect(() => authorizePath(join(library, 'link'))).toThrow(/through a link/)
  })

  it('assertRealInside refuses a name joined through a link', () => {
    expect(() => assertRealInside(library, 'link/passwd')).toThrow(/through a link/)
    expect(assertRealInside(library, 'items/Lorica.xml')).toBe(join(library, 'items', 'Lorica.xml'))
  })

  it('lets a link from one root into another root pass', () => {
    bless(outside)
    expect(authorizePath(join(library, 'link', 'passwd'))).toBe(join(library, 'link', 'passwd'))
  })

  it('lets a root that is itself a link pass, because the user chose it', () => {
    const linkedRoot = join(base, 'linked-root')
    linkDir(outside, linkedRoot)
    bless(linkedRoot)
    expect(authorizePath(join(linkedRoot, 'passwd'))).toBe(join(linkedRoot, 'passwd'))
  })

  it('archive refuses a mirrored subfolder that is a link', async () => {
    // items/link → outside; archiving items/link/x.xml mirrors into .ignore/link.
    const archiveDir = join(library, 'items', '.ignore')
    mkdirSync(archiveDir)
    linkDir(outside, join(archiveDir, 'sub'))
    mkdirSync(join(library, 'items', 'sub'))
    const src = join(library, 'items', 'sub', 'x.xml')
    writeFileSync(src, '<Item/>')
    await expect(archiveFile(src, archiveDir, authorizePath)).rejects.toThrow(/through a link/)
    expect(existsSync(src)).toBe(true)
    expect(existsSync(join(outside, 'x.xml'))).toBe(false)
  })

  it('unarchive and staging moves refuse a destination through a link', async () => {
    const src = join(library, 'items', 'Lorica.xml')
    const un = await unarchiveFiles([src], join(library, 'link'), authorizePath)
    expect(un.ok).toEqual([])
    const st = await transferFiles(
      [src],
      join(library, 'items'),
      join(library, 'link'),
      authorizePath
    )
    expect(st.ok).toEqual([])
    expect(existsSync(src)).toBe(true)
    expect(existsSync(join(outside, 'Lorica.xml'))).toBe(false)
  })

  it('a rename repair does not write through a link', async () => {
    // An npc in a linked folder names the item; the repair must not rewrite it.
    mkdirSync(join(outside, 'npcs'))
    writeFileSync(
      join(outside, 'npcs', 'Vendor.xml'),
      '<Npc><Name>Vendor</Name><Roles><Vendor><Items><Item Name="Lorica"/></Items></Vendor></Roles></Npc>'
    )
    linkDir(join(outside, 'npcs'), join(library, 'npcs'))
    const before = readFileSync(join(outside, 'npcs', 'Vendor.xml'), 'utf-8')
    const r = await applyRename(library, 'items', 'Lorica', 'Lorica2', authorizePath)
    expect(readFileSync(join(outside, 'npcs', 'Vendor.xml'), 'utf-8')).toBe(before)
    expect(r.changed).toEqual([])
  })
})

describe('isFilesystemRoot', () => {
  it('names the roots of each platform', () => {
    expect(isFilesystemRoot('/')).toBe(true)
    expect(isFilesystemRoot('/data')).toBe(false)
    if (process.platform === 'win32') {
      expect(isFilesystemRoot('C:\\')).toBe(true)
      expect(isFilesystemRoot('C:/')).toBe(true)
      expect(isFilesystemRoot('\\\\server\\share\\')).toBe(true)
      expect(isFilesystemRoot('C:\\world')).toBe(false)
    }
    expect(isFilesystemRoot('')).toBe(false)
    expect(isFilesystemRoot(null)).toBe(false)
  })
})
