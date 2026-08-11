import { useMemo } from 'react'
import { useStoreValue, libraryIndexState } from '../store/appStore'
import { duplicateNameStatus } from '@shared/nameCollision.js'

/**
 * The editors' duplicate-name check: `'active'`, `'archived'`, or `null`.
 *
 * Every editor asked this question with its own pair of `toLowerCase()`
 * comparisons against `libraryIndex.<type>` and `libraryIndex.archived<Type>`.
 * Thirteen copies of one comparison is thirteen chances to disagree with the
 * server, which keys names with `Normalize().ToLower()` rather than a bare
 * lowercase — so the hand-rolled version and the index could reach opposite
 * answers about the same two names. The rule now lives in one place
 * (`@shared/nameCollision.js`) and is pinned to `@eriscorp/hybindex-ts`.
 *
 * Reads the index from the store rather than taking it as an argument, so an
 * editor that needs the check does not have to already hold `libraryIndex`.
 *
 * @param type          an entry in `DUPLICATE_CHECKED_TYPES`, e.g. `'items'`
 * @param name          the name currently in the editor's Name field
 * @param originalName  the entity's own saved name, so it does not flag itself
 * @param isExisting    false for a new entity, where there is no saved name yet
 */
export function useDuplicateName({ type, name, originalName, isExisting }) {
  const libraryIndex = useStoreValue(libraryIndexState)
  return useMemo(
    () =>
      duplicateNameStatus({
        libraryIndex,
        type,
        name,
        originalName: isExisting ? originalName || '' : ''
      }),
    [libraryIndex, type, name, originalName, isExisting]
  )
}
