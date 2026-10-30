import { useEffect, useState } from 'react'
import { Alert, Box } from '@mui/material'
import { useStoreValue, libraryIndexState, stagedIndexState } from '../../store/appStore'
import { STAGED_TYPES, stagedNames, stagedOnlyReferences } from '@shared/staging.js'

/**
 * A warning above the editor of a LIVE file that names an entity that exists
 * only in staging (HTOO-453) — a released castable that applies a status that
 * was not released with it. The server cannot find a staged entity, so the
 * reference is unresolved until that file is released too.
 *
 * The references are read from the file on disk by `refs:namesIn`, over the
 * declared table in `src/shared/entityReferences.js`, so this and the rename
 * repair agree about what a reference is. It reads again whenever either index
 * changes, which every save, stage and release does.
 *
 * Each file-backed page renders it beside `SharedKeyNotice`;
 * `stagingSites.test.js` counts them.
 */
export default function StagedReferenceNotice({ type, file }) {
  const libraryIndex = useStoreValue(libraryIndexState)
  const stagedIndex = useStoreValue(stagedIndexState)
  const [found, setFound] = useState({ path: null, refs: [] })

  const live = !!file && !file.archived && !file.staged
  const anyStaged = STAGED_TYPES.some((t) => stagedNames(stagedIndex, t).length > 0)
  const path = live && anyStaged ? file.path : null

  useEffect(() => {
    if (!path) return
    let cancelled = false
    window.electronAPI
      .namesInFiles([path], type)
      .then((byPath) => {
        if (cancelled) return
        setFound({ path, refs: stagedOnlyReferences(byPath?.[path], libraryIndex, stagedIndex) })
      })
      .catch(() => {
        if (!cancelled) setFound({ path, refs: [] })
      })
    return () => {
      cancelled = true
    }
  }, [path, type, libraryIndex, stagedIndex])

  // A result for another file, or one from before the file went out of scope,
  // is not shown.
  if (!path || found.path !== path || found.refs.length === 0) return null
  return (
    <Alert
      severity="warning"
      data-testid="staged-reference-notice"
      sx={{ mb: 2, flexShrink: 0, '& ~ div': { minHeight: 0 } }}
    >
      This file names entities that exist only in staging. The server cannot find them until they
      are released.
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {found.refs.map((r) => (
          <li key={`${r.type}:${r.name}`}>
            {r.type}: {r.name}
          </li>
        ))}
      </Box>
    </Alert>
  )
}
