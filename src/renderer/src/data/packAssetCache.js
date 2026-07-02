import { registerCacheClearer } from '../utils/daClient'

// Renderer-side cache for resolved .datf pack asset URLs. Without it, the sprite
// canvases re-invoke the `pack:resolveAsset` IPC — which base64-inflates a PNG
// across the bridge — on every cell render/scroll. Keyed by `${subtype}|${id}`;
// stores the in-flight Promise so concurrent/duplicate requests share one round
// trip and a resolved miss (null) isn't re-queried during a session.
const cache = new Map() // `${subtype}|${id}` → Promise<string|null>

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
 * Drop all cached pack URLs. Called when coverage is refreshed (a rescan may
 * add/replace overrides) and, via the client-cache registry, when clientPath
 * changes.
 */
export function clearPackAssetCache() {
  cache.clear()
}

registerCacheClearer(clearPackAssetCache)
