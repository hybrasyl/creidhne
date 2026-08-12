import { z } from 'zod'
import { REFERENCED_TYPES } from '../../shared/entityReferences.js'

/**
 * The rename-repair payloads (HTOO-378).
 *
 * `refs:apply` is the widest write in the app: one message rewrites every file
 * in the world that names an entity, across up to four directories. That places
 * it in the same class as `castable:addCategoryBulk` and `spellbook:apply`, and
 * it takes the same rule — **validate before the scan, never inside the write
 * loop.** A payload worth rejecting must be rejected before the first file is
 * touched, or the rejection leaves the world half-updated. Here that is sharper
 * than for the other two: this loop rewrites hundreds of files, so a rejection
 * discovered part-way through would leave the world in a state neither name
 * describes.
 *
 * `type` is checked against `REFERENCED_TYPES` rather than a restated list, the
 * shape `schemas/reports.js` uses. The compiler cannot be asked to repair a type
 * the table has no edges for, and adding a type to the table is all it takes to
 * make it legal here — the two cannot disagree.
 */

/** A type the reference table can repair. Derived from the table itself. */
const referencedType = z.enum(REFERENCED_TYPES)

/**
 * A name being searched for or written in.
 *
 * Trimmed and non-empty on both sides. An empty `oldName` matches nothing, and
 * `entityRefScan` already refuses it — but a blank `newName` is the dangerous
 * one: it would write an empty reference into every referring file, which parses
 * and keys nothing. That is the same fault `worldEntity.js` refuses one file at
 * a time, at a few hundred times the blast radius.
 */
const entityName = z.string().trim().min(1)

export const refsScanArgsSchema = z.object({
  libraryPath: z.string().min(1),
  type: referencedType,
  oldName: entityName
})

export const refsApplyArgsSchema = z.object({
  libraryPath: z.string().min(1),
  type: referencedType,
  oldName: entityName,
  newName: entityName
})
