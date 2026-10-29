import { test, expect } from '@playwright/test'
import { mkdtempSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchApp, getMainWindow, openPage } from './helpers.js'
import { GO_PAGES } from '../src/shared/appMenu.js'

// Open every page, in the real renderer, and check none of them crashed (HTOO-393).
//
// The house found this hole in balor: the suite passed 30 of 30 over a page that
// threw on its first click, because each page-driving spec drives the page its
// own work added, and nothing had ever clicked the new tab. Every unit and jsdom
// test passed too, because vitest runs in Node. Creidhne has 23 pages and two
// page-driving specs, so most of its pages were covered by nothing.
//
// It catches what a unit test cannot: an import that resolves only under vitest's
// aliases, a hook order that breaks only under a real React build, a lazy chunk
// that fails to load, a channel the IPC guard refuses. rendererNodeGlobals.test.js
// catches the one class (a Node global in the sandboxed renderer) at the source.
//
// The list is DERIVED, not written here: GO_PAGES is the macOS Go menu's list,
// which macosSources.test.js already holds equal to the toolbar's navigate(...)
// calls, plus Settings. So a page added to the toolbar is covered here with no
// edit to this file. The button name is the page label, which is the toolbar
// button's tooltip.
//
// It asserts on the ERROR BOUNDARY and on PageRenderer's `page-<id>` marker,
// not on each page's content, so it does not go stale as the pages change.

const PAGES = [...GO_PAGES.filter(Boolean), { page: 'settings', label: 'Settings' }]

// The views that are not nav pages: each has no nav button, so it is opened from
// the page that holds its button. Settings → Appearance opens the theme gallery
// (HTOO-572). Add a view here when it is not in GO_PAGES.
const SUBPAGES = [{ from: 'Settings', button: 'Theme gallery', testId: 'theme-gallery-page' }]

test.describe('every nav page opens', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('opens each page in turn without hitting the error boundary', async () => {
    // A throwaway, empty world, so the editors render with an active library.
    const world = mkdtempSync(join(tmpdir(), 'creidhne-e2e-world-'))
    const lib = join(world, 'xml')
    mkdirSync(lib, { recursive: true })
    ;({ electronApp } = await launchApp({
      seedSettings: { libraries: [lib], activeLibrary: lib, theme: 'hybrasyl' }
    }))
    const page = await getMainWindow(electronApp)
    const boundary = page.getByTestId('error-boundary-fallback')

    // Guard the guard: a list that came back empty would pass the loop vacuously.
    expect(PAGES.length).toBeGreaterThan(20)

    for (const { page: id, label } of PAGES) {
      await openPage(page, label)

      // The page rendered. The marker is inside the Suspense, so it appears only
      // once the lazy page has loaded and rendered. Without this the loop would
      // pass on a button that silently changed nothing.
      await expect(page.getByTestId(`page-${id}`), `${label} did not render`).toBeAttached()

      // And it rendered without throwing. Named per page so a failure says which.
      await expect(boundary, `${label} went to the error boundary`).toHaveCount(0)
    }

    for (const { from, button, testId } of SUBPAGES) {
      await openPage(page, from)
      await page.getByRole('button', { name: button, exact: true }).click()
      await expect(page.getByTestId(testId), `${testId} did not render`).toBeVisible()
      await expect(boundary, `${testId} went to the error boundary`).toHaveCount(0)
    }
  })
})
