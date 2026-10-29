/**
 * The checks the server runs on a species at load (HTOO-618), so the editor
 * can name each one before a save. The rules are the xml package's
 * `Species.Validate` and `Species.ValidateAll` (src/Extensions/Species.cs).
 * Species keys and body keys compare without case, as there; Species.xsd adds
 * the key pattern, the required attributes and the value ranges.
 *
 * Imports nothing, so the renderer and the tests can use it.
 */

export const SPECIES_ORIGINS = ['Aosda', 'Tuatha', 'Fanaidhe']
export const PLAYER_OPTIONS = ['Locked', 'Starter', 'Unlockable', 'ByBranch']

/** SpeciesKey in Species.xsd: an ElementKey. */
const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/

/** True when the server accepts `key` as a species or body key. */
export const isValidKey = (key) => KEY_PATTERN.test(String(key ?? ''))

const isBadValue = (v) => !String(v ?? '').trim() || String(v).trim() !== String(v)
const isWholeIn = (v, lo, hi) => /^\d+$/.test(String(v ?? '')) && Number(v) >= lo && Number(v) <= hi
const lower = (v) => String(v ?? '').toLowerCase()

/** The entries of `list` that occur more than once under `keyOf`, each named once. */
function duplicates(list, keyOf) {
  const seen = new Map()
  for (const v of list) {
    const k = keyOf(v)
    seen.set(k, [...(seen.get(k) ?? []), v])
  }
  return [...seen.values()].filter((vs) => vs.length > 1).map((vs) => vs[0])
}

/**
 * The problems that make the server refuse the species, as sentences.
 *
 * @param {object} species - the speciesXml model
 * @param {object} [world] - what the index knows of the other species; omit it
 *   to skip the checks across species
 * @param {Record<string, {id: number|null, branchOf: string|null, playerOption: string|null}>} [world.details]
 *   hybindex `speciesDetails`, keyed by species key
 * @param {Record<string, {species: string, body: string}[]>} [world.bodyIds]
 *   hybindex `speciesBodyIds`, keyed by body Id
 * @param {string} [world.originalKey] - the key this species had when it was
 *   opened, so its own index entry is not read as another species
 * @param {Record<string, string[]>} [world.duplicateNames] - hybindex
 *   `speciesDuplicateNames`: each key that more than one active file holds
 * @returns {string[]}
 */
