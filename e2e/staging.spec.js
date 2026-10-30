import { test, expect } from '@playwright/test'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, getMainWindow, openPage } from './helpers.js'

// Staging (HTOO-453). A world with `.staging/` beside `xml/`, as world has it:
//
//   xml/castables/strike.xml        live "Strike", applies the staged-only "Crouch"
//   xml/castables/ambush.xml        live "Ambush"
//   xml/npcs/trainer.xml            trains "Strike"
//   .staging/castables/animist/claw.xml    staged "Claw", applies "Crouch"
//   .staging/castables/animist/ambush.xml  staged twin of the live "Ambush"
//   .staging/castables/animist/singe.xml   staged "Singe", applies the live "Burning"
//   .staging/statuses/animist/crouch.xml   staged status "Crouch"
//
// The rules are unit-tested (src/shared/__tests__/staging.test.js); this spec
// drives them through the pages, the IPC and the disk.

const XMLNS = 'http://www.hybrasyl.com/XML/Hybrasyl/2020-02'

const castable = (name, status) => `<?xml version="1.0"?>
<Castable xmlns="${XMLNS}" Book="PrimarySkill" Class="Monk">
  <Name>${name}</Name>${
    status
      ? `
  <Effects>
    <Statuses>
      <Add Duration="12">${status}</Add>
    </Statuses>
  </Effects>`
      : ''
  }
</Castable>
`

const status = (name) => `<?xml version="1.0"?>
<Status xmlns="${XMLNS}" Name="${name}" Icon="1" Duration="12" Tick="12"/>
`

const npc = `<?xml version="1.0"?>
<Npc xmlns="${XMLNS}">
  <Name>Trainer</Name>
  <Roles>
    <Train>
      <Castable Name="Strike" Type="Skill" Class="Monk"/>
    </Train>
  </Roles>
</Npc>
`

function buildWorld() {
  const world = mkdtempSync(join(tmpdir(), 'creidhne-e2e-world-'))
  const lib = join(world, 'xml')
  const put = (rel, xml) => {
    const full = join(world, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, xml)
  }
  put('xml/castables/strike.xml', castable('Strike', 'Crouch'))
  put('xml/castables/ambush.xml', castable('Ambush'))
  put('xml/npcs/trainer.xml', npc)
  put('xml/statuses/burning.xml', status('Burning'))
  put('.staging/castables/animist/claw.xml', castable('Claw', 'Crouch'))
  put('.staging/castables/animist/ambush.xml', castable('Ambush'))
  put('.staging/castables/animist/singe.xml', castable('Singe', 'Burning'))
  put('.staging/statuses/animist/crouch.xml', status('Crouch'))
  return { world, lib }
}

