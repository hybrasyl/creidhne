import { test, expect } from '@playwright/test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, getMainWindow } from './helpers.js'

// The element table editor opens both formats and writes back what it read
// (HTOO-581). The parser and the model are pinned by elementTableXml.test.js
// and elementTable.test.js; this spec walks the page in the built app.

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

// The old format, with the multiplier that the percentage model lost.
const LEGACY = `<?xml version="1.0"?>
<ElementTable xmlns="${XMLNS}" Name="Legacy">
  <Source Element="Fire">
    <Target Element="Fire" Multiplier="1"/>
    <Target Element="Wind" Multiplier="1.075"/>
  </Source>
  <Source Element="Wind">
    <Target Element="Fire" Multiplier="0.8"/>
    <Target Element="Wind" Multiplier="1"/>
  </Source>
</ElementTable>
`

const REGISTRY = `<?xml version="1.0"?>
<ElementTable xmlns="${XMLNS}" Name="Registry" DefaultMultiplier="0.9">
  <Elements>
    <Element Key="Force" Id="0" RetailId="0" Default="true"/>
    <Element Key="Fire" Id="1" RetailId="1"/>
  </Elements>
  <Groups>
    <Group Key="Hot" Members="Fire"/>
  </Groups>
  <Source Element="Fire">
    <Target Element="Force" Multiplier="1.2"/>
  </Source>
</ElementTable>
`

test.describe('Element tables', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  async function openTable(fileName, xml, tableName) {
    const world = mkdtempSync(join(tmpdir(), 'creidhne-e2e-world-'))
    const lib = join(world, 'xml')
    const dir = join(lib, 'elementtables')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, fileName)
    writeFileSync(file, xml)
    ;({ electronApp } = await launchApp({
      seedSettings: { libraries: [lib], activeLibrary: lib, theme: 'hybrasyl' }
    }))
    const page = await getMainWindow(electronApp)
    await page.getByRole('button', { name: 'Elements', exact: true }).first().click()
    await page.getByText(tableName, { exact: false }).first().click()
    return { page, file }
  }

  test('an old-format table keeps its format and its multiplier text', async () => {
    const { page, file } = await openTable('element_legacy.xml', LEGACY, 'legacy')

    await expect(page.getByText('This table is in the old format', { exact: false })).toBeVisible()
    await expect(page.getByLabel('Fire against Wind')).toHaveValue('1.075')

    await page.getByLabel('Wind against Fire').fill('0.85')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect.poll(() => readFileSync(file, 'utf-8')).toContain('Multiplier="0.85"')
    const saved = readFileSync(file, 'utf-8')
    expect(saved).toContain('<Target Element="Wind" Multiplier="1.075"/>')
    expect(saved).not.toContain('<Elements>')
    expect(saved.match(/<Target\b/g)).toHaveLength(4)
  })

  test('Convert adds the Elements block and changes no multiplier', async () => {
    const { page, file } = await openTable('element_legacy.xml', LEGACY, 'legacy')

    await page.getByRole('button', { name: 'Convert', exact: true }).click()
    await expect(page.getByLabel('Id of Fire', { exact: true })).toHaveValue('1')
    await expect(page.getByLabel('Id of Wind', { exact: true })).toHaveValue('3')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect.poll(() => readFileSync(file, 'utf-8')).toContain('<Elements>')
    const saved = readFileSync(file, 'utf-8')
    expect(saved).toContain('<Element Key="Fire" Id="1" RetailId="1" Default="true"/>')
    expect(saved).toContain('<Target Element="Wind" Multiplier="1.075"/>')
    expect(saved.match(/<Target\b/g)).toHaveLength(4)
  })

  test('a registry table shows its defaults and writes only declared pairs', async () => {
    const { page, file } = await openTable('element_registry.xml', REGISTRY, 'registry')

    await expect(page.getByLabel('Key of element 1')).toHaveValue('Force')
    await expect(page.getByLabel('Members')).toHaveValue('Fire')
    // An undeclared pair is empty, and shows the table default it uses.
    const cell = page.getByLabel('Force against Fire')
    await expect(cell).toHaveValue('')
    await expect(cell).toHaveAttribute('placeholder', '0.9')

    await page.getByLabel('Row default of Force').fill('1.1')
    await expect(cell).toHaveAttribute('placeholder', '1.1')
    await page.getByLabel('Fire against Fire').fill('0.5')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect.poll(() => readFileSync(file, 'utf-8')).toContain('Multiplier="0.5"')
    const saved = readFileSync(file, 'utf-8')
    expect(saved).toContain('<Source Element="Force" DefaultMultiplier="1.1"/>')
    expect(saved).toContain('<Group Key="Hot" Members="Fire"/>')
    expect(saved.match(/<Target\b/g)).toHaveLength(2)
  })
})
