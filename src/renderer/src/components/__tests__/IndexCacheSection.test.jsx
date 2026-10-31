/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import IndexCacheSection, { formatSize } from '../IndexCacheSection'

// Settings → World indexes (HTOO-583). Which caches are old is hybindex-ts's
// decision, tested in that package; this checks what the card does with the
// answer. The removal itself is driven through the built app in
// e2e/index-caches.spec.js.

const entry = (over) => ({
  dir: '/cache/v5/world-abc',
  schemaVersion: 5,
  worldKey: 'world-abc',
  libraryPath: '/worlds/world/xml',
  builtAt: '2026-10-30T00:00:00.000Z',
  sizeBytes: 2048,
  removeReason: null,
  ...over
})

const OLD_SCHEMA = entry({
  dir: '/cache/v4/world-abc',
  schemaVersion: 4,
  sizeBytes: 1536,
  removeReason: 'oldSchema'
})
const MOVED = entry({
  dir: '/cache/v5/old-def',
  worldKey: 'old-def',
  libraryPath: '/worlds/moved/xml',
  sizeBytes: 512,
  removeReason: 'missingWorld'
})

beforeEach(() => {
  window.electronAPI = {
    listIndexCaches: vi.fn(async () => [OLD_SCHEMA, entry(), MOVED]),
    pruneIndexCaches: vi.fn(async () => [OLD_SCHEMA, MOVED])
  }
})

afterEach(() => {
  cleanup()
  delete window.electronAPI
})

const click = (name) =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })

describe('IndexCacheSection', () => {
  it('removes nothing until asked: it lists first', async () => {
    render(<IndexCacheSection />)
    expect(window.electronAPI.listIndexCaches).not.toHaveBeenCalled()
    await click('Find old indexes')
    expect(window.electronAPI.pruneIndexCaches).not.toHaveBeenCalled()
  })

  it('lists only the caches that hybindex-ts marks, with the reason and the size', async () => {
    render(<IndexCacheSection />)
    await click('Find old indexes')
    const items = screen.getByTestId('old-index-list').querySelectorAll('li')
    expect([...items].map((li) => li.textContent)).toEqual([
      '/worlds/world/xml (v4, 1.5 KB): An older index version',
      '/worlds/moved/xml (v5, 512 B): The world folder is gone'
    ])
    expect(screen.getByRole('button', { name: /^Remove 2 \(2\.0 KB\)$/ })).toBeTruthy()
  })

  it('names a cache with no _meta.json by its folder', async () => {
    window.electronAPI.listIndexCaches = vi.fn(async () => [
      entry({ libraryPath: null, worldKey: 'lost-123', removeReason: 'missingWorld' })
    ])
    render(<IndexCacheSection />)
    await click('Find old indexes')
    expect(screen.getByTestId('old-index-list').textContent).toContain('lost-123')
  })

  it('removes on the Remove button and says what it removed', async () => {
    render(<IndexCacheSection />)
    await click('Find old indexes')
    await click(/^Remove 2/)
    expect(window.electronAPI.pruneIndexCaches).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Removed 2 old indexes (2.0 KB).')).toBeTruthy()
    expect(screen.queryByTestId('old-index-list')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull()
  })

  it('says so when there is nothing to remove, and offers no Remove', async () => {
    window.electronAPI.listIndexCaches = vi.fn(async () => [entry()])
    render(<IndexCacheSection />)
    await click('Find old indexes')
    expect(screen.getByText('No old indexes.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull()
  })

  it('formats sizes', () => {
    expect(formatSize(0)).toBe('0 B')
    expect(formatSize(1023)).toBe('1023 B')
    expect(formatSize(2560)).toBe('2.5 KB')
    expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})
