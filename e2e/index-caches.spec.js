import { test, expect } from '@playwright/test'
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, getMainWindow, openPage, repoRoot } from './helpers.js'

// Settings → World indexes (HTOO-583), through the built app and the disk.
// launchApp points HYBINDEX_CACHE_DIR at <localAppData>/Erisco/hybindex, and
// with that variable set hybindex-ts scans no other base, so this never sees
// the real cache. With vN the installed package's schema version, the cache
// folder holds:
//
//   v(N-1)/world-old/   the open world, built by an older version   → removed
//   vN/moved-world/     a world folder that no longer exists        → removed
//   vN/<the world>/     the open world, built at launch             → stays
//
// N is read from the installed package, which does not export it, so a schema
// bump in hybindex-ts does not break this spec (1.3.0 moved it from 5 to 6).
const SCHEMA_VERSION = Number(
  /\bSCHEMA_VERSION\s*=\s*(\d+)/.exec(
    readFileSync(
      join(repoRoot, 'node_modules', '@eriscorp', 'hybindex-ts', 'dist', 'index.js'),
      'utf8'
    )
  )?.[1]
)
const CURRENT = `v${SCHEMA_VERSION}`
const OLDER = `v${SCHEMA_VERSION - 1}`

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

function seedCache(base, version, key, libraryPath) {
  const dir = join(base, version, key)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '_meta.json'), JSON.stringify({ libraryPath, builtAt: '2026-01-01' }))
  writeFileSync(join(dir, 'index.json'), '{}')
  return dir
}

test.describe('World indexes', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('finds the old index caches and removes only those', async () => {
    // Guard the guard: the version was found.
    expect(SCHEMA_VERSION).toBeGreaterThan(1)
    const world = mkdtempSync(join(tmpdir(), 'creidhne-e2e-world-'))
    const lib = join(world, 'xml')
    mkdirSync(join(lib, 'statuses'), { recursive: true })
    writeFileSync(
      join(lib, 'statuses', 'burning.xml'),
      `<?xml version="1.0"?>\n<Status xmlns="${XMLNS}" Name="Burning" Icon="1" Duration="12" Tick="12"/>\n`
    )

    const localAppData = mkdtempSync(join(tmpdir(), 'creidhne-e2e-'))
    const base = join(localAppData, 'Erisco', 'hybindex')
    const oldSchema = seedCache(base, OLDER, 'world-old', lib)
    const moved = seedCache(base, CURRENT, 'moved-world', join(world, 'gone', 'xml'))

    ;({ electronApp } = await launchApp({
      localAppData,
      seedSettings: { libraries: [lib], activeLibrary: lib, theme: 'hybrasyl' }
    }))
    const page = await getMainWindow(electronApp)
    await expect(page.getByText('Index complete')).toBeVisible({ timeout: 30000 })
    // The launch built the open world's index in vN, beside the moved world's.
    const live = readdirSync(join(base, CURRENT)).filter((k) => k !== 'moved-world')
    expect(live).toHaveLength(1)

    await openPage(page, 'Settings')
    const section = page.getByTestId('index-cache-section')
    await section.getByRole('button', { name: 'Find old indexes' }).click()
    const list = section.getByTestId('old-index-list')
    await expect(list.getByRole('listitem')).toHaveCount(2)
    await expect(list).toContainText('An older index version')
    await expect(list).toContainText('The world folder is gone')
    // Find removes nothing.
    expect(existsSync(oldSchema)).toBe(true)
    expect(existsSync(moved)).toBe(true)

    await section.getByRole('button', { name: /^Remove 2 / }).click()
    await expect(section.getByText(/^Removed 2 old indexes/)).toBeVisible()
    expect(existsSync(oldSchema)).toBe(false)
    // The older folder is empty after the removal, so it goes too.
    expect(existsSync(join(base, OLDER))).toBe(false)
    expect(existsSync(moved)).toBe(false)
    expect(existsSync(join(base, CURRENT, live[0]))).toBe(true)

    // A second look finds nothing.
    await section.getByRole('button', { name: 'Find old indexes' }).click()
    await expect(section.getByText('No old indexes.')).toBeVisible()
  })
})
