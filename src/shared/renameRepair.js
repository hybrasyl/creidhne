import { nameCollisionKey } from './nameCollision.js'
import { REFERENCE_SITES } from './entityReferences.js'

/**
 * When Creidhne should offer to repoint the files that name an entity, and when
 * it must not (HTOO-378).
 *
 * Kept here, apart from the hook, because the interesting part is a decision
 * rather than a render: four rules, three of which say "do nothing" and one of
 * which is the reason this card exists.
 *
 * ## The trigger is the `<Name>` VALUE, and this is the thing most likely to be
 * ## got wrong
 *
 * The obvious trigger is the page's `isRename`, and it is the wrong one.
 * `isRename` comes out of `resolveSavePath` and is computed from the FILENAME:
 * true when the save lands anywhere other than where the open file is. The
 * filename tracks the Name only while the user has not edited it. So a user who
 * has hand-edited the filename can change `<Name>`, save over the same file,
 * orphan every referrer, and see no dialog at all — because nothing on that path
 * believes a rename happened.
 *
 * That is the sneakier of the two paths and a filename-triggered port misses
 * exactly it. Taliesin's HTOO-347 keys off "the map was renamed" and could,
 * because there the two cannot come apart.
 *
 * The converse also matters and falls out of the same rule: renaming the FILE
 * while leaving `<Name>` alone breaks nothing, because the server keys on the
 * name and not the path. No dialog there either, and none is wanted.
 */

/**
 * Why no offer is being made. Returned rather than a bare `false` so the caller
 * can tell "nothing to do" from "we refuse to guess", which are different
 * answers and only one of them is worth telling the user about.
 *
 * @typedef {'new-entity'|'unchanged'|'no-references-possible'|'ambiguous-old-name'} SkipReason
 */

/**
 * Whether to offer a reference repair, given the state at the moment of a save.
 *
 * Returns `{ offer: true }`, or `{ offer: false, reason }`. Only
 * `ambiguous-old-name` is worth surfacing; the other three are ordinary.
 *
 * `libraryIndex` is the world index, used for one question: is the old name
 * unique among ACTIVE entities of this type? If two files already claim it,
 * every reference to it is ambiguous and a rewrite would silently pick one
 * meaning. HTOO-375 made that question cheap to ask; the honest answer is to
 * decline and say why, rather than guess.
 */
export function shouldOfferRepair({ libraryIndex, type, oldName, newName, isExisting }) {
  // A brand-new entity has no old name, so nothing can be naming it yet.
  if (!isExisting) return { offer: false, reason: 'new-entity' }

  const before = String(oldName ?? '').trim()
  const after = String(newName ?? '').trim()
  if (!before || !after || before === after) return { offer: false, reason: 'unchanged' }

  // Measured, not assumed: four indexed types have no inbound edges at all, so
  // there is no scan to run. Reading it from the table means a type that gains
  // an edge later starts offering the repair with no further change here.
  if (!REFERENCE_SITES[type]?.length) {
    return { offer: false, reason: 'no-references-possible' }
  }

  const key = nameCollisionKey(before)
  const claimants = (libraryIndex?.[type] || []).filter((n) => nameCollisionKey(n) === key).length
  if (claimants > 1) return { offer: false, reason: 'ambiguous-old-name' }

  return { offer: true }
}

/** `3 files` / `1 file` — used in the dialog and in the result message. */
export function countLabel(n, noun) {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

/**
 * The sentence shown after a repair runs.
 *
 * Names what changed AND what did not. The write is per file and cannot be made
 * atomic across dozens of them, so a partial result is a possible outcome and
 * saying only the good half would misreport it.
 */
export function repairSummary({ total, changed, failed }) {
  const ok = `Updated ${countLabel(total, 'reference')} in ${countLabel(changed.length, 'file')}.`
  if (!failed?.length) return ok
  return `${ok} ${countLabel(failed.length, 'file')} could not be written: ${failed
    .map((f) => f.rel)
    .join(', ')}`
}