test.describe('Staging', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('release, the staged-only warning, a refused twin, stage, and the Staging box', async () => {
    const { world, lib } = buildWorld()
    ;({ electronApp } = await launchApp({
      seedSettings: { libraries: [lib], activeLibrary: lib, theme: 'hybrasyl' }
    }))
    const page = await getMainWindow(electronApp)
    await expect(page.getByText('Index complete')).toBeVisible({ timeout: 30000 })
    await openPage(page, 'Castables')

    // The toolbar's set toggles (HTOO-628). `only` shows one set and hides the
    // others; at least one stays on, so turn the wanted one on first.
    const toggle = (name) => page.getByRole('button', { name: new RegExp(`^${name} \\(`) })
    const only = async (name) => {
      const pressed = async (n) => (await toggle(n).getAttribute('aria-pressed')) === 'true'
      if (!(await pressed(name))) await toggle(name).click()
      for (const other of ['Active', 'Staged', 'Archived'].filter((n) => n !== name)) {
        if (await pressed(other)) await toggle(other).click()
      }
    }
    const stagingBox = page.getByRole('checkbox', { name: 'Staging' })
    const dialog = page.getByTestId('confirm-dialog')

    // A live file that names a staged-only status says so.
    await page.getByText('Strike', { exact: true }).first().click()
    const refNotice = page.getByTestId('staged-reference-notice')
    await expect(refNotice).toContainText('statuses: Crouch')
    await expect(stagingBox).not.toBeChecked()
    await expect(page.getByRole('button', { name: 'Stage', exact: true })).toBeEnabled()

    // A live editor's picker offers live names only: the server cannot find a
    // staged one, so offering it would write a reference that does not resolve.
    const listbox = page.getByRole('listbox')
    await page.getByRole('combobox', { name: 'Status' }).first().click()
    await expect(listbox.getByRole('option', { name: 'Burning', exact: true })).toBeVisible()
    await expect(listbox.getByRole('option').filter({ hasText: 'Crouch' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    // Each set shown has a header with its count, and a header collapses its set.
    await expect(page.getByTestId('list-section-active')).toContainText('2')
    await toggle('Staged').click()
    await expect(page.getByTestId('list-section-active')).toContainText('2')
    await expect(page.getByTestId('list-section-staged')).toContainText('3')
    const fileList = page.getByTestId('file-list')
    await page.getByTestId('list-section-active').click()
    await expect(page.getByTestId('list-section-active')).toHaveAttribute('aria-expanded', 'false')
    await expect(fileList.getByText('Strike', { exact: true })).toHaveCount(0)
    await page.getByTestId('list-section-active').click()
    await expect(fileList.getByText('Strike', { exact: true })).toBeVisible()

    // The staged castables alone, by name.
    await only('Staged')
    await expect(page.getByTestId('list-section-active')).toHaveCount(0)
    await expect(page.getByTestId('list-section-staged')).toBeVisible()
    await page.getByText('Ambush', { exact: true }).first().click()
    await expect(stagingBox).toBeChecked()
    // The live twin is named, because Release will refuse it.
    await expect(page.getByTestId('shared-key-notice')).toContainText('ambush.xml')
    // Stage is Release for a staged file, and Archive does not apply.
    await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeDisabled()

    // Release refuses a twin and moves nothing.
    await page.getByRole('button', { name: 'Release', exact: true }).click()
    await expect(dialog).toContainText('Nothing was released')
    await expect(dialog).toContainText('is already live')
    await dialog.getByRole('button', { name: 'OK' }).click()
    await expect(dialog).toBeHidden()
    expect(existsSync(join(world, '.staging/castables/animist/ambush.xml'))).toBe(true)

    // Release Claw: it applies the staged-only Crouch, so Release offers that file too.
    await page.getByText('Claw', { exact: true }).first().click()
    await expect(stagingBox).toBeChecked()
    // A staged editor's picker offers the live and the staged names, and marks
    // the staged-only one.
    await page.getByRole('combobox', { name: 'Status' }).first().click()
    await expect(listbox.getByRole('option', { name: 'Burning', exact: true })).toBeVisible()
    const crouch = listbox.getByRole('option').filter({ hasText: 'Crouch' })
    await expect(crouch).toHaveCount(1)
    await expect(crouch.getByTestId('staged-option-mark')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Release', exact: true }).click()
    await expect(dialog).toContainText('statuses/animist/crouch.xml')
    await dialog.getByRole('button', { name: 'Release all 2' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Released 2 items.')).toBeVisible()
    expect(existsSync(join(lib, 'castables/animist/claw.xml'))).toBe(true)
    expect(existsSync(join(lib, 'statuses/animist/crouch.xml'))).toBe(true)
    expect(existsSync(join(world, '.staging/statuses/animist/crouch.xml'))).toBe(false)

    // Crouch is live now, so Strike's warning is gone.
    await only('Active')
    await page.getByText('Strike', { exact: true }).first().click()
    await expect(page.getByRole('textbox', { name: 'Filename' })).toHaveValue('strike.xml')
    await expect(refNotice).toHaveCount(0)

    // Stage Strike from the toolbar: a live NPC trains it, so Stage names the NPC first.
    await page.getByRole('button', { name: 'Stage', exact: true }).click()
    await expect(dialog).toContainText('npcs/trainer.xml names “Strike”')
    await dialog.getByRole('button', { name: 'Stage', exact: true }).click()
    // MUI gives the app back its accessible names only once the dialog's exit
    // transition ends, and the stage itself is quicker than that.
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Staged 1 item.')).toBeVisible()
    expect(existsSync(join(world, '.staging/castables/strike.xml'))).toBe(true)
    expect(existsSync(join(lib, 'castables/strike.xml'))).toBe(false)

    // The Staging box moves a file on Save, one file, both ways. Clear it on
    // the staged Strike: the save releases it.
    await only('Staged')
    await page.getByText('Strike', { exact: true }).first().click()
    await expect(stagingBox).toBeChecked()
    await stagingBox.uncheck()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Released as "strike.xml".')).toBeVisible()
    expect(existsSync(join(lib, 'castables/strike.xml'))).toBe(true)
    expect(existsSync(join(world, '.staging/castables/strike.xml'))).toBe(false)

    // Check it again: the save stages it, after Stage's check names the NPC.
    await only('Active')
    await page.getByText('Strike', { exact: true }).first().click()
    await stagingBox.check()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog).toContainText('npcs/trainer.xml names “Strike”')
    await dialog.getByRole('button', { name: 'Save into staging' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Saved into staging as "strike.xml".')).toBeVisible()
    expect(existsSync(join(world, '.staging/castables/strike.xml'))).toBe(true)
    expect(existsSync(join(lib, 'castables/strike.xml'))).toBe(false)

    // Rename the live status Burning: the repair lists the staged Singe, which
    // names it, under its own heading, and repoints it.
    await openPage(page, 'Statuses')
    await page.getByText('Burning', { exact: true }).first().click()
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Ablaze')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    const repair = page.getByRole('dialog').filter({ hasText: 'Other files use this name' })
    await expect(repair).toContainText('In staging')
    await expect(repair).toContainText('.staging/castables/animist/singe.xml')
    await repair.getByRole('button', { name: /^Update/ }).click()
    await expect(page.getByText(/^Updated 1 reference/)).toBeVisible()
    expect(readFileSync(join(world, '.staging/castables/animist/singe.xml'), 'utf8')).toContain(
      '>Ablaze</Add>'
    )

    // New while only Staged is shown starts with the box checked. Crouch was
    // released, so the statuses have no staged file yet.
    await expect(toggle('Staged')).toHaveAccessibleName('Staged (0)')
    await only('Staged')
    await page.getByRole('button', { name: /^New staged/ }).click()
    await expect(stagingBox).toBeChecked()
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Seething')
    const fileName = await page.getByRole('textbox', { name: 'Filename' }).inputValue()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(toggle('Staged')).toHaveAccessibleName('Staged (1)')
    expect(existsSync(join(world, '.staging/statuses', fileName))).toBe(true)
    expect(existsSync(join(lib, 'statuses', fileName))).toBe(false)
  })
})
