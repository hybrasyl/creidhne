import { z } from 'zod'
import { STAGED_TYPES, STAGING_FOLDER_TYPES } from '../../shared/staging.js'

/**
 * The staging payloads (HTOO-453).
 *
 * `type` is checked against `STAGED_TYPES` rather than a restated list. Main
 * joins it onto the library and the staging root to find both ends of a move,
 * so a type outside the list is the one argument here that could aim a move
 * somewhere else. Stage and the list take the types Creidhne stages; Release,
 * the index and the reference read also take the staged maps that Taliesin
 * writes (`STAGING_FOLDER_TYPES`, HTOO-636). The paths are checked by `validatePath` in the handlers, the
 * same as every other path.
 */

const stagedType = z.enum(STAGED_TYPES)
const folderType = z.enum(STAGING_FOLDER_TYPES)
const libraryPath = z.string().min(1)
const paths = z.array(z.string().min(1))

export const stagingListArgsSchema = z.object({ libraryPath, type: stagedType })

export const stagingIndexArgsSchema = z.object({
  libraryPath,
  types: z.array(folderType).optional()
})

export const stagingStageArgsSchema = z.object({ libraryPath, type: stagedType, srcs: paths })

export const stagingReleaseArgsSchema = z.object({ libraryPath, type: folderType, srcs: paths })

export const refsNamesInArgsSchema = z.object({ paths, type: folderType })
