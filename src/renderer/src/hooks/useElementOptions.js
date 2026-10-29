import { useMemo } from 'react'
import { useStoreValue, libraryIndexState } from '../store/appStore'
import { elementOptions } from '@shared/elementOptions'

/**
 * The element choices from the active element table (HTOO-581). Every element
 * and selector field takes its options here, so no editor keeps a list.
 */
export function useElementOptions() {
  const libraryIndex = useStoreValue(libraryIndexState)
  return useMemo(() => elementOptions(libraryIndex), [libraryIndex])
}
