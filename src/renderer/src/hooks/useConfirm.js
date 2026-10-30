import { useCallback } from 'react'
import { useSetStoreValue, confirmDialogState } from '../store/appStore'

/**
 * Ask the user a question in the one confirm dialog that App mounts, and wait
 * for the answer.
 *
 *   const confirm = useConfirm()
 *   const choice = await confirm({ title, message, items, choices })
 *
 * `choices` is `[{ value, label, color?, variant? }]`, in button order. The
 * promise resolves with the chosen `value`, or `null` when the user closes the
 * dialog. Omit `choices` for a notice with one OK button.
 *
 * The dialog lives in the store, not in each caller, so a hook that has no JSX
 * of its own — `useBulkFileActions` — can ask, and no page mounts a dialog for
 * it (HTOO-453).
 */
export function useConfirm() {
  const setDialog = useSetStoreValue(confirmDialogState)
  return useCallback(
    (options) =>
      new Promise((resolve) => {
        setDialog({ ...options, resolve })
      }),
    [setDialog]
  )
}
