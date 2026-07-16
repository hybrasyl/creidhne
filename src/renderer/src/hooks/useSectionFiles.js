import { useCallback, useEffect, useRef, useState } from 'react'
import { toSectionFile } from '../utils/fileTree'

/**
 * Loads one world section's files for an editor page: active and archived, in a
 * single recursive `listSection` call.
 *
 * Every editor page needs exactly this, and before this hook each one carried
 * its own copy — which is how the flat-`listDir` bug came to live in 15 places
 * at once. The `listSection` contract (its return shape, the `toSectionFile`
 * mapping, the reset when no library is set) is pinned here instead.
 *
 * `onReset` clears page-specific editor state when the library goes away. It is
 * held in a ref so a page can pass an inline arrow without re-running the load.
 *
 * `loadFiles` is stable, so pages hand it straight to `useBulkFileActions` and
 * list it in effect deps without re-firing.
 */
export function useSectionFiles(activeLibrary, subdir, onReset) {
  const [files, setFiles] = useState([])
  const [archivedFiles, setArchivedFiles] = useState([])
  const [loading, setLoading] = useState(true)

  const onResetRef = useRef(onReset)
  onResetRef.current = onReset

  const loadFiles = useCallback(
    async (library) => {
      if (!library) {
        setFiles([])
        setArchivedFiles([])
        return
      }
      const { dir, active, archived } = await window.electronAPI.listSection(library, subdir)
      setFiles(active.map((rel) => toSectionFile(dir, rel, false)))
      setArchivedFiles(archived.map((rel) => toSectionFile(dir, rel, true)))
    },
    [subdir]
  )

  useEffect(() => {
    if (!activeLibrary) {
      setFiles([])
      setArchivedFiles([])
      setLoading(false)
      onResetRef.current?.()
      return
    }
    setLoading(true)
    loadFiles(activeLibrary).finally(() => setLoading(false))
  }, [activeLibrary, loadFiles])

  return { files, archivedFiles, loading, loadFiles }
}
