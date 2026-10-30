import { useCallback, useState } from 'react'
import {
  useStoreValue,
  useSetStoreValue,
  libraryIndexState,
  stagedIndexState
} from '../store/appStore'
import { useConfirm } from './useConfirm'
import { nameCollisionKey } from '@shared/nameCollision.js'
import { REFERENCE_SITES } from '@shared/entityReferences.js'
import { countLabel } from '@shared/renameRepair.js'
import { releaseClashes, stagedFileFor, stagedOnlyReferences } from '@shared/staging.js'

/** `[[key, items]]` for `items` grouped by `item[key]`, in first-seen order. */
function groupBy(items, key) {
  const groups = new Map()
  for (const item of items) groups.set(item[key], [...(groups.get(item[key]) || []), item])
  return [...groups]
}

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
 *   setLibraryIndex     — store setter; merged with rebuilt index section
 *   loadFiles           — page reload helper (accepts an activeLibrary arg); one
 *                         listSection call now returns active + archived together
 *   setSnackbar         — page snackbar setter; receives { message, severity }
 *   markClean           — useUnsavedGuard.markClean — drops dirty state on bulk op
 *
 * Stage and Release (HTOO-453) move files between `xml/<type>/` and
 * `.staging/<type>/`, and each one checks first what the move would break:
 *
 *   - Stage names the live files that refer to what is being staged. After the
 *     move, each of them names an entity the server cannot find.
 *   - Release refuses a file whose name is already live, because the server
 *     loads one of two files with the same key and says nothing. It then finds
 *     the staged-only names the released files refer to, and offers to release
 *     those files too, so a released castable does not apply a status that
 *     exists only in staging.
 */
