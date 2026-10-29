import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { GO_PAGES } from '@shared/appMenu.js'
import { BAR_PAGES, MENU_PAGES, NAV_ICONS } from '../components/navPages'

// Structural guards for the macOS support. Both faults they catch produce a
// working app and a green gate on Windows, and show only on a Mac:
//
// 1. A page added to the toolbar and not to the Go menu (or the reverse). The
//    toolbar now builds from the Go menu's list, so this checks the split into
//    buttons and the More menu, and the icons.
// 2. A new `ctrlKey || metaKey`. On macOS that steals ⌃K and ⌃P from every text
//    field, and a Control-click there is a right-click. utils/modKey.js is the
//    one place that decides; every other key or click test must go through it.

const RENDERER = join(__dirname, '..')
const read = (p) => readFileSync(p, 'utf8')

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : sourceFiles(p)
    return /\.(js|jsx)$/.test(name) ? [p] : []
  })
}

// The toolbar builds its buttons and its More menu from GO_PAGES (navPages.js),
// so the lists agree by construction. What can still drift is the split and the
// icons: a page in neither place, a page in both, or a page with no icon, which
// renders nothing. And the toolbar must not go back to its own navigate('...')
// list, which is the second copy this check used to compare.
describe('the Go menu and the nav toolbar list the same pages', () => {
  const toolbar = read(join(RENDERER, 'components', 'MainToolbar.jsx'))
  const toolbarPages = [...BAR_PAGES, ...MENU_PAGES].map((p) => p.page)
  const menuPages = GO_PAGES.filter(Boolean).map((p) => p.page)

  it('finds the toolbar pages (guard the guard)', () => {
    expect(toolbarPages.length).toBeGreaterThan(20)
  })

  it('has every toolbar page in the Go menu, in toolbar order, except Settings', () => {
    // Settings is in the app menu (⌘,), where macOS puts it.
    expect(toolbarPages.filter((p) => p !== 'settings')).toEqual(menuPages)
  })

  it('gives every page an icon, and no icon to a page that is not there', () => {
    expect(Object.keys(NAV_ICONS).sort()).toEqual([...toolbarPages].sort())
  })

  it('builds the bar from the list, not from its own navigate calls', () => {
    expect([...toolbar.matchAll(/navigate\('([^']+)'\)/g)].map((m) => m[1])).toEqual([])
  })
})

describe('no hand-rolled command-key test in the renderer', () => {
  const files = sourceFiles(RENDERER)
  const pattern = /ctrlKey\s*\|\|\s*\w+\.metaKey|metaKey\s*\|\|\s*\w+\.ctrlKey/

  it('walks the renderer source (guard the guard)', () => {
    expect(files.length).toBeGreaterThan(100)
    expect(files.some((f) => f.endsWith(join('utils', 'modKey.js')))).toBe(true)
  })

  it('leaves `ctrlKey || metaKey` to utils/modKey.js', () => {
    const offenders = files
      .filter((f) => !f.endsWith(join('utils', 'modKey.js')))
      .filter((f) => pattern.test(read(f)))
      .map((f) => relative(RENDERER, f))
    expect(offenders, 'use isModKey(e, window.electronAPI.platform) from utils/modKey.js').toEqual(
      []
    )
  })
})