export function validateSpecies(species, world) {
  const problems = []
  const bodies = species.bodies ?? []

  // One species: Species.Validate, plus the schema.
  if (isBadValue(species.key))
    problems.push('The key is empty, or it has a space at the start or the end.')
  else if (!KEY_PATTERN.test(species.key))
    problems.push('The key must start with a letter and hold only letters and digits.')
  if (!isWholeIn(species.id, 0, 255)) problems.push('The Id must be a whole number from 0 to 255.')
  if (!SPECIES_ORIGINS.includes(species.origin)) problems.push('Choose an origin.')
  if (!PLAYER_OPTIONS.includes(species.playerOption)) problems.push('Choose a player option.')
  for (const [form, value] of Object.entries(species.names ?? {}))
    if (isBadValue(value))
      problems.push(`The ${form} name is empty, or it has a space at the start or the end.`)

  if (bodies.length === 0 && ['Starter', 'Unlockable'].includes(species.playerOption))
    problems.push(`A ${species.playerOption} species has no bodies.`)
  const defaults = bodies.filter((b) => b.isDefault).length
  if (bodies.length > 0 && defaults !== 1)
    problems.push(`Exactly one body must be the default. This species has ${defaults}.`)
  for (const b of bodies) {
    if (isBadValue(b.key))
      problems.push(
        `Body ${b.id || '(no Id)'} has no key, or its key has a space at the start or the end.`
      )
    else if (!KEY_PATTERN.test(b.key))
      problems.push(
        `Body ${b.key}: the key must start with a letter and hold only letters and digits.`
      )
    if (!isWholeIn(b.id, 0, 65535))
      problems.push(`Body ${b.key || '(no key)'}: the Id must be a whole number from 0 to 65535.`)
    if (
      b.retailSkinColor !== '' &&
      b.retailSkinColor != null &&
      !isWholeIn(b.retailSkinColor, 0, 9)
    )
      problems.push(`Body ${b.key || '(no key)'}: the retail skin colour must be from 0 to 9.`)
  }
  for (const b of duplicates(
    bodies.filter((b) => b.key),
    (b) => lower(b.key)
  ))
    problems.push(`Body key ${b.key} is not unique. Keys compare without case.`)
  for (const b of duplicates(
    bodies.filter((b) => b.id !== ''),
    (b) => String(Number(b.id))
  ))
    problems.push(`Body Id ${b.id} is not unique.`)

  const isBranch = !!species.branchOf
  if (isBranch && species.playerOption === 'ByBranch')
    problems.push('A branch cannot be ByBranch, because a branch cannot have branches.')
  if (!isBranch) {
    if (!species.affinity) problems.push('The species has no Affinity, and it is not a branch.')
    if (!species.resistance) problems.push('The species has no Resistance, and it is not a branch.')
  }

  if (!world?.details) return problems

  // Across species: Species.ValidateAll, against the index.
  // A new species has no entry of its own, so every entry is another species.
  const self = world.originalKey != null ? lower(world.originalKey) : null
  const others = Object.entries(world.details).filter(([k]) => lower(k) !== self)
  const byKey = new Map(others.map(([k, d]) => [lower(k), { key: k, ...d }]))

  // A duplicated file holds the key of its original. The index keeps one
  // entry per key, so `details` cannot show it.
  const holders = world.duplicateNames?.[self]?.length ?? 0
  if (lower(species.key) === self && holders > 1)
    problems.push(`${holders} files have the key ${species.key}. Give this species a new key.`)
  if (byKey.has(lower(species.key)))
    problems.push(`The species key ${species.key} is not unique. Keys compare without case.`)
  if (isWholeIn(species.id, 0, 255)) {
    const clash = others.find(([, d]) => d.id === Number(species.id))
    if (clash) problems.push(`The species Id ${species.id} is also the Id of ${clash[0]}.`)
  }
  for (const b of bodies) {
    const claims = (world.bodyIds?.[String(Number(b.id))] ?? []).filter(
      (c) => lower(c.species) !== self
    )
    if (b.id !== '' && claims.length)
      problems.push(
        `Body Id ${b.id} is also used by ${claims.map((c) => `${c.species} (${c.body})`).join(', ')}.`
      )
  }
  if (isBranch) {
    const parent = byKey.get(lower(species.branchOf))
    if (!parent) problems.push(`Branch of names ${species.branchOf}, which is not a species.`)
    else if (parent.branchOf)
      problems.push(`Branch of names ${species.branchOf}, which is a branch itself.`)
    else if (parent.playerOption !== 'ByBranch')
      problems.push(`Branch of names ${species.branchOf}, which is not ByBranch.`)
  } else if (species.playerOption === 'ByBranch') {
    const hasBranch = others.some(([, d]) => lower(d.branchOf) === lower(species.key))
    if (!hasBranch) problems.push('The species is ByBranch, but no species is a branch of it.')
  }
  return problems
}

/**
 * The species that a branch can name in BranchOf: each one that is ByBranch
 * and is not a branch itself, other than the species being edited.
 *
 * @param {Record<string, {branchOf: string|null, playerOption: string|null}>} [details]
 *   hybindex `speciesDetails`
 * @param {string} [selfKey]
 * @returns {string[]} sorted keys
 */
export function branchParents(details, selfKey) {
  return Object.entries(details ?? {})
    .filter(([k, d]) => lower(k) !== lower(selfKey) && !d.branchOf && d.playerOption === 'ByBranch')
    .map(([k]) => k)
    .sort((a, b) => a.localeCompare(b))
}
