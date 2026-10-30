import { useCallback, useRef, useState } from 'react'
import {
  useStoreValue,
  useSetStoreValue,
  libraryIndexState,
  stagedIndexState
} from '../store/appStore'
import { shouldOfferRepair, repairSummary } from '@shared/renameRepair.js'

/**
 * The rename-repair flow, as one call a page makes before it saves (HTOO-378).
 *
 * A page uses it in two places and nowhere else:
 *
 *   const { confirmRename, renameDialogProps } = useRenameReferences({ ... })
 *   const decision = await confirmRename(previousName, data.name)
 *   if (decision.cancelled) return          // at the top of handleSave
 *   …save the entity…
 *   await decision.apply()                  // after the entity is on disk
 *
 * and renders `<RenameReferencesDialog {...renameDialogProps} />`.
 *
 * ## Why the confirm and the write are separate awaits
 *
 * Everything the user is shown must be true when they are shown it, and the
 * entity save must not be undone by a late refusal. So the scan and the dialog
 * happen BEFORE anything is written — Cancel then genuinely writes nothing — and
 * the reference rewrite happens after the entity is safely on disk, so a failed
 * entity save cannot leave the world repointed at a name that was never
 * written.
 *
 * `apply` is always callable, and does nothing when the user chose Skip or when
 * there was nothing to offer. That keeps the call site free of a second
 * condition to get wrong.
 *
 * ## Staging (HTOO-453)
 *
 * Main scans and repoints the staged files as well, and tags them `staged`.
 * For a staged entity (`{ staged: true }`), the old name's claimants are
 * counted over the live AND the staged files: a staged twin of a live entity
 * has the live entity's name, and the files that use that name mean the live
 * one, so the repair is not offered.
 */
export function useRenameReferences({ activeLibrary, type, setSnackbar, setLibraryIndex }) {
  const libraryIndex = useStoreValue(libraryIndexState)
  const stagedIndex = useStoreValue(stagedIndexState)
  const setStagedIndex = useSetStoreValue(stagedIndexState)
  const [state, setState] = useState(null)
  // The dialog's answer arrives from a click, so the promise resolver has to
  // outlive the render that created it.
  const answerRef = useRef(null)

  const answer = useCallback((choice) => {
    setState(null)
    answerRef.current?.(choice)
    answerRef.current = null
  }, [])

  const confirmRename = useCallback(
    async (oldName, newName, { isExisting = true, staged = false } = {}) => {
      const noop = { cancelled: false, apply: async () => {} }

      // Every file's name, not the deduplicated list, so two files with one
      // name count as two claimants.
      const index = staged
        ? {
            ...libraryIndex,
            [type]: [
              ...(libraryIndex?.[type] || []),
              ...Object.values(stagedIndex?.[type]?.namesByFilename || {})
            ]
          }
        : libraryIndex
      const decision = shouldOfferRepair({
        libraryIndex: index,
        type,
        oldName,
        newName,
        isExisting
      })
      if (!decision.offer) {
        // Only the ambiguous case is worth saying out loud. The other three are
        // ordinary: a new entity, an unchanged name, a type nothing refers to.
        if (decision.reason === 'ambiguous-old-name') {
          setSnackbar?.({
            message:
              `Two or more ${type} are already named “${oldName}”, so Creidhne cannot tell ` +
              `which one other files mean. The rename is saved; references are unchanged.`,
            severity: 'warning'
          })
        }
        return noop
      }

      setState({ scanning: true, oldName, newName, result: null })
      let result
      try {
        result = await window.electronAPI.scanEntityReferences(activeLibrary, type, oldName)
      } catch (err) {
        setState(null)
        setSnackbar?.({
          message: `Could not check which files use “${oldName}”: ${err.message}`,
          severity: 'error'
        })
        return noop
      }

      // Nothing names it. Do not open a dialog to say so — the save is the
      // answer the user asked for.
      if (!result.total) {
        setState(null)
        return noop
      }

      setState({ scanning: false, oldName, newName, result })
      const choice = await new Promise((resolve) => {
        answerRef.current = resolve
      })

      if (choice === 'cancel') return { cancelled: true, apply: async () => {} }
      if (choice === 'skip') return noop

      return {
        cancelled: false,
        apply: async () => {
          try {
            const applied = await window.electronAPI.applyEntityRename(
              activeLibrary,
              type,
              oldName,
              newName
            )
            // HTOO-372's rule, applied to the files this write touched rather
            // than the one the page saved. A repair writes into OTHER sections —
            // repointing an item name edits npcs — and those sections carry the
            // cross-references the index serves (itemVendors, castableTrainers).
            // Leaving them unrefreshed makes the renderer stale for the session
            // in exactly the way that card was about.
            const touched = [
              ...new Set(applied.changed.filter((f) => !f.staged).map((f) => f.sourceType))
            ]
            for (const sourceType of touched) {
              const section = await window.electronAPI.buildIndexSection(activeLibrary, sourceType)
              setLibraryIndex?.((prev) => ({ ...prev, ...section }))
            }
            const stagedTouched = [
              ...new Set(applied.changed.filter((f) => f.staged).map((f) => f.sourceType))
            ]
            if (stagedTouched.length) {
              const entry = await window.electronAPI.buildStagedIndex(activeLibrary, stagedTouched)
              setStagedIndex((prev) => ({ ...prev, ...entry }))
            }
            setSnackbar?.({
              message: repairSummary(applied),
              severity: applied.failed?.length ? 'warning' : 'success'
            })
          } catch (err) {
            setSnackbar?.({
              message: `The rename was saved, but the references were not updated: ${err.message}`,
              severity: 'error'
            })
          }
        }
      }
    },
    [activeLibrary, libraryIndex, stagedIndex, type, setSnackbar, setLibraryIndex, setStagedIndex]
  )

  return {
    confirmRename,
    renameDialogProps: {
      open: state !== null,
      scanning: state?.scanning ?? false,
      oldName: state?.oldName ?? '',
      newName: state?.newName ?? '',
      result: state?.result ?? null,
      onUpdate: () => answer('update'),
      onSkip: () => answer('skip'),
      onCancel: () => answer('cancel')
    }
  }
}
