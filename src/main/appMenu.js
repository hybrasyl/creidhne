import { z } from 'zod'
import { GO_PAGES } from '../shared/appMenu.js'

/**
 * The macOS application menu, in place of Electron's default one. The default
 * View menu has Reload and Force Reload, which drop every unsaved edit in the
 * renderer, and Toggle Developer Tools. macOS only: Windows and Linux are
 * frameless with the renderer's own buttons, and a menu there would register its
 * accelerators too.
 *
 * Pure: the template comes from the renderer's last `MenuState`. A Creidhne item
 * calls `send`, and the renderer runs the same action as the matching button.
 * Standard items are Electron roles. Chromium gives a key to the page first, and
 * to the menu only when the page does not `preventDefault` it.
 */

/** The renderer's report. A bad report is dropped, and the menu keeps the last one. */
export const menuStateSchema = z.object({
  page: z.string().max(64),
  canSave: z.boolean(),
  canLaunchCompanion: z.boolean(),
  referencePanelOpen: z.boolean()
})

/**
 * @param {import('../shared/appMenu.js').INITIAL_MENU_STATE} state
 * @param {{ appName: string, isDev: boolean, send: (msg: { command: string }) => void }} options
 * @returns {import('electron').MenuItemConstructorOptions[]}
 */
export function buildMenuTemplate(state, { appName, isDev, send }) {
  const item = (label, command, extra = {}) => ({
    label,
    id: command,
    click: () => send({ command }),
    ...extra
  })
  const sep = { type: 'separator' }

  let shortcut = 0
  const goItems = GO_PAGES.map((entry) => {
    if (!entry) return sep
    shortcut += 1
    return item(entry.label, `go:${entry.page}`, {
      type: 'checkbox',
      checked: state.page === entry.page,
      ...(shortcut <= 9 ? { accelerator: `Cmd+${shortcut}` } : {})
    })
  })

  return [
    {
      // The role labels are set by hand. The roles read `app.name`, which comes
      // from package.json's `productName ?? name`, and Creidhne's package.json has
      // no productName (it is in electron-builder.yml). So a packaged build would
      // read "Quit creidhne".
      label: appName,
      submenu: [
        item(`About ${appName}`, 'about'),
        sep,
        item('Settings…', 'settings', { accelerator: 'Cmd+,' }),
        sep,
        { role: 'services' },
        sep,
        { role: 'hide', label: `Hide ${appName}` },
        { role: 'hideOthers' },
        { role: 'unhide' },
        sep,
        { role: 'quit', label: `Quit ${appName}` }
      ]
    },
    {
      label: 'File',
      submenu: [
        item('Save', 'save', { accelerator: 'Cmd+S', enabled: state.canSave }),
        sep,
        item('Launch Taliesin', 'launchCompanion', { enabled: state.canLaunchCompanion }),
        sep,
        // Creidhne has no tabs, so ⌘W is the window's. Its close keeps the
        // unsaved-changes guard: the window's `close` event asks the renderer.
        { role: 'close' }
      ]
    },
    // Keep it: without an Edit menu, ⌘C, ⌘V and ⌘A stop working in text fields.
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        item('Reference Panel', 'toggleReferencePanel', {
          type: 'checkbox',
          checked: state.referencePanelOpen
        }),
        sep,
        // No zoom items: `optimizer.watchWindowShortcuts` blocks the zoom keys in
        // every build, which stops a menu accelerator too.
        { role: 'togglefullscreen' },
        ...(isDev ? [sep, { role: 'toggleDevTools' }] : [])
      ]
    },
    { label: 'Go', submenu: goItems },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [item('Report an Issue…', 'reportIssue'), item("What's New", 'whatsNew')]
    }
  ]
}
