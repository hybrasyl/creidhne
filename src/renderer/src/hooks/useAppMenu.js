import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { useMenuStore } from '../store/menuStore'
import { useCompanionStatus } from './useCompanionStatus'

/**
 * The renderer half of the macOS application menu: run a menu command, and report
 * what the menu greys out and marks. Each command runs the same action as its
 * button. See src/main/appMenu.js for the menu itself.
 *
 * `actions.navigate` is App's guarded navigate, the one the toolbar uses, so a Go
 * command over a dirty editor asks about the unsaved edits first.
 * `actions.launchCompanion` is the toolbar's launch, with its re-check.
 */
export function runMenuCommand(msg, actions) {
  // Nothing while a modal is open. A page change would unmount the page under a
  // dialog that belongs to it, and lose what was typed there. A Mac app disables
  // its menu behind a sheet the same way. The standard roles (Copy, Paste, Quit)
  // are main's and still work.
  if (isModalOpen()) return
  const command = msg?.command
  if (typeof command !== 'string') return
  const store = useAppStore.getState()
  const request = useMenuStore.getState().request

  if (command.startsWith('go:')) {
    actions.navigate(command.slice(3))
    return
  }
  switch (command) {
    case 'settings':
      actions.navigate('settings')
      return
    case 'about':
    case 'whatsNew':
      // Both dialogs belong to SettingsPage, which takes the request when it mounts.
      request(command)
      actions.navigate('settings')
      return
    case 'save':
      // The same save the unsaved-changes dialog runs. A failed save shows its own
      // error in the editor, so there is nothing to add here.
      void Promise.resolve(store.dirtyEditor?.onSave?.()).catch(() => {})
      return
    case 'launchCompanion':
      void actions.launchCompanion()
      return
    case 'toggleReferencePanel':
      store._set('referencePanelOpen', (open) => !open)
      return
    case 'reportIssue':
      store._set('reportIssueOpen', true)
      return
  }
}

/**
 * An open MUI `Modal`: a dialog, a menu or a popover. A closed one is unmounted,
 * or carries `MuiModal-hidden` when it is kept mounted.
 */
export function isModalOpen(doc = document) {
  return doc.querySelector('.MuiModal-root:not(.MuiModal-hidden)') !== null
}

/** What the menu greys out and marks, from the store. */
export function currentMenuState({ companionFound }) {
  const s = useAppStore.getState()
  return {
    page: s.currentPage,
    canSave: !!s.dirtyEditor,
    canLaunchCompanion: !!companionFound,
    referencePanelOpen: !!s.referencePanelOpen
  }
}

/**
 * Wire the menu once settings have hydrated: run its commands, and report its
 * state when it changes (sent only when it differs). macOS only. Elsewhere there
 * is no menu to drive, and the companion is not asked about a second time.
 */
export function useAppMenu(enabled, navigate) {
  const isMac = window.electronAPI?.platform === 'darwin'
  const active = enabled && isMac
  const { found: companionFound, refresh: refreshCompanion } = useCompanionStatus({
    enabled: active
  })

  // Read at run time, so a command sees the current navigate and companion answer
  // without re-subscribing on every render.
  const navigateRef = useRef(navigate)
  const foundRef = useRef(companionFound)
  const refreshRef = useRef(refreshCompanion)
  useEffect(() => {
    navigateRef.current = navigate
    foundRef.current = companionFound
    refreshRef.current = refreshCompanion
  })

  // The command listener, once.
  useEffect(() => {
    if (!active) return
    const actions = {
      navigate: (page) => navigateRef.current(page),
      launchCompanion: async () => {
        await window.electronAPI.launchCompanion()
        // A launch is the moment a target can turn out to have gone missing.
        refreshRef.current()
      }
    }
    return window.electronAPI.menu.onCommand((msg) => runMenuCommand(msg, actions))
  }, [active])

  // The state report: on every store change, and when the companion answer changes.
  const lastRef = useRef('')
  useEffect(() => {
    if (!active) return
    const report = () => {
      const state = currentMenuState({ companionFound: foundRef.current })
      const json = JSON.stringify(state)
      if (json === lastRef.current) return
      lastRef.current = json
      window.electronAPI.menu.setState(state)
    }
    report()
    return useAppStore.subscribe(report)
  }, [active, companionFound])
}
