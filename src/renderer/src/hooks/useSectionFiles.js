import { useCallback, useEffect, useRef, useState } from 'react'
import { toSectionFile, toStagedFile } from '../utils/fileTree'
import { useStoreValue, useSetStoreValue, stagedIndexState } from '../store/appStore'

/**
 * Loads one world section's files for an editor page: active and archived, in a
 * single recursive `listSection` call, and the staged ones from
 * `<world>/.staging/<type>/` (HTOO-453).
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
 * list it in effect deps without re-firing. Every save, stage, release and bulk
 * action calls it, so it also rebuilds this type's staged index: that is
 * HTOO-372's "every save refreshes the section it wrote", for staging. The
 * first load does not, because App builds every type's staged index when the
 * library opens.
 */
export function useSectionFiles(activeLibrary, subdir, onReset) {
  const [files, setFiles] = useState([])
  const [archivedFiles, setArchivedFiles] = useState([])
  const [stagedFiles, setStagedFiles] = useState([])
  const [stagedDir, setStagedDir] = useState('')
  const [loading, setLoading] = useState(true)
  const stagedIndex = useStoreValue(stagedIndexState)
  const setStagedIndex = useSetStoreValue(stagedIndexState)

  const onResetRef = useRef(onReset)
  onResetRef.current = onReset

  const list = useCallback(
    async (library) => {
      if (!library) {
        setFiles([])
        setArchivedFiles([])
        setStagedFiles([])
        return
      }
      const [{ dir, active, archived }, staged] = await Promise.all([
        window.electronAPI.listSection(library, subdir),
        window.electronAPI.listStaged(library, subdir).catch(() => ({ dir: '', files: [] }))
      ])
      setFiles(active.map((rel) => toSectionFile(dir, rel, false)))
      setArchivedFiles(archived.map((rel) => toSectionFile(dir, rel, true)))
      setStagedFiles(staged.files.map((rel) => toStagedFile(staged.dir, rel)))
      setStagedDir(staged.dir)
    },
    [subdir]
  )

  const loadFiles = useCallback(
    async (library) => {
      await list(library)
      if (!library) return
      // Not awaited: nothing in a save waits on the staged names, and a staged
      // build of the 2.0 castables takes most of a second.
      window.electronAPI
        .buildStagedIndex(library, [subdir])
        .then((entry) => setStagedIndex((prev) => ({ ...prev, ...entry })))
        .catch((err) => console.error('Failed to rebuild the staged index:', err))
    },
    [list, subdir, setStagedIndex]
  )

  useEffect(() => {
    if (!activeLibrary) {
      setFiles([])
      setArchivedFiles([])
      setStagedFiles([])
      setLoading(false)
      onResetRef.current?.()
      return
    }
    setLoading(true)
    list(activeLibrary).finally(() => setLoading(false))
  }, [activeLibrary, list])

  return {
    files,
    archivedFiles,
    stagedFiles,
    // Where a new staged file goes: <world>/.staging/<type>, which may not exist yet.
    stagedDir,
    stagedNamesByFilename: stagedIndex?.[subdir]?.namesByFilename,
    loading,
    loadFiles
  }
}
