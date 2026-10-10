import { describe, it, expect, vi } from 'vitest'
import { buildMenuTemplate, menuStateSchema } from '../appMenu.js'
import { GO_PAGES, INITIAL_MENU_STATE } from '../../shared/appMenu.js'

// The macOS application menu. buildMenuTemplate is pure, so the whole menu is
// asserted here on any OS; e2e/app-menu.spec.js checks the installed menu on a Mac.

const build = (state = INITIAL_MENU_STATE, opts = {}) =>
  buildMenuTemplate(state, { appName: 'Creidhne', isDev: false, send: vi.fn(), ...opts })

/** Every item at every depth. */
function flatten(items) {
  return items.flatMap((i) => [i, ...(Array.isArray(i.submenu) ? flatten(i.submenu) : [])])
}

const byId = (template, id) => flatten(template).find((i) => i.id === id)
const menu = (template, label) => template.find((m) => m.label === label)

describe('buildMenuTemplate', () => {
  it('has the house shape: app, File, Edit, View, Go, Window, Help', () => {
    const t = build()
    expect(t.map((m) => m.label ?? m.role)).toEqual([
      'Creidhne',
      'File',
      'editMenu',
      'View',
      'Go',
      'windowMenu',
      'help'
    ])
  })

  it('has no reload, forceReload or zoom role anywhere, in any build', () => {
    // Reload drops every unsaved edit in the renderer. The zoom keys are blocked by
    // optimizer.watchWindowShortcuts, so a zoom item would show a key that does nothing.
    const banned = ['reload', 'forceReload', 'zoomIn', 'zoomOut', 'resetZoom']
    for (const isDev of [false, true]) {
      const roles = flatten(build(INITIAL_MENU_STATE, { isDev }))
        .map((i) => i.role)
        .filter(Boolean)
      expect(roles.length).toBeGreaterThan(5) // guard the guard: roles were found
      for (const role of banned) expect(roles).not.toContain(role)
    }
  })

  it('shows Toggle Developer Tools in a dev build only', () => {
    const roles = (isDev) => flatten(build(INITIAL_MENU_STATE, { isDev })).map((i) => i.role)
    expect(roles(false)).not.toContain('toggleDevTools')
    expect(roles(true)).toContain('toggleDevTools')
  })

  it('names the app in the role labels, which would otherwise read package.json `name`', () => {
    const app = build()[0].submenu
    expect(app.find((i) => i.role === 'quit').label).toBe('Quit Creidhne')
    expect(app.find((i) => i.role === 'hide').label).toBe('Hide Creidhne')
    expect(byId(build(), 'about').label).toBe('About Creidhne')
    expect(byId(build(), 'settings').accelerator).toBe('Cmd+,')
  })

  it('keeps the Edit menu, without which ⌘C, ⌘V and ⌘A stop working in text fields', () => {
    expect(build().some((m) => m.role === 'editMenu')).toBe(true)
  })

  it('greys out Save and Launch Taliesin until the renderer reports them', () => {
    const initial = build()
    expect(byId(initial, 'save').enabled).toBe(false)
    expect(byId(initial, 'save').accelerator).toBe('Cmd+S')
    expect(byId(initial, 'launchCompanion').enabled).toBe(false)

    const live = build({ ...INITIAL_MENU_STATE, canSave: true, canLaunchCompanion: true })
    expect(byId(live, 'save').enabled).toBe(true)
    expect(byId(live, 'launchCompanion').enabled).toBe(true)
  })

  it('lists every Go page in order, ⌘1 to ⌘9 on the first nine, and marks the current one', () => {
    const t = build({ ...INITIAL_MENU_STATE, page: 'items' })
    const go = menu(t, 'Go').submenu.filter((i) => i.type !== 'separator')
    const pages = GO_PAGES.filter(Boolean)
    expect(go.map((i) => i.id)).toEqual(pages.map((p) => `go:${p.page}`))
    expect(go.slice(0, 9).map((i) => i.accelerator)).toEqual(
      Array.from({ length: 9 }, (_, i) => `Cmd+${i + 1}`)
    )
    expect(go.slice(9).every((i) => i.accelerator === undefined)).toBe(true)
    expect(go.filter((i) => i.checked).map((i) => i.id)).toEqual(['go:items'])
  })

  it('marks the reference panel toggle from the state', () => {
    expect(byId(build(), 'toggleReferencePanel').checked).toBe(false)
    const open = build({ ...INITIAL_MENU_STATE, referencePanelOpen: true })
    expect(byId(open, 'toggleReferencePanel').checked).toBe(true)
  })

  it('sends the item id as the command when an item is clicked', () => {
    const send = vi.fn()
    const t = build(INITIAL_MENU_STATE, { send })
    byId(t, 'go:dialogs').click()
    byId(t, 'whatsNew').click()
    expect(send.mock.calls).toEqual([[{ command: 'go:dialogs' }], [{ command: 'whatsNew' }]])
  })

  it('gives every app item an id equal to its command, so e2e can find it', () => {
    const appItems = flatten(build()).filter((i) => typeof i.click === 'function')
    expect(appItems.length).toBeGreaterThan(20)
    for (const i of appItems) expect(typeof i.id).toBe('string')
  })
})

describe('menuStateSchema', () => {
  it('accepts the initial state and a live one', () => {
    expect(menuStateSchema.safeParse(INITIAL_MENU_STATE).success).toBe(true)
    const live = {
      page: 'castables',
      canSave: true,
      canLaunchCompanion: true,
      referencePanelOpen: true
    }
    expect(menuStateSchema.parse(live)).toEqual(live)
  })

  it.each([
    ['null', null],
    ['a missing field', { page: 'items', canSave: true, canLaunchCompanion: false }],
    ['a string for a boolean', { ...INITIAL_MENU_STATE, canSave: 'yes' }],
    ['a page that is not a string', { ...INITIAL_MENU_STATE, page: 7 }],
    ['an over-long page', { ...INITIAL_MENU_STATE, page: 'x'.repeat(65) }]
  ])('rejects %s', (_label, value) => {
    expect(menuStateSchema.safeParse(value).success).toBe(false)
  })
})
