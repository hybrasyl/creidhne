import { test, expect } from '@playwright/test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, getMainWindow, openPage } from './helpers.js'

// The page toolbar fits the window at its minimum size (HTOO-628). Castables has
// every item action, staging included; Formulas adds its own two buttons and
// has no staging. The fault is a computed layout, so this measures it.

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

test.describe('page toolbar', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('every control is inside the toolbar at the minimum window size', async () => {
    const world = mkdtempSync(join(tmpdir(), 'creidhne-e2e-world-'))
    const lib = join(world, 'xml')
    mkdirSync(join(lib, 'castables'), { recursive: true })
    writeFileSync(
      join(lib, 'castables', 'ember.xml'),
      `<?xml version="1.0"?>\n<Castable xmlns="${XMLNS}" Book="PrimarySpell" Class="Wizard">\n  <Name>Ember</Name>\n</Castable>\n`
    )
    ;({ electronApp } = await launchApp({
      seedSettings: { libraries: [lib], activeLibrary: lib, theme: 'hybrasyl' }
    }))
    const page = await getMainWindow(electronApp)
    await expect(page.getByText('Index complete')).toBeVisible({ timeout: 30000 })
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      const [w, h] = win.getMinimumSize()
      win.setSize(w, h)
    })
    await expect
      .poll(() => page.evaluate(() => window.innerWidth), { timeout: 5000 })
      .toBeLessThanOrEqual(1024)

    for (const [label, wants] of [
      [
        'Castables',
        ['New Castable', 'Staged (0)', 'Archived (0)', 'Active (1)', 'Release', 'Stage']
      ],
      ['Formulas', ['Import from Lua', 'Formula Settings']]
    ]) {
      await openPage(page, label)
      const toolbar = page.getByTestId('page-toolbar')
      await expect(toolbar).toBeVisible()
      const measured = await toolbar.evaluate((el) => {
        const right = el.getBoundingClientRect().right
        const controls = [...el.querySelectorAll('button')]
        return {
          count: controls.length,
          names: controls.map((b) => b.getAttribute('aria-label')),
          outside: controls
            .filter((b) => b.getBoundingClientRect().right > right + 0.5)
            .map((b) => b.getAttribute('aria-label'))
        }
      })
      expect(measured.outside, label).toEqual([])
      // Guards the guard: the measure found the controls it is about.
      expect(measured.count, label).toBeGreaterThanOrEqual(5)
      for (const want of wants) {
        const found = measured.names.some((n) => n === want || n?.startsWith(want))
        // Stage and Release are one button: either name is the button.
        if (want === 'Release' || want === 'Stage') {
          expect(
            measured.names.some((n) => n === 'Stage' || n === 'Release'),
            label
          ).toBe(true)
        } else {
          expect(found, `${label}: ${want}`).toBe(true)
        }
      }
    }

    // The context menu is the house shell's (HTOO-637). A right-click on a row
    // selects it and opens the menu with the toolbar's actions.
    await openPage(page, 'Castables')
    await page
      .getByTestId('file-list')
      .getByText('Ember', { exact: true })
      .click({ button: 'right' })
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem', { name: 'Archive' })).toBeEnabled()
    await expect(menu.getByRole('menuitem', { name: 'Stage' })).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
  })
})
