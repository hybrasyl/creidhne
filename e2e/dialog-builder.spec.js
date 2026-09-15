import { test, expect } from '@playwright/test'
import { mkdtempSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, getMainWindow } from './helpers.js'

// The dialog builder end to end (HTOO-458): compose a one-sequence dialog
// through the real form, save it, and export it. This spans the page → IPC
// (dialogs:save, zod-validated) → world/.creidhne/dialogs/<name>.json → the
// export dialog rendering the shared emitter's Lua — the path no unit test
// walks whole. The Lua itself is pinned by the shared tests against Narve; here
// the assertion is that the UI reaches it.

test.describe('Dialog builder', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('composes, saves to the world, and exports Lua', async () => {
    // A throwaway world: libraryPath is <world>/xml, and .creidhne/ is a sibling.
    const world = mkdtempSync(join(tmpdir(), 'creidhne-e2e-world-'))
    const lib = join(world, 'xml')
    mkdirSync(lib, { recursive: true })
    ;({ electronApp } = await launchApp({
      seedSettings: { libraries: [lib], activeLibrary: lib, theme: 'hybrasyl' }
    }))
    const page = await getMainWindow(electronApp)

    await page.getByRole('button', { name: 'Dialog Builder' }).click()
    await expect(page.getByRole('heading', { name: 'Dialog builder' })).toBeVisible()

    await page.getByRole('button', { name: 'New dialog' }).click()
    await page.getByLabel('Name', { exact: true }).fill('greet')
    await page.getByLabel('Title', { exact: true }).fill('Greeting')

    await page.getByRole('button', { name: 'Add the first sequence' }).click()
    await page.getByLabel('Sequence name').fill('Greet')
    // MUI's Select is a combobox whose label is not an association Playwright sees.
    await page.getByRole('combobox').filter({ hasText: 'Local' }).click()
    await page.getByRole('option', { name: 'Pursuit' }).click()

    await page.getByRole('button', { name: 'Text', exact: true }).click()
    await page.getByLabel('Text', { exact: true }).fill('Well met, traveller.')
    // A tooltip becomes the button's accessible name, so match on the text.
    await page.getByRole('button').filter({ hasText: 'End dialog' }).click()

    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Saved greet.json.')).toBeVisible()

    const file = join(world, '.creidhne', 'dialogs', 'greet.json')
    expect(existsSync(file)).toBe(true)
    const saved = JSON.parse(readFileSync(file, 'utf-8'))
    expect(saved.name).toBe('greet')
    expect(saved.sequences[0]).toMatchObject({ name: 'Greet', scope: 'pursuit' })
    expect(saved.sequences[0].dialogs.map((d) => d.kind)).toEqual(['text', 'function'])

    await page.getByRole('button').filter({ hasText: 'Export' }).click()
    const exportDialog = page.getByRole('dialog', { name: 'Export Greeting' })
    await expect(exportDialog).toBeVisible()
    await expect(exportDialog.getByText('greet = {')).toBeVisible()
    await expect(exportDialog.getByText('"Well met, traveller.",')).toBeVisible()
    await expect(exportDialog.getByText('greet_lecture = world.NewDialogSequence("Greet",')).toBeVisible()
    await expect(exportDialog.getByText('origin.AddPursuit(greet_lecture)')).toBeVisible()

    // Module export is the same document, wrapped for require().
    await exportDialog.getByRole('tab', { name: /Module/ }).click()
    await expect(exportDialog.getByText('function M.install(opts)')).toBeVisible()
    await expect(exportDialog.getByText('greet = require("dialogs/greet")')).toBeVisible()
  })
})
