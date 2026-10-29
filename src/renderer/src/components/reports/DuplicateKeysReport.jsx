import { useMemo } from 'react'
import { Box, Button, Chip, Divider, Paper, Typography } from '@mui/material'
import {
  useStoreValue,
  useStoreState,
  activeLibraryState,
  libraryIndexState,
  currentPageState
} from '../../store/appStore'
import { useOpenFileStore } from '../../store/openFileStore'
import { duplicateKeyGroups } from '@shared/duplicateKeys.js'
import { PAGE_FOR_TYPE } from '../../utils/typePages'

/**
 * The files on disk that share a key (HTOO-625), read from the index. The
 * server loads one file of each group and reports nothing (HXML-38). Open
 * goes to the file's editor, which names the other files of the group.
 */
export default function DuplicateKeysReport() {
  const activeLibrary = useStoreValue(activeLibraryState)
  const libraryIndex = useStoreValue(libraryIndexState)
  const [, setCurrentPage] = useStoreState(currentPageState)
  const groups = useMemo(() => duplicateKeyGroups(libraryIndex), [libraryIndex])

  const open = (type, rel) => {
    useOpenFileStore.getState().open(type, rel)
    setCurrentPage(PAGE_FOR_TYPE[type])
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h5" sx={{ flex: 1 }}>
          Duplicate keys
        </Typography>
        {activeLibrary && <Chip size="small" variant="outlined" label={`${groups.length} keys`} />}
      </Box>
      <Divider sx={{ mb: 2 }} />
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Each key here is held by more than one active file. The server loads only one of the files,
        and it does not tell you which. Give each file its own key, or archive the files that you do
        not need. Keys that differ only in capitals are marked: the server can treat them as one key
        or as two.
      </Typography>

      {!activeLibrary ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Open a library from Settings first.
        </Typography>
      ) : groups.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No two active files have the same key.
        </Typography>
      ) : (
        groups.map((g) => (
          <Paper
            key={`${g.type}:${g.key}`}
            variant="outlined"
            sx={{ p: 1.5, mb: 1 }}
            data-testid="duplicate-key-group"
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle2">{g.key}</Typography>
              <Chip size="small" label={g.type} />
              {g.caseOnly && (
                <Chip size="small" color="info" variant="outlined" label="differ only in case" />
              )}
            </Box>
            {g.files.map((rel) => (
              <Box key={rel} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
                  {rel}
                </Typography>
                {PAGE_FOR_TYPE[g.type] && (
                  <Button size="small" aria-label={`Open ${rel}`} onClick={() => open(g.type, rel)}>
                    Open
                  </Button>
                )}
              </Box>
            ))}
          </Paper>
        ))
      )}
    </Box>
  )
}
