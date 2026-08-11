import { useState } from 'react'
import { Box, Typography, Button, Tooltip, IconButton, Paper, Chip, Stack } from '@mui/material'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import ClearIcon from '@mui/icons-material/Clear'
import HelpIcon from '@mui/icons-material/Help'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import { useStoreState, taliesinPathState } from '../store/appStore'
import {
  useCompanionStatus,
  COMPANION_SOURCE_LABEL,
  companionLaunchMessage
} from '../hooks/useCompanionStatus'

// HTOO-292. The path is now an override, not the only route: Creidhne finds
// Taliesin beside itself or from the installed application, so this card usually
// has nothing to set. It shows WHERE the answer came from rather than only that
// there is one, because "it works" and "it works for the reason you think" are
// different states — a stale override that silently fell back to discovery reads
// as fine until the day discovery stops finding anything.
const TaliesinPathSection = () => {
  const [taliesinPath, setTaliesinPath] = useStoreState(taliesinPathState)
  const { resolved, staleOverride, refresh } = useCompanionStatus()
  const [message, setMessage] = useState(null)

  const handleBrowse = async () => {
    const file = await window.electronAPI.openExeFile()
    if (!file) return
    setTaliesinPath(file)
  }

  const handleClear = () => setTaliesinPath(null)

  const handleLaunch = async () => {
    setMessage(companionLaunchMessage(await window.electronAPI.launchCompanion()))
    refresh()
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: 'text.button', fontWeight: 'bold' }}>
          Taliesin (Companion App)
        </Typography>
        <Tooltip
          title="Creidhne finds Taliesin on its own — beside itself, or from the installed application. Set a path only for an unusual install. When Taliesin is found you can launch it from the toolbar or by clicking the Maps / World Maps cards on the Dashboard."
          placement="top"
        >
          <IconButton sx={{ ml: 1, color: 'text.button' }}>
            <HelpIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1, mb: 2 }}
      >
        <Chip
          size="small"
          color={resolved ? 'primary' : 'default'}
          label={resolved ? COMPANION_SOURCE_LABEL[resolved.source] : 'Not found'}
        />
        {staleOverride && <Chip size="small" color="warning" label="Selected file is missing" />}
      </Stack>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button variant="contained" startIcon={<FolderOpenIcon />} onClick={handleBrowse}>
          {taliesinPath ? 'Change Path' : 'Set Path'}
        </Button>
        <Button
          variant="outlined"
          startIcon={<RocketLaunchIcon />}
          onClick={handleLaunch}
          disabled={!resolved}
        >
          Launch Taliesin
        </Button>
        {taliesinPath && (
          <Button variant="outlined" color="error" startIcon={<ClearIcon />} onClick={handleClear}>
            Clear
          </Button>
        )}
      </Box>

      <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography variant="body2" sx={{ flex: 1, wordBreak: 'break-all', color: 'text.button' }}>
          {resolved?.target || <span style={{ opacity: 0.6 }}>(not found)</span>}
        </Typography>
      </Paper>

      {message && (
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.button' }}>
          {message}
        </Typography>
      )}
    </Box>
  )
}

export default TaliesinPathSection
