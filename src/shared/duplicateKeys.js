/**
 * The keys that more than one active file in the world holds (HTOO-625). The
 * server loads one of those files and reports nothing (HXML-38), so the
 * editor shows them from the index instead.
 *
 * hybindex-ts writes `<type>DuplicateNames` for each type: each collision key,
 * from the server's `Normalize().ToLower()` rule, to every active file that
 * claims it. Archived files are not in it, because the server does not load them.
 *
 * Imports nothing, so the renderer and the tests can use it.
 */

const SUFFIX = 'DuplicateNames'

/**
 * True when the files' names differ only in case. HTOO-604 found that most
 * xml types match the exact name, so the server can treat these as two keys.
 * The index records a file's name only when no earlier file has the same
 * exact name, so a file without a name is an exact duplicate.
 */
function differOnlyInCase(index, type, files) {
  const names = files.map((rel) => index[`${type}NamesByFilename`]?.[rel])
  return names.every((n) => typeof n === 'string') && new Set(names).size === names.length
}

/**
 * Every group of files that share a key, sorted by type, then by key.
 *
 * @param {object} [index] - the library index
 * @returns {{type: string, key: string, files: string[], caseOnly: boolean}[]}
 */
export function duplicateKeyGroups(index) {
  if (!index) return []
  const groups = []
  for (const field of Object.keys(index).sort()) {
    if (!field.endsWith(SUFFIX)) continue
    const type = field.slice(0, -SUFFIX.length)
    for (const [key, files] of Object.entries(index[field] ?? {}).sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      if (!Array.isArray(files) || files.length < 2) continue
      groups.push({ type, key, files, caseOnly: differOnlyInCase(index, type, files) })
    }
  }
  return groups
}

/**
 * The group that the file `rel` of `type` belongs to, or null.
 *
 * @param {object} [index]
 * @param {string} type - the index type, which is the section folder
 * @param {string} rel - the file's path in the section, as the index has it
 */
export function sharedKeyGroup(index, type, rel) {
  for (const [key, files] of Object.entries(index?.[`${type}${SUFFIX}`] ?? {})) {
    if (Array.isArray(files) && files.length > 1 && files.includes(rel))
      return { type, key, files, caseOnly: differOnlyInCase(index, type, files) }
  }
  return null
}
