import { test, expect } from '@playwright/test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, getMainWindow } from './helpers.js'

// The Species page (HXML-37, HTOO-618). The parser and the checks are pinned
// by unit tests; this spec walks the page: a branch shows what it takes from
// its parent, a saved key is locked, and Branch Of offers only valid parents.

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const DWARF = `<?xml version="1.0"?>
<Species xmlns="${XMLNS}" Key="Dwarf" Id="4" Origin="Aosda" PlayerOption="ByBranch" Affinity="Wind" Resistance="Earth">
  <Names Singular="Dwarf" Plural="Dwarves" Adjective="Dwarven"/>
</Species>
`

const HILL_DWARF = `<?xml version="1.0"?>
<Species xmlns="${XMLNS}" Key="HillDwarf" Id="5" Origin="Aosda" PlayerOption="Starter" BranchOf="Dwarf">
  <Names Singular="Hill Dwarf" Plural="Hill Dwarves" Adjective="Hill-Dwarven"/>
  <Bodies>
    <Body Key="Ruddy" Id="50" Default="true"/>
  </Bodies>
</Species>
`

test.describe('Species', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('a branch shows its inherited elements, and saved keys are locked', async () => {
    const world = mkdtempSync(join(tmpdir(), 'creidhne-e2e-world-'))
    const lib = join(world, 'xml')
    const dir = join(lib, 'species')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'species_dwarf.xml'), DWARF)
    writeFileSync(join(dir, 'species_hilldwarf.xml'), HILL_DWARF)
    ;({ electronApp } = await launchApp({
      seedSettings: { libraries: [lib], activeLibrary: lib, theme: 'hybrasyl' }
    }))
    const page = await getMainWindow(electronApp)
    await expect(page.getByText('Index complete')).toBeVisible({ timeout: 30000 })

    await page.getByRole('button', { name: 'Species', exact: true }).first().click()

    // The branch: valid, and it shows the parent's Affinity and Resistance.
    await page.getByText('HillDwarf', { exact: true }).first().click()
    await expect(page.getByText('Empty: takes Wind from Dwarf')).toBeVisible()
    await expect(page.getByText('Empty: takes Earth from Dwarf')).toBeVisible()
    await expect(page.getByText('The server refuses this species')).toHaveCount(0)

    // Player saves store the keys, so a saved species key and body key are locked.
    await expect(page.getByRole('textbox', { name: 'Key', exact: true })).toBeDisabled()
    await expect(page.getByRole('textbox', { name: 'Key of body 1' })).toBeDisabled()
    await expect(page.getByRole('combobox', { name: 'Branch Of' })).toHaveText('Dwarf')

    // A new species: the key is open, and Branch Of offers the one ByBranch
    // species that is not a branch.
    await page.getByRole('button', { name: 'New Species' }).click()
    await expect(page.getByRole('textbox', { name: 'Key', exact: true })).toBeEnabled()
    await page.getByRole('combobox', { name: 'Branch Of' }).click()
    await expect(page.getByRole('option')).toHaveText(['None', 'Dwarf'])
  })
})
