import { z } from 'zod'
import { STAGED_TYPES } from '../../shared/staging.js'

/**
 * The staging payloads (HTOO-453).
 *
 * `type` is checked against `STAGED_TYPES` rather than a restated list. Main
 * joins it onto the library and the staging root to find both ends of a move,
 * so a type outside the list is the one argument here that could aim a move
 * somewhere else. The paths are checked by `validatePath` in the handlers, the
 * same as every other path.
 */

const stagedType = z.enum(STAGED_TYPES)
const libraryPath = z.string().min(1)
const paths = z.array(z.string().min(1))

export const stagingListArgsSchema = z.object({ libraryPath, type: stagedType })

export const stagingIndexArgsSchema = z.object({
  libraryPath,
  types: z.array(stagedType).optional()
})

export const stagingMoveArgsSchema = z.object({ libraryPath, type: stagedType, srcs: paths })

export const refsNamesInArgsSchema = z.object({ paths, type: stagedType })
