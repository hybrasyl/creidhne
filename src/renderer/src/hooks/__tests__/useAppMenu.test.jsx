/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, renderHook, act, cleanup, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { useAppStore } from '../../store/appStore'
import { useMenuStore } from '../../store/menuStore'
import { runMenuCommand, isModalOpen, currentMenuState, useAppMenu } from '../useAppMenu'
import { useMenuRequest } from '../useMenuRequest'
import MainToolbar from '../../components/MainToolbar'
import { hybrasylTheme } from '../../themes'

// The renderer half of the macOS menu. jsdom does not apply media queries, so the
// title bar's padding is asserted in e2e (title-bar.spec.js), not here.

const initialApp = useAppStore.getState()

function bridge(platform) {
  const listeners = new Set()
  window.electronAPI = {
    platform,
    companionStatus: vi.fn().mockResolvedValue({ resolved: null, staleOverride: false }),
    launchCompanion: vi.fn().mockResolvedValue(undefined),
    menu: {
      setState: vi.fn(),
      onCommand: vi.fn((cb) => {
        listeners.add(cb)
        return () => listeners.delete(cb)
      })
    }
  }
  return { emit: (msg) => listeners.forEach((cb) => cb(msg)), listeners }
}

beforeEach(() => {
  useAppStore.setState(initialApp, true)
  useMenuStore.setState({ pending: {} })
  bridge('win32')
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  delete window.electronAPI
})

