/**
 * The checks the server runs on a trait at load (HTOO-617), so the editor can
 * name each one before a save. The rules are the xml package's
 * `Trait.Validate` (src/Extensions/Trait.cs), and its comparisons are exact,
 * as the server's are; Trait.xsd adds the required Icon and IconSet.
 *
 * Imports nothing, so the renderer and the tests can use it.
 */

/** The IconSet values Trait.xsd allows. */
export const ICON_SETS = ['Skill', 'Spell']

/** The ExclusivePolicy values Trait.xsd allows; absent means Reject. */
export const EXCLUSIVE_POLICIES = ['Reject', 'Replace']

/** A key the server refuses: empty, or with a space at the start or the end. */
const isBadName = (name) => !String(name ?? '').trim() || String(name).trim() !== String(name)

/**
 * The problems that make the server refuse the trait, as sentences.
 *
 * @param {object} trait - the traitXml model
 * @param {string[] | null} [knownTraits] - every trait name in the world, or
 *   null to skip the "is a trait" check (no index yet)
 * @returns {string[]}
 */
export function validateTrait(trait, knownTraits = null) {
  const problems = []
  if (isBadName(trait.name))
    problems.push('The name is empty, or it has a space at the start or the end.')
  if (!/^\d+$/.test(String(trait.icon ?? '')) || Number(trait.icon) > 65535)
    problems.push('The icon must be a whole number from 0 to 65535.')
  if (!ICON_SETS.includes(trait.iconSet)) problems.push('The icon set must be Skill or Spell.')
  if (trait.exclusiveGroup && isBadName(trait.exclusiveGroup))
    problems.push('The exclusive group has a space at the start or the end.')

  const conflicts = trait.conflictsWith ?? []
  for (const name of new Set(conflicts.filter((n, i) => conflicts.indexOf(n) !== i)))
    problems.push(`Conflicts with names ${name} more than once.`)
  for (const name of new Set(conflicts)) {
    if (name === trait.name) problems.push('Conflicts with names the trait itself.')
    else if (knownTraits && !knownTraits.includes(name))
      problems.push(`Conflicts with names ${name}, which is not a trait.`)
  }
  return problems
}
