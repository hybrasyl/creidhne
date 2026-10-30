import { Alert, Box } from '@mui/material'
import { useStoreValue, libraryIndexState, stagedIndexState } from '../../store/appStore'
import { sharedKeyGroup } from '@shared/duplicateKeys.js'
import { stagedKeyClash } from '@shared/staging.js'

/** The notice's box. Shared by the live and the staged notice, so both fit the pane. */
const NOTICE_SX = { mb: 2, flexShrink: 0, '& ~ div': { minHeight: 0 } }

function FileList({ rels }) {
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
      {rels.map((rel) => (
        <li key={rel}>{rel}</li>
      ))}
    </Box>
  )
}

/**
 * A warning above an editor when the open file has the same key as another
 * active file (HTOO-625). The server loads one of the files and reports
 * nothing, so this names the others. An archived file is never in a group.
 *
 * A staged file (HTOO-453) is compared with the live files and the other staged
 * files. A live file with its key is the reason Release refuses it, and the
 * Name field cannot show that: it compares with the name the file was saved
 * with, which is the twin's name.
 *
 * Each file-backed page renders it above its editor; `openFileSites.test.js`
 * counts them.
 */
export default function SharedKeyNotice({ type, file }) {
  const libraryIndex = useStoreValue(libraryIndexState)
  const stagedIndex = useStoreValue(stagedIndexState)
  if (!file || file.archived) return null

  if (file.staged) {
    const clash = stagedKeyClash(libraryIndex, stagedIndex, type, file.rel)
    if (!clash) return null
    return (
      <Alert severity="warning" data-testid="shared-key-notice" sx={NOTICE_SX}>
        {clash.live.length > 0 && (
          <>
            A live file has this key. Release refuses this file until you rename it, or archive the
            live one.
            <FileList rels={clash.live} />
          </>
        )}
        {clash.staged.length > 0 && (
          <>
            Other staged files have this key. Release can move only one of them.
            <FileList rels={clash.staged} />
          </>
        )}
      </Alert>
    )
  }

  const group = sharedKeyGroup(libraryIndex, type, file.rel)
  if (!group) return null
  const others = group.files.filter((rel) => rel !== file.rel)
  return (
    <Alert
      severity={group.caseOnly ? 'info' : 'warning'}
      data-testid="shared-key-notice"
      // Each editor pane is a flex column, and each editor is height 100%. The
      // notice keeps its height, and the editor after it may shrink, so its
      // bottom stays in the pane.
      sx={NOTICE_SX}
    >
      {group.caseOnly ? (
        <>
          Other files have this key with different capitals. The server can treat them as one key or
          as two.
        </>
      ) : (
        <>Other files have this key. The server loads only one of these files.</>
      )}
      <FileList rels={others} />
    </Alert>
  )
}
