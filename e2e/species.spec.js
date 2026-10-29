import { test, expect } from '@playwright/test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, getMainWindow } from './helpers.js'

// The Species page (HXML-37, HTOO-618). The parser, the checks and the rename
// row are pinned by unit tests; this spec walks the page: a branch shows what
// it takes from its parent, and renaming the parent repoints the branch.

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

  test('a branch shows its inherited elements, and follows a parent rename', async () => {
    const world = mkdtempSync(join(tmpdir(), 'creidhne-e2e-world-'))
    const lib = join(world, 'xml')
    const dir = join(lib, 'species')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'species_dwarf.xml'), DWARF)
    const hill = join(dir, 'species_hilldwarf.xml')
    writeFileSync(hill, HILL_DWARF)
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

    // Rename the parent and accept the repair.
    await page.getByText('Dwarf', { exact: true }).first().click()
    await page.getByRole('textbox', { name: 'Key', exact: true }).fill('Duergar')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Other files use this name')).toBeVisible()
    await page.getByRole('button', { name: /^Update 1 file/ }).click()

    await expect.poll(() => readFileSync(hill, 'utf-8')).toContain('BranchOf="Duergar"')
    expect(readFileSync(hill, 'utf-8')).toContain('Key="HillDwarf"')
  })
})
