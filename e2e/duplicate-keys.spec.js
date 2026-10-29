import { test, expect } from '@playwright/test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, getMainWindow, openPage } from './helpers.js'

// The duplicate-key report (HTOO-625). Two items share a name, and two species
// have keys that differ only in case. The report lists both, Open goes to the
// file's editor, and the editor names the other file without pushing its own
// bottom out of the pane.

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const item = (sprite) => `<?xml version="1.0"?>
<Item xmlns="${XMLNS}">
  <Name>Lorica</Name>
  <Properties>
    <Appearance Sprite="${sprite}"/>
    <Physical Value="0" Weight="1" Durability="0"/>
  </Properties>
</Item>
`

const species = (key, id) => `<?xml version="1.0"?>
<Species xmlns="${XMLNS}" Key="${key}" Id="${id}" Origin="Aosda" PlayerOption="Locked" Affinity="Wind" Resistance="Earth">
  <Names Singular="Dwarf" Plural="Dwarves" Adjective="Dwarven"/>
</Species>
`

test.describe('Duplicate keys', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('the report lists shared keys, and Open names the other file', async () => {
    const world = mkdtempSync(join(tmpdir(), 'creidhne-e2e-world-'))
    const lib = join(world, 'xml')
    mkdirSync(join(lib, 'items', 'armor'), { recursive: true })
    mkdirSync(join(lib, 'species'), { recursive: true })
    writeFileSync(join(lib, 'items', 'lorica.xml'), item(10))
    writeFileSync(join(lib, 'items', 'armor', 'lorica-copy.xml'), item(11))
    writeFileSync(join(lib, 'species', 'dwarf.xml'), species('Dwarf', 4))
    writeFileSync(join(lib, 'species', 'dwarf-upper.xml'), species('DWARF', 5))
    ;({ electronApp } = await launchApp({
      seedSettings: { libraries: [lib], activeLibrary: lib, theme: 'hybrasyl' }
    }))
    const page = await getMainWindow(electronApp)
    await expect(page.getByText('Index complete')).toBeVisible({ timeout: 30000 })

    await openPage(page, 'Reports')
    await page.getByRole('button', { name: /^Duplicate keys/ }).click()
    const groups = page.getByTestId('duplicate-key-group')
    await expect(groups).toHaveCount(2)
    await expect(groups.filter({ hasText: 'lorica' })).not.toContainText('differ only in case')
    await expect(groups.filter({ hasText: 'dwarf' })).toContainText('differ only in case')

    await page.getByRole('button', { name: 'Open armor/lorica-copy.xml' }).click()
    const notice = page.getByTestId('shared-key-notice')
    await expect(notice).toContainText('The server loads only one of these files.')
    await expect(notice).toContainText('lorica.xml')
    await expect(page.getByRole('textbox', { name: 'Filename' })).toHaveValue('lorica-copy.xml')

    // The editor after the notice ends inside its pane: the notice does not
    // push the editor's bottom out of view.
    const fits = await notice.evaluate((el) => {
      const pane = el.parentElement.getBoundingClientRect()
      const editor = el.nextElementSibling.getBoundingClientRect()
      return editor.bottom <= pane.bottom + 1
    })
    expect(fits).toBe(true)
  })
})
