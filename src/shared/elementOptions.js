/**
 * The element choices the editors offer, taken from the active element table
 * (HTOO-581, HXML-24 "Element references in other content").
 *
 * The world data defines the elements, so no editor keeps a list of its own.
 * An element field (a stat or elemental modifier, a damage element, an
 * immunity) takes an element key. A selector field (castable `Elements`,
 * spawn `Damage` and `Defense` `Elements`) takes a space-separated list of
 * selectors: an element key, `Random:<Group>`, or `Current`, `Belt` or
 * `Necklace`, which the server resolves from creature state.
 *
 * Imports nothing, so the renderer and the tests can use it.
 */

/** The table a server config uses when its ElementTable attribute is absent. */
export const DEFAULT_ELEMENT_TABLE = 'default'

/**
 * The server config whose element table the editors follow. Creidhne has no
 * setting for which config the server runs, and `serverconfigs/config.xml`
 * is the one every world has; the index names it `default`, as the server
 * does.
 */
export const EDITOR_SERVER_CONFIG = 'default'

/** Selectors that the server resolves from creature state. */
export const STATE_SELECTORS = ['Current', 'Belt', 'Necklace']

/** The prefix of a group selector. */
export const GROUP_SELECTOR_PREFIX = 'Random:'

/**
 * Names from the old ElementType enum that the HXML-24 migration replaces.
 * A field that holds one shows a warning: the warnings are the migration's
 * to-do list.
 */
export const OLD_ELEMENT_NAMES = {
  None: 'None is not an element. Leave the field empty, and the server uses the default element.',
  Wood: 'Wood is now Nature.',
  RandomTemuair: 'RandomTemuair is now Random:Cardinal.',
  RandomExpanded: 'RandomExpanded is now Random:Ordinal.'
}

const hasOwn = (record, key) => Object.prototype.hasOwnProperty.call(record, key)

/**
 * The element table a server config uses. A copy of hybindex-ts's
 * `resolveElementTable`, because the renderer cannot import that package (its
 * entry point imports fs, path, crypto and os). elementOptions.test.js holds
 * the copy to the package.
 *
 * @returns {string | null} the table name, or null when it cannot be decided
 */
export function resolveElementTable(index, serverConfigName) {
  const tables = index?.elementTables ?? {}
  const configs = index?.serverconfigElementTables ?? {}
  if (serverConfigName != null && hasOwn(configs, serverConfigName)) {
    const selected = configs[serverConfigName] ?? DEFAULT_ELEMENT_TABLE
    if (hasOwn(tables, selected)) return selected
  }
  const names = Object.keys(tables)
  return names.length === 1 ? names[0] : null
}

/**
 * The choices for the editors.
 *
 * With an active table: its element keys, its groups as `Random:<Group>`, and
 * the state selectors. Without one (no table, or several and no server config
 * that picks one), the keys of every table, and no warning for an unknown key,
 * because there is no single table to check against.
 *
 * @returns {{ table: string | null, keys: string[], groups: string[], selectors: string[] }}
 */
export function elementOptions(index) {
  const table = resolveElementTable(index, EDITOR_SERVER_CONFIG)
  const entry = table ? index.elementTables[table] : null
  const keys = entry ? [...(entry.elements ?? [])] : [...(index?.elementnames ?? [])]
  const groups = entry ? Object.keys(entry.groups ?? {}) : []
  return {
    table,
    keys,
    groups,
    selectors: [...keys, ...groups.map((g) => GROUP_SELECTOR_PREFIX + g), ...STATE_SELECTORS]
  }
}

/** A selector list as its selectors. */
export function splitSelectors(value) {
  return String(value ?? '')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Why `value` needs the author's attention in an element field, or null.
 *
 * @param {string} value - an element key
 * @param {ReturnType<typeof elementOptions>} options
 */
export function elementWarning(value, options) {
  const v = String(value ?? '').trim()
  if (!v) return null
  if (hasOwn(OLD_ELEMENT_NAMES, v)) return OLD_ELEMENT_NAMES[v]
  if (options.table && !options.keys.includes(v))
    return `${v} is not an element of the table ${options.table}.`
  return null
}

/**
 * Why each selector in `value` needs the author's attention, as one list.
 *
 * @param {string} value - a space-separated selector list
 * @param {ReturnType<typeof elementOptions>} options
 * @returns {string[]}
 */
export function selectorWarnings(value, options) {
  const out = []
  for (const s of splitSelectors(value)) {
    if (STATE_SELECTORS.includes(s)) continue
    if (hasOwn(OLD_ELEMENT_NAMES, s)) out.push(OLD_ELEMENT_NAMES[s])
    else if (s.startsWith(GROUP_SELECTOR_PREFIX)) {
      const group = s.slice(GROUP_SELECTOR_PREFIX.length)
      if (options.table && !options.groups.includes(group))
        out.push(`${group} is not a group of the table ${options.table}.`)
    } else if (options.table && !options.keys.includes(s))
      out.push(`${s} is not an element or a selector of the table ${options.table}.`)
  }
  return out
}
