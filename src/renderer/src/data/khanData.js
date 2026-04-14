// Display sprite (khan) data layer.
//
// Worn equipment sprites live across 11 archives:
//   khan{m|w}{ad|eh|im|ns|tz}.dat — per-gender, per-letter-range
//   khanpal.dat                    — palettes + per-category palette tables
//
// Entry naming: {gender}{category}{id:3-digit}{pose}.epf
//   gender   = M or W
//   category = A..Z
//   id       = 0..999 (3-digit, zero-padded)
//   pose     = '01' | '02' | '03' | 'b' | 'c' | 'd' | 'e' | 'f'
//
// Inside khanpal.dat:
//   pal{category}{NNN}.pal  — palette files
//   pal{category}.tbl       — per-category palette table (optional per category)
//
// Default render convention: pose '03', frame index 5.

import { EpfFile, PaletteLookup, renderEpf } from '@eriscorp/dalib-ts'
import { toImageData } from '@eriscorp/dalib-ts/helpers/imageData'
import { loadArchive, registerCacheClearer } from '../utils/daClient'

const PALETTE_ARCHIVE = 'khanpal.dat'

// Per-category render defaults. Each category has its own canonical pose
// and the frame index inside that pose that represents a "clean still."
// Fill in these as you learn them; the GLOBAL fallback is used otherwise.
const GLOBAL_DEFAULT = { pose: '03', frameIdx: 5 }
export const CATEGORY_DEFAULTS = {
  U: { pose: '03', frameIdx: 5 }, // Body Armor
  W: { pose: '01', frameIdx: 0 }, // Weapons
  S: { pose: '01', frameIdx: 6 }, // Shields
  L: { pose: '03', frameIdx: 5 }, // Boots (Foot)
  E: { pose: '03', frameIdx: 5 }, // Hats (Coat slot)
  // C: accessories — use global default until confirmed.
}

function defaultsFor(category) {
  const first = Array.isArray(category) ? category[0] : category
  return CATEGORY_DEFAULTS[String(first || '').toUpperCase()] || GLOBAL_DEFAULT
}

// Fallback order when the requested pose isn't present for a specific sprite.
const POSE_FALLBACK_ORDER = ['03', '02', '01', 'b', 'c', 'd', 'e', 'f']

// Equipment slot → category letter mapping.
//
// Category reference (from khan archive archaeology):
//   A = Arms          B = Body states   C = Accessories
//   E = Hats (Coat)   F = Hats (Coat?)  G = Accessories (alt)
//   H = Hairstyles    L = Boots         M = Body Colors
//   N = Leotard?      O = Heads         P = Weapon Skins
//   S = Shields       U = Body Armors   W = Weapons
//
// Unmapped slots render as "No khan mapping" placeholder; manual entry still
// works. Fill in here as discovered.
// Slot → category. Value may be a single letter or an array of letters when
// a slot's sprites live across multiple categories (merged in the picker).
export const SLOT_TO_CATEGORY = {
  Armor:     'U',       // Body Armors
  Weapon:    'W',       // Weapons, regular animations
  Shield:    'S',
  Foot:      'L',       // Boots
  Coat:      ['E', 'F'], // Hats — both categories hold coat-slot hats
  Helmet:    'H',       // Hats (in DA, hairstyles ARE hats)
  Trousers:  'U',       // Body armors — same sprites as Armor slot
  FirstAcc:  'C',       // Accessories
  SecondAcc: 'C',
  ThirdAcc:  'C',
}

