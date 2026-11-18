import { registerCacheClearer } from '../utils/daClient'

// Renderer-side cache for resolved .datf pack asset URLs. Without it, the sprite
// canvases re-invoke the `pack:resolveAsset` IPC — which base64-inflates a PNG
// across the bridge — on every cell render/scroll. Keyed by `${subtype}|${id}`;
// stores the in-flight Promise so concurrent/duplicate requests share one round
// trip and a resolved miss (null) isn't re-queried during a session.
const cache = new Map() // `${subtype}|${id}` → Promise<string|null>
// Item icons carry the dye rule of the pack that gives them (HTOO-695).
const itemIconCache = new Map() // id → Promise<{ url, dye } | null>
// Caches built from pack art elsewhere (the item bitmaps) drop with this one.
const dependentClearers = new Set()

/** Register a function that runs each time the pack caches are cleared. */
export function onPackCacheClear(fn) {
  dependentClearers.add(fn)
}

/** Resolve a pack asset URL, memoized. Returns null when no pack covers it. */
export function getPackAssetUrl(subtype, id) {
  const key = `${subtype}|${id}`
  let p = cache.get(key)
  if (!p) {
    p = window.electronAPI.resolvePackAsset(subtype, id).catch(() => null)
    cache.set(key, p)
  }
  return p
}

/**
 * Resolve an item sprite's pack icon and its dye rule, memoized. Returns
 * `{ url, dye }` (dye: 'never' | 'always' | 'detect') or null when no pack
 * has the id.
 */
export function getPackItemIcon(id) {
  let p = itemIconCache.get(id)
  if (!p) {
    p = window.electronAPI.resolvePackItemIcon(id).catch(() => null)
    itemIconCache.set(id, p)
  }
  return p
}

/**
 * Drop all cached pack URLs. Called when coverage is refreshed (a rescan may
 * add/replace overrides) and, via the client-cache registry, when clientPath
 * changes.
 */
export function clearPackAssetCache() {
  cache.clear()
  itemIconCache.clear()
  for (const fn of dependentClearers) fn()
}

registerCacheClearer(clearPackAssetCache)
