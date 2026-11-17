import { test, expect } from '@playwright/test'
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, getMainWindow } from './helpers.js'

// The renderer writes settings.json, so a settings save must not give the
// renderer new filesystem or program authority (HTOO-679). Main keeps that
// record in grants.json, and only main writes it. This drives the real handlers
// in the built app through the bridge, as a compromised renderer would.

function makeWorld(root) {
  const xml = join(root, 'xml')
  mkdirSync(join(xml, 'items'), { recursive: true })
  writeFileSync(join(xml, 'items', 'Lorica.xml'), '<Item><Name>Lorica</Name></Item>')
  return xml
}

test.describe('Settings cannot mint authority', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('the first start grants the seeded paths, and a forged save grants nothing', async () => {
    const base = mkdtempSync(join(tmpdir(), 'creidhne-authority-'))
    const library = makeWorld(join(base, 'world'))
    const outside = join(base, 'outside')
    mkdirSync(outside, { recursive: true })
    const secret = join(outside, 'secret.txt')
    writeFileSync(secret, 'SECRET')
    const program = join(outside, 'not-taliesin.exe')
    writeFileSync(program, 'MZ')

    let localAppData
    ;({ electronApp, localAppData } = await launchApp({
      seedSettings: { libraries: [library], activeLibrary: library }
    }))
    const page = await getMainWindow(electronApp)

    // Migration: the seeded library is granted, and its files read.
    const grantsPath = join(localAppData, 'Erisco', 'Creidhne', 'grants.json')
    expect(existsSync(grantsPath)).toBe(true)
    expect(JSON.parse(readFileSync(grantsPath, 'utf-8')).dirs).toContain(library)
    const legit = await page.evaluate(
      (p) =>
        window.electronAPI.readFile(p).then(
          () => 'read',
          (e) => String(e)
        ),
      join(library, 'items', 'Lorica.xml')
    )
    expect(legit).toBe('read')

    // A forged save: an outside folder as a library and as the client folder,
    // a filesystem root, and a program path.
    const result = await page.evaluate(
      async ({ outside, secret, program }) => {
        const current = await window.electronAPI.loadSettings()
        await window.electronAPI.saveSettings({
          ...current,
          libraries: [...current.libraries, `${outside}/xml`, '/'],
          clientPath: outside,
          taliesinPath: program
        })
        const read = await window.electronAPI.readFile(secret).then(
          () => 'read',
          (e) => String(e)
        )
        const after = await window.electronAPI.loadSettings()
        const status = await window.electronAPI.companionStatus()
        return { read, taliesinPath: after.taliesinPath, status }
      },
      { outside, secret, program }
    )
    expect(result.read).toMatch(/not inside any allowed root/)
    expect(result.taliesinPath).toBeNull()
    expect(result.status?.resolved?.source).not.toBe('manual')

    const grants = JSON.parse(readFileSync(grantsPath, 'utf-8'))
    expect(grants.dirs).not.toContain(outside)
    expect(grants.dirs).not.toContain('/')
    expect(grants.executables?.taliesin).toBeUndefined()

    // The legitimate library still works after the forged save.
    const still = await page.evaluate(
      (p) =>
        window.electronAPI.readFile(p).then(
          () => 'read',
          (e) => String(e)
        ),
      join(library, 'items', 'Lorica.xml')
    )
    expect(still).toBe('read')
  })

  test('the settings folder is not reachable through a granted parent', async () => {
    // The world folder holds the settings folder, so its granted world parent
    // contains grants.json as a string. Main must still refuse it.
    const localAppData = mkdtempSync(join(tmpdir(), 'creidhne-authority-'))
    const library = makeWorld(localAppData)
    ;({ electronApp } = await launchApp({
      localAppData,
      seedSettings: { libraries: [library], activeLibrary: library }
    }))
    const page = await getMainWindow(electronApp)
    const grantsPath = join(localAppData, 'Erisco', 'Creidhne', 'grants.json')
    const before = readFileSync(grantsPath, 'utf-8')
    // A read and a trash: both handlers check the path before anything else.
    const result = await page.evaluate(async (p) => {
      const read = await window.electronAPI.readFile(p).then(
        () => 'read',
        (e) => String(e)
      )
      const trash = await window.electronAPI.trashFiles([p])
      return { read, trash }
    }, grantsPath)
    expect(result.read).toMatch(/own settings folder/)
    expect(result.trash.ok).toEqual([])
    expect(result.trash.failed[0]?.reason).toMatch(/own settings folder/)
    expect(readFileSync(grantsPath, 'utf-8')).toBe(before)
  })
})
