import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { GO_PAGES } from '@shared/appMenu.js'

// Structural guards for the macOS support. Both faults they catch produce a
// working app and a green gate on Windows, and show only on a Mac:
//
// 1. A page added to the toolbar and not to the Go menu (or the reverse). The
//    menu is a second list of the same pages, so it is compared with the toolbar's
//    `navigate(...)` calls rather than trusted to be kept in step.
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

describe('the Go menu and the nav toolbar list the same pages', () => {
  const toolbar = read(join(RENDERER, 'components', 'MainToolbar.jsx'))
  const toolbarPages = [...toolbar.matchAll(/navigate\('([^']+)'\)/g)].map((m) => m[1])
  const menuPages = GO_PAGES.filter(Boolean).map((p) => p.page)

  it('finds the toolbar pages (guard the guard)', () => {
    expect(toolbarPages.length).toBeGreaterThan(20)
  })

  it('has every toolbar page in the Go menu, in toolbar order, except Settings', () => {
    // Settings is in the app menu (⌘,), where macOS puts it.
    expect(toolbarPages.filter((p) => p !== 'settings')).toEqual(menuPages)
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
