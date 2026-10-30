import { nameCollisionKey } from './nameCollision.js'

/**
 * Staging (HTOO-453): world files that are not ready to release.
 *
 * A staged file lives in `<world>/.staging/<type>/`, with the same layout as
 * `<world>/xml/<type>/`. The server roots its load at `<world>/xml`, and
 * hybindex walks `xml/<type>/` only, so neither of them sees a staged file. The
 * world repository ignores `.staging/`. Release moves a file to the same
 * relative path under `xml/<type>/`.
 *
 * Creidhne keeps its own index of the staged files: names only, built with the
 * package's `buildSection` over the staging root, so a staged name follows the
 * same rules as a live one. This module holds the pure parts that main and the
 * renderer share: the type list, the merged index view, and the release checks.
 */

/** The folder, next to `xml/`, that holds staged files. */
export const STAGING_DIR = '.staging'

/**
 * The types that can be staged: the sixteen file-backed editor pages.
 * `staging.test.js` pins this list to `PAGE_FOR_TYPE`, so a new page gets
 * staging or the test fails.
 */
export const STAGED_TYPES = Object.freeze([
  'castables',
  'creaturebehaviorsets',
  'creatures',
  'elementtables',
  'items',
  'localizations',
  'lootsets',
  'nations',
  'npcs',
  'recipes',
  'serverconfigs',
  'spawngroups',
  'species',
  'statuses',
  'traits',
  'variantgroups'
])

/** The staging root for a library (`<world>/xml` → `<world>/.staging`). */
export function stagingRootFor(libraryPath) {
  const lib = String(libraryPath ?? '').replace(/[\\/]+$/, '')
  const cut = Math.max(lib.lastIndexOf('/'), lib.lastIndexOf('\\'))
  return `${cut === -1 ? '' : lib.slice(0, cut)}/${STAGING_DIR}`
}

/**
 * The staged index entry for one type, from a `buildSection` result. Only the
 * names: the cross-reference fields describe files the server never loads.
 */
export function stagedEntry(type, fields) {
  return {
    names: fields?.[type] || [],
    namesByFilename: fields?.[`${type}NamesByFilename`] || {},
    duplicateNames: fields?.[`${type}DuplicateNames`] || {}
  }
}

/** The staged names of a type, or `[]`. */
export function stagedNames(stagedIndex, type) {
  return stagedIndex?.[type]?.names || []
}

/**
 * The index a staged editor sees: each type's live names plus its staged names.
 *
 * Only the name lists are merged. Pickers and the duplicate check read those,
 * and a staged entity is never part of the live cross-references. The result
 * keeps every other field of the live index unchanged.
 */
export function mergeStagedIndex(libraryIndex, stagedIndex) {
  const merged = { ...(libraryIndex || {}) }
  for (const type of STAGED_TYPES) {
    const staged = stagedNames(stagedIndex, type)
    if (!staged.length) continue
    const live = merged[type] || []
    merged[type] = [...new Set([...live, ...staged])].sort()
  }
  return merged
}

/**
 * The staged names of a type that no live entity has. A picker in a staged
 * editor marks these, and a live file that names one cannot be resolved.
 */
export function stagedOnlyNameSet(libraryIndex, stagedIndex, type) {
  const live = new Set((libraryIndex?.[type] || []).map(nameCollisionKey))
  return new Set(stagedNames(stagedIndex, type).filter((n) => !live.has(nameCollisionKey(n))))
}

/**
 * The names in `refs` (target type → names, from `refs:namesIn`) that exist
 * only in staging. Returns `[{ type, name }]`, sorted by type then name.
 *
 * A name that is neither live nor staged is not reported here: that is an
 * ordinary unresolved reference, and the server reports it at load.
 */
export function stagedOnlyReferences(refs, libraryIndex, stagedIndex) {
  const out = []
  for (const type of Object.keys(refs || {}).sort()) {
    const live = new Set((libraryIndex?.[type] || []).map(nameCollisionKey))
    const staged = new Set(stagedNames(stagedIndex, type).map(nameCollisionKey))
    for (const name of [...new Set(refs[type])].sort()) {
      const key = nameCollisionKey(name)
      if (!live.has(key) && staged.has(key)) out.push({ type, name })
    }
  }
  return out
}

/**
 * The staged file of `type` that has `name`, as its type-relative path, or
 * null. The first file wins when two staged files share a name; the editor
 * shows that clash as a shared key.
 */
export function stagedFileFor(stagedIndex, type, name) {
  const key = nameCollisionKey(name)
  const byFile = stagedIndex?.[type]?.namesByFilename || {}
  for (const rel of Object.keys(byFile).sort()) {
    if (nameCollisionKey(byFile[rel]) === key) return rel
  }
  return null
}

/**
 * The other files that have the key of the staged file `rel`: `{ name, live,
 * staged }`, each a list of type-relative paths, or null when none has it.
 *
 * `live` is the reason Release will refuse the file. The editor's duplicate
 * check does not show it, because it compares the Name field with the name the
 * file was saved with, and a staged twin of a live entity was saved with the
 * live entity's name. An archived live file is not counted: the server does not
 * load it.
 */
export function stagedKeyClash(libraryIndex, stagedIndex, type, rel) {
  const name = stagedIndex?.[type]?.namesByFilename?.[rel]
  const key = nameCollisionKey(String(name ?? '').trim())
  if (!key) return null
  const liveByFile = libraryIndex?.[`${type}NamesByFilename`] || {}
  const live = Object.keys(liveByFile)
    .filter((r) => !r.split('/').includes('.ignore') && nameCollisionKey(liveByFile[r]) === key)
    .sort()
  const stagedByFile = stagedIndex?.[type]?.namesByFilename || {}
  const staged = Object.keys(stagedByFile)
    .filter((r) => r !== rel && nameCollisionKey(stagedByFile[r]) === key)
    .sort()
  return live.length || staged.length ? { name, live, staged } : null
}

/**
 * The files of a release that must not move, because each one's name is
 * already live or another file in the same release has it. Returns
 * `[{ type, rel, name, reason }]` with reason `'live'` or `'batch'`.
 *
 * `release` is `[{ type, rel, name }]`. A file with no name is not checked:
 * the server cannot key it, and its editor refuses to save it without one.
 */
export function releaseClashes(release, libraryIndex) {
  const out = []
  const seen = new Map()
  for (const f of release) {
    const key = nameCollisionKey(String(f.name ?? '').trim())
    if (!key) continue
    const batchKey = `${f.type}\u0000${key}`
    seen.set(batchKey, [...(seen.get(batchKey) || []), f])
  }
  for (const f of release) {
    const key = nameCollisionKey(String(f.name ?? '').trim())
    if (!key) continue
    const live = (libraryIndex?.[f.type] || []).some((n) => nameCollisionKey(n) === key)
    if (live) out.push({ ...f, reason: 'live' })
    else if (seen.get(`${f.type}\u0000${key}`).length > 1) out.push({ ...f, reason: 'batch' })
  }
  return out
}
