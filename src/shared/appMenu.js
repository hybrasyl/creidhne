// The macOS application menu. Main builds the menu. A Creidhne item sends its
// command to the renderer, which runs the same action as the matching button.
// Both sides read the command and page names from here, so they cannot disagree.
//
// No imports. The sandboxed preload imports the channel names from this file, and
// a sandboxed preload can load only `electron`. That is why the state schema (zod)
// is in src/main/appMenu.js and not here.
//
// The house design is docs/architecture/macos-chrome.md in the document repo.
// Mabon is the reference implementation.

/** Main → renderer: a Creidhne menu item was chosen. */
export const MENU_COMMAND_CHANNEL = 'menu:command'
/** Renderer → main: what the menu greys out and marks (`MenuState`). */
export const MENU_STATE_CHANNEL = 'app:setMenuState'

/**
 * The pages the Go menu lists, in the nav toolbar's order. `null` is a separator.
 * ⌘1 to ⌘9 go to the first nine pages. Settings is not here: it is in the app
 * menu (⌘,), where macOS puts it. appMenuPages.test.js compares this list with
 * the toolbar's `navigate(...)` calls, so a new page that is in one and not the
 * other fails the suite.
 */
export const GO_PAGES = [
  { page: 'dashboard', label: 'Dashboard' },
  null,
  { page: 'castables', label: 'Castables' },
  { page: 'items', label: 'Items' },
  { page: 'statuses', label: 'Statuses' },
  { page: 'npcs', label: 'NPCs' },
  { page: 'creatures', label: 'Creatures' },
  { page: 'behaviors', label: 'Behavior Sets' },
  { page: 'spellbooks', label: 'Spellbooks' },
  { page: 'nations', label: 'Nations' },
  { page: 'traits', label: 'Traits' },
  { page: 'spawngroups', label: 'Spawngroups' },
  { page: 'loot', label: 'Loot Sets' },
  { page: 'variants', label: 'Variants' },
  { page: 'elements', label: 'Elements' },
  { page: 'recipes', label: 'Recipes' },
  { page: 'strings', label: 'Strings' },
  { page: 'serverconfig', label: 'Server Config' },
  null,
  { page: 'formulas', label: 'Formulas' },
  { page: 'damage-calculator', label: 'Damage Calculator' },
  { page: 'helpers', label: 'Lua Helpers' },
  { page: 'dialogs', label: 'Dialog Builder' },
  { page: 'exports', label: 'Reports' },
  { page: 'constants', label: 'Constants' }
]

/**
 * What the menu greys out and marks. Main validates it (`menuStateSchema` in
 * src/main/appMenu.js).
 *
 * - `page`: the page on screen. The Go menu marks it.
 * - `canSave`: an editor has unsaved edits. Save runs the same save as the
 *   unsaved-changes dialog.
 * - `canLaunchCompanion`: Taliesin was found. The toolbar's anvil is enabled.
 * - `referencePanelOpen`: the reference panel is open. The View item shows it.
 */
export const INITIAL_MENU_STATE = {
  page: 'dashboard',
  canSave: false,
  canLaunchCompanion: false,
  referencePanelOpen: false
}
