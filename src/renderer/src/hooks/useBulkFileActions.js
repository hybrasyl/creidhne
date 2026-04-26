import { useCallback, useState } from 'react'

/**
 * Wires the panel's bulk archive/unarchive/delete callbacks for a single
 * editor page. Encodes the shared "act, refresh, snackbar" sequence so each
 * page reduces to: instantiate the hook, pass the returned handlers to
 * EditorFileListPanel, render <MultiSelectOverlay count={selectionCount} />.
 *
 * Also exposes single-item handleArchive/handleUnarchive that ride the bulk
 * path with a 1-element array — these slot into the existing editor-side
 * Archive/Unarchive buttons without needing per-page duplication.
 *
 * Required wiring:
 *   activeLibrary       — current library root, e.g. '/path/to/world'
 *   subdir              — entity subdir under the library, e.g. 'items'
 *   ignoreSubdir        — archive subdir, e.g. 'items/.ignore'
 *   selectedFile        — the currently-edited file (or null)
 *   setSelectedFile     — clears the editor when its file is touched by a bulk op
 *   clearEditing        — page-specific editor-state clearer (e.g. setEditingItem(null))
 *   setLibraryIndex     — Recoil setter; merged with rebuilt index section
 *   loadActiveFiles     — page reload helpers (already accept an activeLibrary arg)
 *   loadArchivedFiles
 *   setSnackbar         — page snackbar setter; receives { message, severity }
 *   markClean           — useUnsavedGuard.markClean — drops dirty state on bulk op
 */
export function useBulkFileActions({
  activeLibrary,
  subdir,
  ignoreSubdir,
  selectedFile,
  setSelectedFile,
  clearEditing,
  setLibraryIndex,
  loadActiveFiles,
  loadArchivedFiles,
  setSnackbar,
  markClean
}) {
  const [selectionCount, setSelectionCount] = useState(0)

  const refreshAfterBulk = useCallback(
    async (touchedPaths) => {
      if (!activeLibrary) return
      if (selectedFile && touchedPaths.includes(selectedFile.path)) {
        setSelectedFile(null)
        clearEditing?.()
        markClean?.()
      }
      await loadActiveFiles(activeLibrary)
      await loadArchivedFiles(activeLibrary)
      const section = await window.electronAPI.buildIndexSection(activeLibrary, subdir)
      setLibraryIndex((prev) => ({ ...prev, ...section }))
    },
    [
      activeLibrary,
      selectedFile,
      setSelectedFile,
      clearEditing,
      markClean,
      loadActiveFiles,
      loadArchivedFiles,
      setLibraryIndex,
      subdir
    ]
  )

  const reportBulkResult = useCallback(
    (result, verb) => {
      const okCount = result?.ok?.length ?? 0
      const failCount = result?.failed?.length ?? 0
      if (failCount === 0) {
        setSnackbar?.({
          message: `${verb} ${okCount} item${okCount === 1 ? '' : 's'}.`,
          severity: 'success'
        })
      } else {
        const firstReason = result.failed[0]?.reason || 'unknown'
        const more = failCount > 1 ? `, +${failCount - 1} more` : ''
        setSnackbar?.({
          message: `${verb} ${okCount}, ${failCount} failed (${firstReason}${more}).`,
          severity: okCount === 0 ? 'error' : 'warning'
        })
      }
    },
    [setSnackbar]
  )

  const handleBulkArchive = useCallback(
    async (selected) => {
      if (!activeLibrary || !selected || selected.length === 0) return
      const paths = selected.map((f) => f.path)
      const result = await window.electronAPI.archiveFiles(
        paths,
        `${activeLibrary}/${ignoreSubdir}`
      )
      await refreshAfterBulk(paths)
      reportBulkResult(result, 'Archived')
    },
    [activeLibrary, ignoreSubdir, refreshAfterBulk, reportBulkResult]
  )

  const handleBulkUnarchive = useCallback(
    async (selected) => {
      if (!activeLibrary || !selected || selected.length === 0) return
      const paths = selected.map((f) => f.path)
      const result = await window.electronAPI.unarchiveFiles(
        paths,
        `${activeLibrary}/${subdir}`
      )
      await refreshAfterBulk(paths)
      reportBulkResult(result, 'Unarchived')
    },
    [activeLibrary, subdir, refreshAfterBulk, reportBulkResult]
  )

  const handleBulkDelete = useCallback(
    async (selected) => {
      if (!activeLibrary || !selected || selected.length === 0) return
      const paths = selected.map((f) => f.path)
      const result = await window.electronAPI.trashFiles(paths)
      await refreshAfterBulk(paths)
      reportBulkResult(result, 'Sent to trash:')
    },
    [activeLibrary, refreshAfterBulk, reportBulkResult]
  )

  // Single-only — panel enforces this. The duplicate is a byte copy under a
  // new "_copy" filename; the inner Name is unchanged so the user gets a
  // dup-name warning the first time they save the duplicate (intentional —
  // forces a rename).
  const handleDuplicate = useCallback(
    async (file) => {
      if (!activeLibrary || !file) return
      try {
        const result = await window.electronAPI.duplicateFile(file.path)
        await loadActiveFiles(activeLibrary)
        const section = await window.electronAPI.buildIndexSection(activeLibrary, subdir)
        setLibraryIndex((prev) => ({ ...prev, ...section }))
        setSnackbar?.({
          message: `Duplicated to "${result.duplicateAs}".`,
          severity: 'success'
        })
      } catch (err) {
        setSnackbar?.({
          message: `Duplicate failed: ${err?.message || 'unknown error'}`,
          severity: 'error'
        })
      }
    },
    [activeLibrary, subdir, loadActiveFiles, setLibraryIndex, setSnackbar]
  )

  // Single-item wrappers for the editor's existing buttons.
  const handleArchive = useCallback(async () => {
    if (!selectedFile) return
    await handleBulkArchive([selectedFile])
  }, [selectedFile, handleBulkArchive])

  const handleUnarchive = useCallback(async () => {
    if (!selectedFile) return
    await handleBulkUnarchive([selectedFile])
  }, [selectedFile, handleBulkUnarchive])

  const onSelectionChange = useCallback((set) => setSelectionCount(set.size), [])

  return {
    selectionCount,
    onSelectionChange,
    handleArchive,
    handleUnarchive,
    handleBulkArchive,
    handleBulkUnarchive,
    handleBulkDelete,
    handleDuplicate
  }
}