export function useBulkFileActions({
  activeLibrary,
  subdir,
  ignoreSubdir,
  selectedFile,
  setSelectedFile,
  clearEditing,
  setLibraryIndex,
  loadFiles,
  setSnackbar,
  markClean
}) {
  const [selectionCount, setSelectionCount] = useState(0)
  const libraryIndex = useStoreValue(libraryIndexState)
  const stagedIndex = useStoreValue(stagedIndexState)
  const setStagedIndex = useSetStoreValue(stagedIndexState)
  const confirm = useConfirm()

  const refreshAfterBulk = useCallback(
    async (touchedPaths) => {
      if (!activeLibrary) return
      if (selectedFile && touchedPaths.includes(selectedFile.path)) {
        setSelectedFile(null)
        clearEditing?.()
        markClean?.()
      }
      await loadFiles(activeLibrary)
      const section = await window.electronAPI.buildIndexSection(activeLibrary, subdir)
      setLibraryIndex((prev) => ({ ...prev, ...section }))
    },
    [
      activeLibrary,
      selectedFile,
      setSelectedFile,
      clearEditing,
      markClean,
      loadFiles,
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
      const result = await window.electronAPI.unarchiveFiles(paths, `${activeLibrary}/${subdir}`)
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
        await loadFiles(activeLibrary)
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
    [activeLibrary, subdir, loadFiles, setLibraryIndex, setSnackbar]
  )

  // The live files, outside `moving`, that name an entity in `moving`. A name
  // that another live file also has is skipped: its referrers still resolve.
  const liveReferrers = useCallback(
    async (moving) => {
      if (!REFERENCE_SITES[subdir]?.length) return []
      const byFile = libraryIndex?.[`${subdir}NamesByFilename`] || {}
      const movingRels = new Set(moving.map((f) => f.rel))
      const out = []
      const seen = new Set()
      for (const f of moving) {
        const name = byFile[f.rel]
        const key = nameCollisionKey(name)
        if (!name || seen.has(key)) continue
        seen.add(key)
        const keptBy = Object.entries(byFile).some(
          ([rel, n]) => !movingRels.has(rel) && nameCollisionKey(n) === key
        )
        if (keptBy) continue
        const scan = await window.electronAPI.scanEntityReferences(activeLibrary, subdir, name)
        for (const r of scan.files) {
          if (r.staged) continue
          if (r.sourceType === subdir && movingRels.has(r.rel)) continue
          out.push(`${r.sourceType}/${r.rel} names “${name}”`)
        }
      }
      return out
    },
    [activeLibrary, subdir, libraryIndex]
  )

  const handleBulkStage = useCallback(
    async (selected) => {
      if (!activeLibrary || !selected || selected.length === 0) return
      const moving = selected.filter((f) => !f.staged && !f.archived)
      if (moving.length === 0) return
      let referrers
      try {
        referrers = await liveReferrers(moving)
      } catch (err) {
        setSnackbar?.({ message: `Could not check references: ${err.message}`, severity: 'error' })
        return
      }
      if (referrers.length) {
        const choice = await confirm({
          title: `Stage ${countLabel(moving.length, 'file')}?`,
          message:
            'These live files name what you are staging. The server cannot find a staged ' +
            'entity, so these references stay unresolved until you release it again.',
          items: referrers,
          choices: [{ value: 'stage', label: 'Stage', variant: 'contained' }]
        })
        if (choice !== 'stage') return
      }
      const paths = moving.map((f) => f.path)
      const result = await window.electronAPI.stageFiles(activeLibrary, subdir, paths)
      await refreshAfterBulk(paths)
      reportBulkResult(result, 'Staged')
    },
    [activeLibrary, subdir, liveReferrers, confirm, refreshAfterBulk, reportBulkResult, setSnackbar]
  )

  const handleBulkRelease = useCallback(
    async (selected) => {
      if (!activeLibrary || !selected || selected.length === 0) return
      const chosen = selected.filter((f) => f.staged)
      if (chosen.length === 0) return
      // `dir` is `<world>/.staging/<type>`, so the root is one segment up.
      const root = chosen[0].dir.slice(0, chosen[0].dir.length - subdir.length - 1)
      const nameOf = (type, rel) => stagedIndex?.[type]?.namesByFilename?.[rel] ?? ''
      const release = chosen.map((f) => ({
        type: subdir,
        rel: f.rel,
        path: f.path,
        name: nameOf(subdir, f.rel),
        dependency: false
      }))
      const has = (type, name) =>
        release.some((r) => r.type === type && nameCollisionKey(r.name) === nameCollisionKey(name))

      // Follow the staged-only references until none is left: a released
      // castable can apply a staged status, which can name a staged castable.
      try {
        let frontier = release
        while (frontier.length) {
          const next = []
          for (const [type, group] of groupBy(frontier, 'type')) {
            const refs = await window.electronAPI.namesInFiles(
              group.map((r) => r.path),
              type
            )
            for (const r of group) {
              for (const ref of stagedOnlyReferences(refs[r.path], libraryIndex, stagedIndex)) {
                if (has(ref.type, ref.name)) continue
                const rel = stagedFileFor(stagedIndex, ref.type, ref.name)
                if (!rel) continue
                const dep = {
                  type: ref.type,
                  rel,
                  path: `${root}/${ref.type}/${rel}`,
                  name: nameOf(ref.type, rel) || ref.name,
                  dependency: true,
                  neededBy: r.name || r.rel
                }
                release.push(dep)
                next.push(dep)
              }
            }
          }
          frontier = next
        }
      } catch (err) {
        setSnackbar?.({ message: `Could not check references: ${err.message}`, severity: 'error' })
        return
      }

      let moving = release
      const deps = release.filter((r) => r.dependency)
      if (deps.length) {
        const choice = await confirm({
          title: 'Release the staged files these name?',
          message:
            'The files you are releasing name entities that exist only in staging. The server ' +
            'cannot find those until they are released too.',
          items: deps.map((d) => `${d.type}/${d.rel} (“${d.name}”, named by “${d.neededBy}”)`),
          choices: [
            { value: 'selected', label: 'Release only the selected' },
            { value: 'all', label: `Release all ${release.length}`, variant: 'contained' }
          ]
        })
        if (!choice) return
        if (choice === 'selected') moving = release.filter((r) => !r.dependency)
      }

      const clashes = releaseClashes(moving, libraryIndex)
      if (clashes.length) {
        await confirm({
          title: 'Nothing was released',
          message:
            'The server loads only one of two files with the same name. Rename these, or ' +
            'archive the live file, before you release them.',
          items: clashes.map(
            (c) =>
              `${c.type}/${c.rel}: “${c.name}” ${
                c.reason === 'live' ? 'is already live' : 'is in this release twice'
              }`
          )
        })
        return
      }

      const ok = []
      const failed = []
      for (const [type, group] of groupBy(moving, 'type')) {
        const r = await window.electronAPI.releaseFiles(
          activeLibrary,
          type,
          group.map((g) => g.path)
        )
        ok.push(...r.ok)
        failed.push(...r.failed)
      }
      const touched = [...new Set(moving.map((r) => r.type))]
      await refreshAfterBulk(moving.map((r) => r.path))
      // refreshAfterBulk rebuilt this page's type, live and staged. The
      // dependencies moved files of other types, which have their own sections.
      const others = touched.filter((t) => t !== subdir)
      for (const type of others) {
        const section = await window.electronAPI.buildIndexSection(activeLibrary, type)
        setLibraryIndex((prev) => ({ ...prev, ...section }))
      }
      if (others.length) {
        const staged = await window.electronAPI.buildStagedIndex(activeLibrary, others)
        setStagedIndex((prev) => ({ ...prev, ...staged }))
      }
      reportBulkResult({ ok, failed }, 'Released')
    },
    [
      activeLibrary,
      subdir,
      libraryIndex,
      stagedIndex,
      confirm,
      refreshAfterBulk,
      reportBulkResult,
      setLibraryIndex,
      setStagedIndex,
      setSnackbar
    ]
  )

  // Single-item wrappers for the editor's existing buttons.
  const handleStage = useCallback(async () => {
    if (!selectedFile) return
    await handleBulkStage([selectedFile])
  }, [selectedFile, handleBulkStage])

  const handleRelease = useCallback(async () => {
    if (!selectedFile) return
    await handleBulkRelease([selectedFile])
  }, [selectedFile, handleBulkRelease])

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
    handleDuplicate,
    handleStage,
    handleRelease,
    handleBulkStage,
    handleBulkRelease
  }
}
