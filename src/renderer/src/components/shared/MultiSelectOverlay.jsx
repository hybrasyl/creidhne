import { Box, Typography } from '@mui/material'

/**
 * Editor-pane overlay shown while the file list panel has a multiselect
 * (selectionCount > 1). Dims and blurs the editor underneath and renders
 * a centered "{n} Items Selected" hint. Pointer events are captured so a
 * stray click can't reach the muted editor — collapse the selection by
 * single-clicking a list item.
 *
 * Parent must give its container `position: 'relative'` so this absolute
 * overlay covers the right pane.
 */
export default function MultiSelectOverlay({ count }) {
  if (!count || count <= 1) return null
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
        bgcolor: 'rgba(0, 0, 0, 0.35)'
      }}
    >
      <Typography
        variant="h5"
        sx={{
          fontWeight: 'bold',
          color: 'common.white',
          textShadow: '0 1px 4px rgba(0,0,0,0.6)'
        }}
      >
        {count} Items Selected
      </Typography>
    </Box>
  )
}
