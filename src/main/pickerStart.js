import { existsSync } from 'fs'
import { dirname } from 'path'

// Where a file or folder picker opens (HTOO-553). Since Electron 43 a dialog with
// no `defaultPath` opens in Downloads, not in the last folder used, so every
// picker passes one. Candidates are in order of preference; the first that exists
// wins. A stale setting (a folder since moved) is skipped rather than handed to
// the dialog, which would fall back to Downloads again.

/** The first candidate that is a non-empty string and exists on disk. */
export function pickerStartPath(candidates, exists = existsSync) {
  for (const p of candidates) {
    if (typeof p === 'string' && p !== '' && exists(p)) return p
  }
  return undefined
}

/** The folder to remember from a pick: the folder itself, or a file's parent. */
export function pickedFolder(path, isDirectory) {
  return isDirectory ? path : dirname(path)
}
