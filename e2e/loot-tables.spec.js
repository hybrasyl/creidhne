import { test, expect } from '@playwright/test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, getMainWindow } from './helpers.js'

// The loot set editor shows every <Table> and every <Items> list, and a save
// writes them all back (HTOO-522). Before, the editor showed the first of each
// and a save deleted the rest. The parser and serializer are pinned by
// lootRoundTrip.test.js; this spec walks the page: open a set with two tables,
// see both, add a third, save, and read the file.

const LOOTSET = `<?xml version="1.0"?>
<LootSet xmlns="http://www.hybrasyl.com/XML/Hybrasyl/2020-02" Name="Crypt Chest">
  <Table Rolls="1" Chance="0.5">
    <Items>
      <Item>Bone</Item>
    </Items>
    <Items>
      <Item Always="true">Dust</Item>
    </Items>
  </Table>
  <Table Chance="0.05">
    <Items>
      <Item Unique="true">Crypt Key</Item>
    </Items>
  </Table>
</LootSet>
`

test.describe('Loot set tables', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('shows every table and list, and a save keeps them', async () => {
    const world = mkdtempSync(join(tmpdir(), 'creidhne-e2e-world-'))
    const lib = join(world, 'xml')
    const dir = join(lib, 'lootsets')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'lts_crypt-chest.xml')
    writeFileSync(file, LOOTSET)
    ;({ electronApp } = await launchApp({
      seedSettings: { libraries: [lib], activeLibrary: lib, theme: 'hybrasyl' }
    }))
    const page = await getMainWindow(electronApp)

    await page.getByRole('button', { name: 'Loot Sets', exact: true }).first().click()
    await page
      .getByText(/crypt.chest/i)
      .first()
      .click()

    // Both tables, and both lists of the first, are on the page. A table's
    // title names its items, so a collapsed one can be found.
    await expect(page.getByText('Table 1 · Bone, Dust', { exact: true })).toBeVisible()
    await expect(page.getByText('Table 2 · Crypt Key', { exact: true })).toBeVisible()
    await expect(page.getByText('Items 2', { exact: true })).toBeVisible()
    await expect(page.locator('input[value="Crypt Key"]')).toBeVisible()

    await page.getByRole('button', { name: 'Add Table' }).click()
    await expect(page.getByText('Table 3', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    // The save is the same file (the name did not change), and it has all
    // three tables: the two it read, unchanged, and the blank one added.
    await expect.poll(() => (readFileSync(file, 'utf-8').match(/<Table\b/g) || []).length).toBe(3)
    const saved = readFileSync(file, 'utf-8')
    expect(saved.match(/<Items\b/g)).toHaveLength(3)
    expect(saved).toContain('<Item Always="true">Dust</Item>')
    expect(saved).toContain('<Item Unique="true">Crypt Key</Item>')
  })
})
