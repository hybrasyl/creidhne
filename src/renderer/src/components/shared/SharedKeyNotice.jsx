import { Alert, Box } from '@mui/material'
import { useStoreValue, libraryIndexState } from '../../store/appStore'
import { sharedKeyGroup } from '@shared/duplicateKeys.js'

/**
 * A warning above an editor when the open file has the same key as another
 * active file (HTOO-625). The server loads one of the files and reports
 * nothing, so this names the others. An archived file is never in a group.
 *
 * Each file-backed page renders it above its editor; `openFileSites.test.js`
 * counts them.
 */
export default function SharedKeyNotice({ type, file }) {
  const libraryIndex = useStoreValue(libraryIndexState)
  if (!file || file.archived) return null
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
      sx={{ mb: 2, flexShrink: 0, '& ~ div': { minHeight: 0 } }}
    >
      {group.caseOnly ? (
        <>
          Other files have this key with different capitals. The server can treat them as one key or
          as two.
        </>
      ) : (
        <>Other files have this key. The server loads only one of these files.</>
      )}
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {others.map((rel) => (
          <li key={rel}>{rel}</li>
        ))}
      </Box>
    </Alert>
  )
}
