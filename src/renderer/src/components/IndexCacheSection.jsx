import { useState } from 'react'
import { Box, Typography, Button, Paper } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'

/** Why hybindex-ts marks a cache as old (its `removeReason`). */
export const REASON_LABEL = {
  oldSchema: 'An older index version',
  missingWorld: 'The world folder is gone'
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const total = (entries) => entries.reduce((sum, e) => sum + e.sizeBytes, 0)

/**
 * Settings → World indexes (HTOO-583). The world index is a cache outside the
 * world folder, and hybindex-ts never removes one: a schema bump starts a new
 * `v<N>/` folder, and a world that moves gets a new folder. This card lists the
 * caches that hybindex-ts marks as old, and removes them when you ask. It never
 * removes one by itself.
 *
 * Taliesin uses the same cache folder. A Taliesin on an older hybindex-ts reads
 * an older version, and builds its index again after a removal. A cache is not
 * data, so nothing is lost.
 */
export default function IndexCacheSection() {
  // null: not looked yet. An array: the old caches that the last look found.
  const [old, setOld] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const handleFind = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const entries = await window.electronAPI.listIndexCaches()
      setOld(entries.filter((e) => e.removeReason))
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    setBusy(true)
    try {
      const removed = await window.electronAPI.pruneIndexCaches()
      setOld([])
      setMessage(
        `Removed ${removed.length} old ${removed.length === 1 ? 'index' : 'indexes'} (${formatSize(total(removed))}).`
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box data-testid="index-cache-section">
      <Typography variant="h6" gutterBottom sx={{ color: 'text.button', fontWeight: 'bold' }}>
        World indexes
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Creidhne keeps an index of each world outside the world folder. A new version of the index,
        or a world that moved, leaves an old index on disk. Removing an old index does not change a
        world. Taliesin uses the same indexes, and builds its index again if it needs one that you
        removed.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button variant="outlined" startIcon={<SearchIcon />} onClick={handleFind} disabled={busy}>
          Find old indexes
        </Button>
        {old?.length > 0 && (
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteSweepIcon />}
            onClick={handleRemove}
            disabled={busy}
          >
            Remove {old.length} ({formatSize(total(old))})
          </Button>
        )}
      </Box>

      {old?.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }} data-testid="old-index-list">
            {old.map((e) => (
              <li key={e.dir}>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {e.libraryPath ?? e.worldKey} (v{e.schemaVersion}, {formatSize(e.sizeBytes)}):{' '}
                  {REASON_LABEL[e.removeReason]}
                </Typography>
              </li>
            ))}
          </Box>
        </Paper>
      )}
      {old?.length === 0 && !message && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No old indexes.
        </Typography>
      )}
      {message && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {message}
        </Typography>
      )}
    </Box>
  )
}
