import { test, expect } from '@playwright/test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, getMainWindow } from './helpers.js'

// A spawn's empty <Hostility> (HTOO-136). The server copies a spawn's
// Hostility over the creature's when the element is there, so an empty one
// makes the monster neutral. The editor shows that it is set, and a save
// keeps it; clearing the switch removes it.

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const GROUP = `<?xml version="1.0"?>
<SpawnGroup xmlns="${XMLNS}" Name="Cellar">
  <Spawns>
    <Spawn Name="Cellar Spider">
      <Hostility>
      </Hostility>
    </Spawn>
  </Spawns>
</SpawnGroup>
`

test.describe('Spawn group hostility', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('an empty Hostility shows as neutral, and a save keeps it', async () => {
    const world = mkdtempSync(join(tmpdir(), 'creidhne-e2e-world-'))
    const lib = join(world, 'xml')
    mkdirSync(join(lib, 'spawngroups'), { recursive: true })
    const file = join(lib, 'spawngroups', 'cellar.xml')
    writeFileSync(file, GROUP)
    ;({ electronApp } = await launchApp({
      seedSettings: { libraries: [lib], activeLibrary: lib, theme: 'hybrasyl' }
    }))
    const page = await getMainWindow(electronApp)
    await expect(page.getByText('Index complete')).toBeVisible({ timeout: 30000 })

    await page.getByRole('button', { name: 'Spawngroups', exact: true }).click()
    await page.getByText('Cellar', { exact: true }).first().click()
    await page.getByText('Hostility', { exact: true }).click()

    const set = page.getByRole('checkbox', { name: 'Set hostility for this spawn' })
    await expect(set).toBeChecked()
    await expect(page.getByText('the monster is neutral')).toBeVisible()

    // Save with no edit keeps the element.
    await page.getByRole('textbox', { name: 'Comment' }).fill('kept')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect.poll(() => readFileSync(file, 'utf-8')).toContain('kept')
    expect(readFileSync(file, 'utf-8')).toContain('<Hostility/>')

    // Clearing the switch hands the spawn back to its creature.
    await set.uncheck()
    await expect(page.getByText("uses its creature's hostility")).toBeVisible()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect.poll(() => readFileSync(file, 'utf-8')).not.toContain('Hostility')
  })
})
