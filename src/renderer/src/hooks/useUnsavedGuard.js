import { useState, useRef, useCallback } from 'react'
import { useRecoilState } from 'recoil'
import { dirtyEditorState } from '../recoil/atoms'

/**
 * Provides within-page unsaved-changes guard (file switch / New) and registers
 * the dirty state globally so App.jsx can intercept cross-page navigation.
 *
 * Usage in a page:
 *   const { markDirty, markClean, saveRef, guard, dialogOpen,
 *           handleDialogSave, handleDialogDiscard, handleDialogCancel } = useUnsavedGuard('Nation');
 *
 *   // Wrap file-switch / New with guard:
 *   const handleSelect = (file) => guard(() => loadFile(file));
 *   const handleNew    = ()     => guard(() => openNewForm());
 *
 *   // Clear dirty after save / archive / unarchive:
 *   markClean();
 *
 *   // Pass to editor:
 *   <Editor onDirtyChange={(d) => d ? markDirty() : markClean()} saveRef={saveRef} />
 *
 *   // Render dialog:
 *   <UnsavedChangesDialog open={dialogOpen} label="Nation"
 *     onSave={handleDialogSave} onDiscard={handleDialogDiscard} onCancel={handleDialogCancel} />
 */
export function useUnsavedGuard(label) {
  const [, setDirtyEditor] = useRecoilState(dirtyEditorState)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Ref for the pending action to run after Save/Discard in the within-page dialog.
  const pendingActionRef = useRef(null)

  // saveRef is set by the editor on each render so it always captures current data.
  const saveRef = useRef(null)

  const isDirtyRef = useRef(false)

  const markDirty = useCallback(() => {
    if (isDirtyRef.current) return
    isDirtyRef.current = true
    setDirtyEditor({
      label,
      onSave: async () => {
        await saveRef.current?.()
      }
    })
  }, [label, setDirtyEditor])

  const markClean = useCallback(() => {
    isDirtyRef.current = false
    setDirtyEditor(null)
  }, [setDirtyEditor])

  /** Runs `action` immediately if clean; otherwise opens the within-page dialog. */
  const guard = useCallback((action) => {
    if (!isDirtyRef.current) {
      action()
      return
    }
    pendingActionRef.current = action
    setDialogOpen(true)
  }, [])

  const handleDialogSave = useCallback(async () => {
    const action = pendingActionRef.current
    pendingActionRef.current = null
    setDialogOpen(false)
    try {
      await saveRef.current?.()
      // markClean is called by the page's handleSave after a successful save
    } catch {
      return // save failed — stay dirty, don't proceed
    }
    action?.()
  }, [])

  const handleDialogDiscard = useCallback(() => {
    const action = pendingActionRef.current
    pendingActionRef.current = null
    setDialogOpen(false)
    markClean()
    action?.()
  }, [markClean])

  const handleDialogCancel = useCallback(() => {
    pendingActionRef.current = null
    setDialogOpen(false)
  }, [])

  return {
    markDirty,
    markClean,
    saveRef,
    guard,
    dialogOpen,
    handleDialogSave,
    handleDialogDiscard,
    handleDialogCancel
  }
}
