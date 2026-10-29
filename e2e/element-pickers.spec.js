import { test, expect } from '@playwright/test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, getMainWindow } from './helpers.js'

// The element pickers take their options from the active element table
// (HTOO-581). The rules are pinned by elementOptions.test.js; this spec checks
// the castable editor against a built index: the options come from the table,
// an old name shows its warning, and a save keeps a selector list as written.

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const TABLE = `<?xml version="1.0"?>
<ElementTable xmlns="${XMLNS}" Name="HybElements2">
  <Elements>
    <Element Key="Force" Id="0" Default="true"/>
    <Element Key="Fire" Id="1" RetailId="1"/>
    <Element Key="Nature" Id="17" RetailId="7"/>
  </Elements>
  <Groups>
    <Group Key="Cardinal" Members="Fire Nature"/>
  </Groups>
  <Source Element="Fire">
    <Target Element="Nature" Multiplier="1.2"/>
  </Source>
</ElementTable>
`

const CASTABLE = `<?xml version="1.0"?>
<Castable xmlns="${XMLNS}" Book="PrimarySpell" Elements="Fire RandomTemuair" Class="Wizard">
  <Name>Ember</Name>
</Castable>
`

test.describe('Element pickers', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('a castable offers the active table and names an old selector', async () => {
    const world = mkdtempSync(join(tmpdir(), 'creidhne-e2e-world-'))
    const lib = join(world, 'xml')
    mkdirSync(join(lib, 'elementtables'), { recursive: true })
    mkdirSync(join(lib, 'castables'), { recursive: true })
    writeFileSync(join(lib, 'elementtables', 'element_hybelements2.xml'), TABLE)
    const file = join(lib, 'castables', 'spell_ember.xml')
    writeFileSync(file, CASTABLE)
    ;({ electronApp } = await launchApp({
      seedSettings: { libraries: [lib], activeLibrary: lib, theme: 'hybrasyl' }
    }))
    const page = await getMainWindow(electronApp)
    await expect(page.getByText('Index complete')).toBeVisible({ timeout: 30000 })

    await page.getByRole('button', { name: 'Castables', exact: true }).first().click()
    await page.getByText('Ember', { exact: true }).first().click()

    const field = page.getByRole('combobox', { name: 'Elements' })
    await expect(page.getByRole('button', { name: 'Fire' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'RandomTemuair' })).toBeVisible()
    await expect(page.getByText('RandomTemuair is now Random:Cardinal.')).toBeVisible()

    // The options are the table's keys, its group, and the state selectors.
    await field.click()
    const listbox = page.getByRole('listbox')
    for (const option of ['Force', 'Nature', 'Random:Cardinal', 'Current', 'Belt', 'Necklace']) {
      await expect(listbox.getByRole('option', { name: option, exact: true })).toBeVisible()
    }
    await expect(listbox.getByRole('option', { name: 'Wood', exact: true })).toHaveCount(0)

    // Replace the old selector with the group, and save.
    await page.getByRole('button', { name: 'RandomTemuair' }).locator('svg').click()
    await field.fill('Random:Card')
    await listbox.getByRole('option', { name: 'Random:Cardinal', exact: true }).click()
    await expect(page.getByText('RandomTemuair is now Random:Cardinal.')).toHaveCount(0)
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect
      .poll(() => readFileSync(file, 'utf-8'))
      .toContain('Elements="Fire Random:Cardinal"')
  })
})
