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

  test('release, the staged-only warning, a refused twin, and stage', async () => {
    const { world, lib } = buildWorld()
    ;({ electronApp } = await launchApp({
      seedSettings: { libraries: [lib], activeLibrary: lib, theme: 'hybrasyl' }
    }))
    const page = await getMainWindow(electronApp)
    await expect(page.getByText('Index complete')).toBeVisible({ timeout: 30000 })
    await openPage(page, 'Castables')

    // A live file that names a staged-only status says so. Stage and Release are
    // in the panel and in the header; .last() is the header's.
    await page.getByText('Strike', { exact: true }).first().click()
    const refNotice = page.getByTestId('staged-reference-notice')
    await expect(refNotice).toContainText('statuses: Crouch')
    await expect(page.getByRole('button', { name: 'Stage' }).last()).toBeVisible()

    // A live editor's picker offers live names only: the server cannot find a
    // staged one, so offering it would write a reference that does not resolve.
    const listbox = page.getByRole('listbox')
    await page.getByRole('combobox', { name: 'Status' }).first().click()
    await expect(listbox.getByRole('option', { name: 'Burning', exact: true })).toBeVisible()
    await expect(listbox.getByRole('option').filter({ hasText: 'Crouch' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    // The Staged tab lists the staged castables by name.
    await page.getByRole('tab', { name: /^Staged \(3\)/ }).click()
    // Three tabs fit the 240px panel: each label inside its tab, and the last tab
    // inside the panel. MUI's 90px minimum put the third past the edge.
    const tabs = await page
      .getByRole('tablist')
      .first()
      .evaluate((el) => {
        const panel = el.parentElement.getBoundingClientRect()
        return [...el.querySelectorAll('[role=tab]')].map((t) => ({
          name: t.getAttribute('aria-label'),
          fits:
            t.scrollWidth <= t.clientWidth + 1 && t.getBoundingClientRect().right <= panel.right + 1
        }))
      })
    expect(tabs).toEqual([
      { name: 'Active (2)', fits: true },
      { name: 'Archived (0)', fits: true },
      { name: 'Staged (3)', fits: true }
    ])
    await page.getByText('Ambush', { exact: true }).first().click()
    await expect(page.getByTestId('staged-chip')).toBeVisible()
    // The live twin is named, because Release will refuse it.
    await expect(page.getByTestId('shared-key-notice')).toContainText('ambush.xml')

    // Release refuses a twin and moves nothing.
    await page.getByRole('button', { name: 'Release' }).last().click()
    const dialog = page.getByTestId('confirm-dialog')
    await expect(dialog).toContainText('Nothing was released')
    await expect(dialog).toContainText('is already live')
    await dialog.getByRole('button', { name: 'OK' }).click()
    await expect(dialog).toBeHidden()
    expect(existsSync(join(world, '.staging/castables/animist/ambush.xml'))).toBe(true)

    // Release Claw: it applies the staged-only Crouch, so Release offers that file too.
    await page.getByText('Claw', { exact: true }).first().click()
    await expect(page.getByTestId('staged-chip')).toBeVisible()
    // A staged editor's picker offers the live and the staged names, and marks
    // the staged-only one.
    await page.getByRole('combobox', { name: 'Status' }).first().click()
    await expect(listbox.getByRole('option', { name: 'Burning', exact: true })).toBeVisible()
    const crouch = listbox.getByRole('option').filter({ hasText: 'Crouch' })
    await expect(crouch).toHaveCount(1)
    await expect(crouch.getByTestId('staged-option-mark')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Release' }).last().click()
    await expect(dialog).toContainText('statuses/animist/crouch.xml')
    await dialog.getByRole('button', { name: 'Release all 2' }).click()
    await expect(page.getByText('Released 2 items.')).toBeVisible()
    expect(existsSync(join(lib, 'castables/animist/claw.xml'))).toBe(true)
    expect(existsSync(join(lib, 'statuses/animist/crouch.xml'))).toBe(true)
    expect(existsSync(join(world, '.staging/statuses/animist/crouch.xml'))).toBe(false)

    // Crouch is live now, so Strike's warning is gone.
    await page.getByRole('tab', { name: /^Active/ }).click()
    await page.getByText('Strike', { exact: true }).first().click()
    await expect(page.getByRole('textbox', { name: 'Filename' })).toHaveValue('strike.xml')
    await expect(refNotice).toHaveCount(0)

    // Stage Strike: a live NPC trains it, so Stage names the NPC first.
    await page.getByRole('button', { name: 'Stage' }).last().click()
    await expect(dialog).toContainText('npcs/trainer.xml names “Strike”')
    await dialog.getByRole('button', { name: 'Stage', exact: true }).click()
    // MUI gives the app back its accessible names only once the dialog's exit
    // transition ends, and the stage itself is quicker than that.
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Staged 1 item.')).toBeVisible()
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
  })
})