describe('runMenuCommand', () => {
  const actions = () => ({ navigate: vi.fn(), launchCompanion: vi.fn() })

  it('sends a Go command through the guarded navigate, not straight to the store', () => {
    const a = actions()
    runMenuCommand({ command: 'go:items' }, a)
    expect(a.navigate).toHaveBeenCalledWith('items')
    expect(useAppStore.getState().currentPage).toBe('dashboard')
  })

  it('does nothing while a modal is open', () => {
    const modal = document.createElement('div')
    modal.className = 'MuiModal-root'
    document.body.appendChild(modal)
    expect(isModalOpen()).toBe(true)
    const a = actions()
    runMenuCommand({ command: 'go:items' }, a)
    runMenuCommand({ command: 'reportIssue' }, a)
    expect(a.navigate).not.toHaveBeenCalled()
    expect(useAppStore.getState().reportIssueOpen).toBe(false)
  })

  it('treats a hidden, kept-mounted modal as closed', () => {
    const modal = document.createElement('div')
    modal.className = 'MuiModal-root MuiModal-hidden'
    document.body.appendChild(modal)
    expect(isModalOpen()).toBe(false)
  })

  it.each(['about', 'whatsNew'])('%s leaves a request and goes to Settings', (command) => {
    const a = actions()
    runMenuCommand({ command }, a)
    expect(a.navigate).toHaveBeenCalledWith('settings')
    expect(useMenuStore.getState().pending[command]).toBeDefined()
  })

  it('saves through the dirty editor', () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    useAppStore.setState({ dirtyEditor: { label: 'Items', onSave } })
    runMenuCommand({ command: 'save' }, actions())
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('does not throw when Save comes with no dirty editor, or the save rejects', async () => {
    expect(() => runMenuCommand({ command: 'save' }, actions())).not.toThrow()
    useAppStore.setState({
      dirtyEditor: { onSave: vi.fn().mockRejectedValue(new Error('disk full')) }
    })
    runMenuCommand({ command: 'save' }, actions())
    await Promise.resolve()
  })

  it('toggles the reference panel, opens Report an Issue and launches Taliesin', () => {
    const a = actions()
    runMenuCommand({ command: 'toggleReferencePanel' }, a)
    expect(useAppStore.getState().referencePanelOpen).toBe(true)
    runMenuCommand({ command: 'reportIssue' }, a)
    expect(useAppStore.getState().reportIssueOpen).toBe(true)
    runMenuCommand({ command: 'launchCompanion' }, a)
    expect(a.launchCompanion).toHaveBeenCalledTimes(1)
  })

  it('ignores a message with no command', () => {
    expect(() => runMenuCommand(undefined, actions())).not.toThrow()
    expect(() => runMenuCommand({ command: 7 }, actions())).not.toThrow()
  })
})

describe('currentMenuState', () => {
  it('reads the page, the dirty editor and the panel from the store', () => {
    useAppStore.setState({
      currentPage: 'loot',
      dirtyEditor: { onSave: () => {} },
      referencePanelOpen: true
    })
    expect(currentMenuState({ companionFound: true })).toEqual({
      page: 'loot',
      canSave: true,
      canLaunchCompanion: true,
      referencePanelOpen: true
    })
  })
})

describe('useMenuRequest', () => {
  it('runs a request made before the component mounted, once', () => {
    useMenuStore.getState().request('about')
    const handler = vi.fn()
    const { rerender } = renderHook(() => useMenuRequest('about', handler))
    expect(handler).toHaveBeenCalledTimes(1)
    rerender()
    expect(handler).toHaveBeenCalledTimes(1)
    expect(useMenuStore.getState().pending.about).toBeUndefined()
  })

  it('runs a repeat request again, and leaves other commands alone', () => {
    const about = vi.fn()
    const whatsNew = vi.fn()
    renderHook(() => {
      useMenuRequest('about', about)
      useMenuRequest('whatsNew', whatsNew)
    })
    act(() => useMenuStore.getState().request('about'))
    act(() => useMenuStore.getState().request('about'))
    expect(about).toHaveBeenCalledTimes(2)
    expect(whatsNew).not.toHaveBeenCalled()
  })

  it('runs nothing after clear(), which a cancelled navigation calls', () => {
    useMenuStore.getState().request('about')
    useMenuStore.getState().clear()
    const handler = vi.fn()
    renderHook(() => useMenuRequest('about', handler))
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('useAppMenu', () => {
  it('on macOS: reports the state, re-reports on a change, and runs commands', async () => {
    const { emit } = bridge('darwin')
    const navigate = vi.fn()
    renderHook(() => useAppMenu(true, navigate))
    await act(async () => {})
    const { setState } = window.electronAPI.menu
    expect(setState).toHaveBeenLastCalledWith({
      page: 'dashboard',
      canSave: false,
      canLaunchCompanion: false,
      referencePanelOpen: false
    })

    const calls = setState.mock.calls.length
    act(() => useAppStore.setState({ settingsSavedNonce: 5 })) // irrelevant to the menu
    expect(setState.mock.calls.length).toBe(calls)
    act(() => useAppStore.setState({ currentPage: 'items' }))
    expect(setState).toHaveBeenLastCalledWith(expect.objectContaining({ page: 'items' }))

    act(() => emit({ command: 'go:recipes' }))
    expect(navigate).toHaveBeenCalledWith('recipes')
  })

  it('on macOS: waits for settings to hydrate', () => {
    bridge('darwin')
    renderHook(() => useAppMenu(false, vi.fn()))
    expect(window.electronAPI.menu.setState).not.toHaveBeenCalled()
    expect(window.electronAPI.menu.onCommand).not.toHaveBeenCalled()
  })

  it.each(['win32', 'linux'])('on %s: does nothing, and does not ask about Taliesin', (p) => {
    bridge(p)
    renderHook(() => useAppMenu(true, vi.fn()))
    expect(window.electronAPI.menu.setState).not.toHaveBeenCalled()
    expect(window.electronAPI.menu.onCommand).not.toHaveBeenCalled()
    expect(window.electronAPI.companionStatus).not.toHaveBeenCalled()
  })
})

describe('MainToolbar title bar', () => {
  const renderToolbar = () =>
    render(
      <ThemeProvider theme={hybrasylTheme}>
        <MainToolbar navigate={vi.fn()} />
      </ThemeProvider>
    )

  it('on macOS: an empty bar for the stoplights, with no logo, name or window buttons', async () => {
    bridge('darwin')
    renderToolbar()
    await act(async () => {})
    const bar = screen.getByTestId('title-bar')
    expect(bar.children.length).toBe(0)
    expect(screen.queryByAltText('Creidhne')).toBeNull()
    expect(screen.queryByText('Creidhne')).toBeNull()
    expect(screen.queryByLabelText('Close')).toBeNull()
  })

  it('elsewhere: the logo, the name and the three window buttons', async () => {
    bridge('win32')
    renderToolbar()
    await act(async () => {})
    expect(screen.getByAltText('Creidhne')).toBeTruthy()
    expect(screen.getByText('Creidhne')).toBeTruthy()
    for (const name of ['Minimize', 'Maximize', 'Close']) {
      expect(screen.getByLabelText(name)).toBeTruthy()
    }
  })
})
