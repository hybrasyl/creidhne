import { describe, it, expect, vi, beforeEach } from 'vitest'

// registerCacheClearer runs at module load; stub it so importing the cache has
// no side effects on the shared client-cache registry.
vi.mock('../utils/daClient', () => ({ registerCacheClearer: () => {} }))

import { getPackAssetUrl, clearPackAssetCache } from '../data/packAssetCache'

// Tests run in the node environment; provide a minimal window global (the
// module reads window.electronAPI, which is the preload bridge in the renderer).
beforeEach(() => {
  globalThis.window = globalThis.window || {}
  clearPackAssetCache()
})

describe('packAssetCache', () => {
  it('memoizes by subtype|id — one IPC per distinct key', async () => {
    const resolve = vi.fn().mockResolvedValue('data:url')
    window.electronAPI = { resolvePackAsset: resolve }

    expect(await getPackAssetUrl('spell', 1)).toBe('data:url')
    expect(await getPackAssetUrl('spell', 1)).toBe('data:url')
    expect(resolve).toHaveBeenCalledTimes(1)

    await getPackAssetUrl('spell', 2)
    expect(resolve).toHaveBeenCalledTimes(2)
  })

  it('re-fetches after the cache is cleared', async () => {
    const resolve = vi.fn().mockResolvedValue('u')
    window.electronAPI = { resolvePackAsset: resolve }

    await getPackAssetUrl('nation', 5)
    clearPackAssetCache()
    await getPackAssetUrl('nation', 5)
    expect(resolve).toHaveBeenCalledTimes(2)
  })

  it('resolves a rejected lookup to null and caches the miss', async () => {
    const resolve = vi.fn().mockRejectedValue(new Error('boom'))
    window.electronAPI = { resolvePackAsset: resolve }

    expect(await getPackAssetUrl('sfx', 9)).toBeNull()
    await getPackAssetUrl('sfx', 9)
    expect(resolve).toHaveBeenCalledTimes(1)
  })
})
