// Sound data layer.
//
// Sounds live as MP3 entries inside legend.dat, identified by a numeric id
// extracted from each entry's filename (e.g. "snd0042.mp3" → id 42).
//
// Playback uses a single module-level Audio element so starting a new sound
// automatically stops the previous one. Blob URLs are cached per id and
// revoked on cache clear.

import { useState, useEffect } from 'react'
import { loadArchive, registerCacheClearer } from '../utils/daClient'
import { useStoreValue, clientPathState } from '../store/appStore'

const indexCache = new Map() // clientPath → number[] (sorted ids)
const blobUrlCache = new Map() // `${clientPath}|${id}` → blob URL
const packBlobUrlCache = new Map() // sfx id → blob URL (Hybrasyl pack override)

// Reuse a single HTMLAudioElement across plays; mirrors Taliesin's pattern
// and sidesteps subtle issues with per-play Audio instances in Electron.
let audioEl = null
let currentPlayingId = null
const playbackListeners = new Set() // subscribers get notified when playback starts/stops

function notify() {
  for (const fn of playbackListeners) fn(currentPlayingId)
}

function getAudioElement() {
  if (!audioEl) audioEl = new Audio()
  return audioEl
}

/**
 * Enumerate MP3 entries in legend.dat. Returns a sorted array of numeric ids.
 * Result is cached per clientPath.
 */
export async function getSoundIndex(clientPath) {
  if (!clientPath) return []
  const cached = indexCache.get(clientPath)
  if (cached) return cached
  const archive = await loadArchive(clientPath, 'legend.dat')
  const entries = archive.getEntriesByExtension('.mp3')
  const ids = []
  for (const entry of entries) {
    const n = entry.tryGetNumericIdentifier()
    if (n !== null && n >= 0) ids.push(n)
  }
  ids.sort((a, b) => a - b)
  indexCache.set(clientPath, ids)

  console.log(`[soundData] loaded ${ids.length} sound entries from legend.dat`)
  return ids
}

/**
 * Resolve a sound id to a blob URL (lazy, cached).
 * Returns null if the id isn't present in legend.dat.
 */
export async function getSoundBlobUrl(clientPath, id) {
  if (!clientPath || id == null) return null
  const key = `${clientPath}|${id}`
  const cached = blobUrlCache.get(key)
  if (cached) return cached

  const archive = await loadArchive(clientPath, 'legend.dat')
  const entries = archive.getEntriesByExtension('.mp3')
  const entry = entries.find((e) => e.tryGetNumericIdentifier() === Number(id))
  if (!entry) return null

  // entry.toUint8Array() returns a subarray view into the full archive
  // buffer. Force a copy into a fresh ArrayBuffer so the Blob owns standalone
  // bytes (mirrors what Taliesin's IPC-serialized path gets for free).
  const view = entry.toUint8Array()
  const copy = new Uint8Array(view.byteLength)
  copy.set(view)
  const blob = new Blob([copy], { type: 'audio/mpeg' })
  const url = URL.createObjectURL(blob)
  blobUrlCache.set(key, url)
  return url
}

// Decode a `data:<mime>;base64,…` URL into a Blob. The pack IPC returns a data
// URL, but the app CSP only allows `media-src 'self' blob:` (no `data:`), so
// audio must be played from a blob: URL — same as the vanilla legend.dat path.
function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return null
  const header = dataUrl.slice(0, comma)
  const mime = header.slice(5, header.indexOf(';')) || 'application/octet-stream' // after "data:"
  const bin = atob(dataUrl.slice(comma + 1))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/**
 * Resolve a Hybrasyl pack sound override to a blob URL (lazy, cached).
 * Returns null if no active pack covers this sfx id.
 */
async function getPackSoundBlobUrl(id) {
  const key = Number(id)
  const cached = packBlobUrlCache.get(key)
  if (cached) return cached
  const dataUrl = await window.electronAPI.resolvePackAssetUrl('sfx', id)
  if (!dataUrl) return null
  const blob = dataUrlToBlob(dataUrl)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  packBlobUrlCache.set(key, url)
  return url
}

// Shared playback body: point the single audio element at `url`, wire the
// end/error handlers, and mark `id` as the currently-playing sound. Used by
// both vanilla (legend.dat blob) and Hybrasyl (pack blob) playback.
async function playUrl(url, id, label) {
  const audio = getAudioElement()
  audio.src = url
  audio.onended = () => {
    if (currentPlayingId === Number(id)) {
      currentPlayingId = null
      notify()
    }
  }
  audio.onerror = () => {
    console.warn(`[soundData] ${label} playback error for id ${id}:`, audio.error)
    if (currentPlayingId === Number(id)) {
      currentPlayingId = null
      notify()
    }
  }
  currentPlayingId = Number(id)
  notify()
  try {
    await audio.play()
    return true
  } catch (err) {
    console.warn(`[soundData] ${label} audio.play() rejected for id ${id}:`, err)
    if (currentPlayingId === Number(id)) {
      currentPlayingId = null
      notify()
    }
    return false
  }
}

/**
 * Play a vanilla sound from legend.dat. Stops any currently-playing sound first.
 * Returns true if playback started, false otherwise.
 */
export async function playSound(clientPath, id) {
  stopSound()
  const url = await getSoundBlobUrl(clientPath, id)
  if (!url) return false
  return playUrl(url, id, 'vanilla')
}

/**
 * Play a Hybrasyl sound-effect override from an active .datf pack, falling back
 * to the vanilla legend.dat sound if no pack covers this id. Stops any
 * currently-playing sound first. Returns true if playback started.
 */
export async function playPackSound(clientPath, id) {
  stopSound()
  const url = await getPackSoundBlobUrl(id)
  if (!url) return playSound(clientPath, id)
  return playUrl(url, id, 'pack')
}

export function stopSound() {
  if (!audioEl) {
    currentPlayingId = null
    notify()
    return
  }
  audioEl.pause()
  try {
    audioEl.currentTime = 0
  } catch {
    /* ignore if not seekable yet */
  }
  currentPlayingId = null
  notify()
}

/**
 * React hook — returns the id of the currently playing sound (or null).
 * Components can use this to toggle play/stop button state.
 */
export function useCurrentlyPlayingSound() {
  const [id, setId] = useState(currentPlayingId)
  useEffect(() => {
    playbackListeners.add(setId)
    return () => {
      playbackListeners.delete(setId)
    }
  }, [])
  return id
}

/**
 * React hook — returns the sorted sound id array for the current clientPath,
 * or null while loading / if clientPath is unset.
 */
export function useSoundIndex() {
  const clientPath = useStoreValue(clientPathState)
  const [ids, setIds] = useState(() => indexCache.get(clientPath) || null)

  useEffect(() => {
    if (!clientPath) {
      setIds(null)
      return undefined
    }
    let cancelled = false
    getSoundIndex(clientPath)
      .then((result) => {
        if (!cancelled) setIds(result)
      })
      .catch(() => {
        if (!cancelled) setIds(null)
      })
    return () => {
      cancelled = true
    }
  }, [clientPath])

  return ids
}

export function clearSoundCache() {
  stopSound()
  for (const url of blobUrlCache.values()) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      /* ignore */
    }
  }
  for (const url of packBlobUrlCache.values()) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      /* ignore */
    }
  }
  blobUrlCache.clear()
  packBlobUrlCache.clear()
  indexCache.clear()
}
registerCacheClearer(clearSoundCache)