/** Normalize a slot mapping value (string | array) to an array of category letters. */
export function categoriesFor(slot) {
  const v = SLOT_TO_CATEGORY[slot]
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

// category letter → { start, end, suffix } of the khan archive that covers it.
const KHAN_RANGES = [
  { start: 'A', end: 'D', suffix: 'ad' },
  { start: 'E', end: 'H', suffix: 'eh' },
  { start: 'I', end: 'M', suffix: 'im' },
  { start: 'N', end: 'S', suffix: 'ns' },
  { start: 'T', end: 'Z', suffix: 'tz' },
]

function khanArchiveName(category, gender) {
  const letter = String(category || '').toUpperCase()
  const g = String(gender || '').toLowerCase()
  if (!letter || (g !== 'm' && g !== 'w')) return null
  const range = KHAN_RANGES.find((r) => letter >= r.start && letter <= r.end)
  if (!range) return null
  return `khan${g}${range.suffix}.dat`
}

function entryName(category, gender, displaySprite, pose) {
  const id = String(Number(displaySprite)).padStart(3, '0')
  return `${gender.toUpperCase()}${category.toUpperCase()}${id}${pose}.epf`
}

// ── Caches (keyed by clientPath so a path change clears everything) ───────────
const paletteLookupCache = new Map() // `${clientPath}|${category}` → PaletteLookup
const epfCache           = new Map() // `${clientPath}|${entryName}` → EpfFile
const bitmapCache        = new Map() // `${clientPath}|${entryName}|${frameIdx}` → ImageBitmap
const availableIdsCache  = new Map() // `${clientPath}|${category}|${gender}|${pose}` → sorted id[]

const fallbackWarnedKeys = new Set()

async function getKhanPaletteLookup(clientPath, category) {
  const letter = String(category).toLowerCase()
  const key = `${clientPath}|${letter}`
  const cached = paletteLookupCache.get(key)
  if (cached) return cached
  const archive = await loadArchive(clientPath, PALETTE_ARCHIVE)
  const prefix = `pal${letter}`
  const lookup = PaletteLookup.fromArchive(prefix, archive)
  paletteLookupCache.set(key, lookup)
  return lookup
}

async function getKhanEpfByName(clientPath, archiveName, name) {
  const cacheKey = `${clientPath}|${name}`
  const cached = epfCache.get(cacheKey)
  if (cached) return cached
  const archive = await loadArchive(clientPath, archiveName)
  if (!archive.has(name)) return null
  const epf = EpfFile.fromArchive(name, archive)
  epfCache.set(cacheKey, epf)
  return epf
}

/**
 * Resolve the best-available pose for (category, gender, id). Tries the
 * requested pose first, then walks POSE_FALLBACK_ORDER. Returns the pose
 * string that exists, or null if none do.
 */
async function resolvePose(clientPath, { category, gender, displaySprite, pose }) {
  const archiveName = khanArchiveName(category, gender)
  if (!archiveName) return null
  const archive = await loadArchive(clientPath, archiveName)
  const tryPose = (p) => archive.has(entryName(category, gender, displaySprite, p)) ? p : null
  // Try requested first, then anything else.
  const requested = tryPose(pose)
  if (requested) return requested
  for (const p of POSE_FALLBACK_ORDER) {
    if (p === pose) continue
    const found = tryPose(p)
    if (found) return found
  }
  return null
}

/**
 * Render a display sprite to an ImageBitmap.
 * Returns null if the sprite isn't present or can't be rendered.
 *
 * @param {string} clientPath
 * @param {{ category: string, gender: 'M'|'W', displaySprite: number|string, pose?: string, frameIdx?: number }} opts
 */
/**
 * When `category` is an array, probe each (in order) for an entry that
 * matches this displaySprite under any pose, and return the first category
 * that has it. Falls back to the first category if nothing matches (so the
 * caller's palette/archive routing stays deterministic).
 */
async function resolveCategoryForSprite(clientPath, category, gender, displaySprite) {
  if (!Array.isArray(category)) return category
  if (category.length === 0) return null
  const id = String(Number(displaySprite)).padStart(3, '0')
  for (const c of category) {
    const archiveName = khanArchiveName(c, gender)
    if (!archiveName) continue
    const archive = await loadArchive(clientPath, archiveName)
    for (const pose of POSE_FALLBACK_ORDER) {
      const name = `${gender.toUpperCase()}${String(c).toUpperCase()}${id}${pose}.epf`
      if (archive.has(name)) return c
    }
  }
  return category[0]
}

export async function getDisplaySpriteBitmap(clientPath, opts) {
  if (!clientPath) return null
  const { gender, displaySprite } = opts
  const category = Array.isArray(opts.category)
    ? await resolveCategoryForSprite(clientPath, opts.category, gender, displaySprite)
    : opts.category
  const defaults = defaultsFor(category)
  const pose = opts.pose || defaults.pose
  const frameIdx = opts.frameIdx ?? defaults.frameIdx
  if (!category || !gender || displaySprite == null) return null
  const id = Number(displaySprite)
  if (!Number.isFinite(id) || id < 0) return null

  // Resolve an actual pose that exists for this sprite (falling back through
  // POSE_FALLBACK_ORDER if the requested one isn't present).
  const actualPose = await resolvePose(clientPath, { category, gender, displaySprite: id, pose })
  if (!actualPose) return null

  const name = entryName(category, gender, id, actualPose)
  const bmpKey = `${clientPath}|${name}|${frameIdx}`
  const cachedBmp = bitmapCache.get(bmpKey)
  if (cachedBmp) return cachedBmp

  const archiveName = khanArchiveName(category, gender)
  const epf = await getKhanEpfByName(clientPath, archiveName, name)
  if (!epf) return null
  const frame = epf.frames[frameIdx]
  if (!frame || !frame.data || frame.data.length === 0) return null
  const w = frame.right - frame.left
  const h = frame.bottom - frame.top
  if (w <= 0 || h <= 0) return null

  const lookup = await getKhanPaletteLookup(clientPath, category)
  let palette = null
  try {
    palette = lookup.getPaletteForId(id)
  } catch { /* fall through to fallback */ }
  if (!palette) {
    palette = lookup.palettes.get(0)
    if (!palette) {
      const [first] = lookup.palettes.values()
      palette = first
    }
    if (!palette) return null
    const warnKey = `${category}|${id}`
    if (!fallbackWarnedKeys.has(warnKey)) {
      fallbackWarnedKeys.add(warnKey)
      // eslint-disable-next-line no-console
      console.warn(`[khanData] no palette for category=${category} id=${id}; using fallback`)
    }
  }

  try {
    const rgba = renderEpf(frame, palette)
    const bitmap = await createImageBitmap(toImageData(rgba))
    bitmapCache.set(bmpKey, bitmap)
    return bitmap
  } catch {
    return null
  }
}

/**
 * Enumerate display-sprite IDs that exist in the given category/gender for a
 * specific pose. Used by the picker dialog to drive the browse grid.
 *
 * @returns {Promise<number[]>} sorted numeric ids
 */
export async function getAvailableDisplaySprites(clientPath, category, gender) {
  if (!clientPath || !category || !gender) return []
  const categories = Array.isArray(category) ? category : [category]
  if (categories.length === 0) return []
  const key = `${clientPath}|${categories.join(',')}|${gender}`
  const cached = availableIdsCache.get(key)
  if (cached) return cached
  const ids = new Set()
  for (const c of categories) {
    const archiveName = khanArchiveName(c, gender)
    if (!archiveName) continue
    const archive = await loadArchive(clientPath, archiveName)
    // Pattern match on gender+category (e.g. "mu" for male armor). Accept any
    // pose suffix — rendering falls back through POSE_FALLBACK_ORDER, so
    // presence under *any* pose is enough to include the id in the grid.
    const prefix = `${gender.toLowerCase()}${String(c).toLowerCase()}`
    const entries = archive.getEntriesByPattern(prefix, '.epf')
    const re = new RegExp(`^${prefix}(\\d{3})(?:\\d{2}|[a-z])\\.epf$`, 'i')
    for (const entry of entries) {
      const m = re.exec(entry.entryName)
      if (m) ids.add(parseInt(m[1], 10))
    }
  }
  const sorted = Array.from(ids).sort((a, b) => a - b)
  availableIdsCache.set(key, sorted)
  return sorted
}

export function clearKhanCache() {
  for (const bitmap of bitmapCache.values()) {
    try { bitmap.close?.() } catch { /* ignore */ }
  }
  bitmapCache.clear()
  epfCache.clear()
  paletteLookupCache.clear()
  availableIdsCache.clear()
  fallbackWarnedKeys.clear()
}
registerCacheClearer(clearKhanCache)
