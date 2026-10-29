import { test, expect } from '@playwright/test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, getMainWindow } from './helpers.js'

// The Traits page (HXML-28, HTOO-617). The parser, the checks and the rename
// row are pinned by unit tests; this spec walks the page: a trait names
// another in ConflictsWith, the other is renamed, and the repair offer
// repoints the first.

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const DOCKWORKER = `<?xml version="1.0"?>
<Trait xmlns="${XMLNS}" Name="Dockworker" Icon="112" IconSet="Skill" Category="Background">
  <ExclusiveGroup Policy="Replace">Background</ExclusiveGroup>
  <ConflictsWith>
    <Trait>Scribe</Trait>
  </ConflictsWith>
  <StatModifiers BonusStr="3"/>
</Trait>
`

const SCRIBE = `<?xml version="1.0"?>
<Trait xmlns="${XMLNS}" Name="Scribe" Icon="7" IconSet="Spell" Category="Background"/>
`

test.describe('Traits', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('a rename repoints ConflictsWith in another trait', async () => {
    const world = mkdtempSync(join(tmpdir(), 'creidhne-e2e-world-'))
    const lib = join(world, 'xml')
    const dir = join(lib, 'traits')
    mkdirSync(dir, { recursive: true })
    const dockworker = join(dir, 'trait_dockworker.xml')
    writeFileSync(dockworker, DOCKWORKER)
    writeFileSync(join(dir, 'trait_scribe.xml'), SCRIBE)
    ;({ electronApp } = await launchApp({
      seedSettings: { libraries: [lib], activeLibrary: lib, theme: 'hybrasyl' }
    }))
    const page = await getMainWindow(electronApp)
    await expect(page.getByText('Index complete')).toBeVisible({ timeout: 30000 })

    await page.getByRole('button', { name: 'Traits', exact: true }).first().click()

    // The full trait shows its fields, and no problem.
    await page.getByText('Dockworker', { exact: true }).first().click()
    await expect(page.getByRole('button', { name: 'Scribe' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'When the group is taken' })).toHaveText(
      'Replace the trait it has'
    )
    await expect(page.getByText('The server refuses this trait')).toHaveCount(0)

    // Rename Scribe, and accept the offer to repoint the file that names it.
    await page.getByText('Scribe', { exact: true }).first().click()
    const name = page.getByRole('textbox', { name: 'Name', exact: true })
    await name.fill('Archivist')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Other files use this name')).toBeVisible()
    await page.getByRole('button', { name: /^Update 1 file/ }).click()

    await expect.poll(() => readFileSync(dockworker, 'utf-8')).toContain('<Trait>Archivist</Trait>')
    expect(readFileSync(dockworker, 'utf-8')).toContain('Name="Dockworker"')
  })
})
