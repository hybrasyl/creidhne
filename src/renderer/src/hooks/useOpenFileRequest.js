import { useEffect, useRef } from 'react'
import { useOpenFileStore } from '../store/openFileStore'

/**
 * Opens the file that a report asked this page to open (HTOO-625).
 *
 * The request waits until the page's file list has loaded, also when the page
 * mounts after the request. A file that is not in the list is dropped: it was
 * archived or deleted after the index was built.
 *
 * @param type     the page's index type, which is its section folder
 * @param files    the page's active files, from `useSectionFiles`
 * @param loading  true while `files` loads
 * @param onOpen   the page's guarded select, called with the file
 */
export function useOpenFileRequest(type, files, loading, onOpen) {
  const request = useOpenFileStore((s) => (s.request?.type === type ? s.request : null))
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen

  useEffect(() => {
    if (!request || loading) return
    if (!useOpenFileStore.getState().take(type)) return
    const file = files.find((f) => f.rel === request.rel)
    if (file) onOpenRef.current(file)
  }, [request, files, loading, type])
}
