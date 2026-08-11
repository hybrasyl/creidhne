/**
 * The server's name-collision rule, and the editors' pre-save duplicate check
 * built on it.
 *
 * A `<Name>` is a key, not a label. Hybrasyl resolves entities out of
 * name-keyed indexes, and such an index holds one entry per key — so two
 * active files claiming one name leaves one of them unreachable by name.
 * Nothing in the XML prevents it, so the editor warns before the save.
 *
 * `@eriscorp/hybindex-ts` owns the key rule and exports `nameCollisionKey`.
 * The renderer cannot import that package: its entry point imports `fs`,
 * `path`, `crypto` and `os` at the top level, so bundling it into the window
 * pulls node built-ins into a sandboxed renderer. The rule is therefore
 * restated here — and `nameCollision.test.js` asserts this copy agrees with
 * the package's across a table of inputs chosen to separate them. A restated
 * rule is the thing that drifts; the agreement test is what makes the copy
 * safe to keep.
 */

/**
 * The types whose editors run a duplicate-name check.
 *
 * Not every indexed type appears here. `localizations` and `serverconfigs` are
 * indexed but are not user-named in the way the others are, and `maps` and
 * `worldmaps` have no editor. Every entry must be a real `IndexType` that
 * carries both an active and an archived name list — `nameCollision.test.js`
 * checks that against the package rather than trusting this list.
 */
export const DUPLICATE_CHECKED_TYPES = Object.freeze([
  'castables',
  'creatures',
  'creaturebehaviorsets',
  'elementtables',
  'items',
  'lootsets',
  'nations',
  'npcs',
  'recipes',
  'spawngroups',
  'statuses',
  'variantgroups'
])

/**
 * The server's own index-key rule: `key.ToString().Normalize().ToLower()`.
 *
 * Whitespace is kept. The docstring beside the server's `Sanitize` claims
 * whitespace is removed and the code does not remove it, so `'twin peaks'` and
 * `'twin  peaks'` are two different keys — deliberately, because the server
 * keys them separately too. A pair differing only by whitespace is therefore
 * not a collision here and is not one on the server either.
 */
export function nameCollisionKey(name) {
  return String(name ?? '')
    .normalize()
    .toLowerCase()
}

/** The `WorldIndex` field holding a type's archived names. */
export function archivedNamesKey(type) {
  return `archived${type.charAt(0).toUpperCase()}${type.slice(1)}`
}

/**
 * Whether saving `name` under `type` would collide with something already in
 * the world index: `'active'`, `'archived'`, or `null` for no clash.
 *
 * `originalName` is the entity's own saved name, so editing an existing entity
 * without renaming it does not flag itself. Pass `''` for a new entity.
 *
 * Throws on a type with no duplicate check rather than returning `null`. A
 * mistyped type would otherwise report clean forever, which is the exact
 * silent-pass this check exists to prevent.
 */
export function duplicateNameStatus({ libraryIndex, type, name, originalName = '' }) {
  if (!DUPLICATE_CHECKED_TYPES.includes(type)) {
    throw new Error(`duplicateNameStatus: no duplicate check defined for type "${type}"`)
  }

  const candidate = nameCollisionKey(String(name ?? '').trim())
  if (!candidate) return null
  if (originalName && nameCollisionKey(String(originalName).trim()) === candidate) return null

  const active = libraryIndex?.[type] || []
  if (active.some((n) => nameCollisionKey(n) === candidate)) return 'active'

  const archived = libraryIndex?.[archivedNamesKey(type)] || []
  if (archived.some((n) => nameCollisionKey(n) === candidate)) return 'archived'

  return null
}
