import { useStoreValue, libraryIndexState, stagedIndexState } from '../../store/appStore'
import { sharedKeyGroup } from '@shared/duplicateKeys.js'
import { stagedKeyClash } from '@shared/staging.js'
import { EditorAlert, useEditorAlert } from './EditorAlerts'

/** In place (outside an alerts area), the notice keeps its height and the editor after it may shrink. */
const NOTICE_SX = { mb: 2, flexShrink: 0, '& ~ div': { minHeight: 0 } }

/** The alert for `file`, as data, or null. */
function sharedKeyAlert(libraryIndex, stagedIndex, type, file) {
  if (!file || file.archived) return null

  if (file.staged) {
    const clash = stagedKeyClash(libraryIndex, stagedIndex, type, file.rel)
    if (!clash) return null
    const parts = []
    if (clash.live.length) {
      parts.push(
        'A live file has this key. Release refuses this file until you rename it, or archive the live one.'
      )
    }
    if (clash.staged.length) {
      parts.push('Other staged files have this key. Release can move only one of them.')
    }
    return {
      order: 10,
      severity: 'warning',
      testId: 'shared-key-notice',
      message: parts.join(' '),
      items: [...clash.live, ...clash.staged.map((rel) => `.staging/${type}/${rel}`)]
    }
  }

  const group = sharedKeyGroup(libraryIndex, type, file.rel)
  if (!group) return null
  return {
    order: 10,
    severity: group.caseOnly ? 'info' : 'warning',
    testId: 'shared-key-notice',
    message: group.caseOnly
      ? 'Other files have this key with different capitals. The server can treat them as one key or as two.'
      : 'Other files have this key. The server loads only one of these files.',
    items: group.files.filter((rel) => rel !== file.rel)
  }
}

/**
 * A warning when the open file has the same key as another active file
 * (HTOO-625). The server loads one of the files and reports nothing, so this
 * names the others. An archived file is never in a group.
 *
 * A staged file (HTOO-453) is compared with the live files and the other staged
 * files. A live file with its key is the reason Release refuses it, and the
 * Name field cannot show that: it compares with the name the file was saved
 * with, which is the twin's name.
 *
 * It shows in the editor's alerts area (HTOO-628), or in place when there is
 * none. Each file-backed page renders it; `openFileSites.test.js` counts them.
 */
export default function SharedKeyNotice({ type, file }) {
  const libraryIndex = useStoreValue(libraryIndexState)
  const stagedIndex = useStoreValue(stagedIndexState)
  const alert = sharedKeyAlert(libraryIndex, stagedIndex, type, file)
  const inArea = useEditorAlert('shared-key', alert)
  if (!alert || inArea) return null
  return <EditorAlert alert={alert} sx={NOTICE_SX} />
}
