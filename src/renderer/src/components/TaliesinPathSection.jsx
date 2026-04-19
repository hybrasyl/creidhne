import React from 'react'
import { Box, Typography, Button, Tooltip, IconButton, Paper } from '@mui/material'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import ClearIcon from '@mui/icons-material/Clear'
import HelpIcon from '@mui/icons-material/Help'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import { useRecoilState } from 'recoil'
import { taliesinPathState } from '../recoil/atoms'

const TaliesinPathSection = () => {
  const [taliesinPath, setTaliesinPath] = useRecoilState(taliesinPathState)

  const handleBrowse = async () => {
    const file = await window.electronAPI.openExeFile()
    if (!file) return
    setTaliesinPath(file)
  }

  const handleClear = () => setTaliesinPath(null)

  const handleLaunch = async () => {
    if (!taliesinPath) return
    await window.electronAPI.launchCompanion(taliesinPath)
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: 'text.button', fontWeight: 'bold' }}>
          Taliesin (Companion App)
        </Typography>
        <Tooltip
          title="Path to Taliesin.exe. When set, you can launch Taliesin from the toolbar or by clicking the Maps / World Maps cards on the Dashboard."
          placement="top"
        >
          <IconButton sx={{ ml: 1, color: 'text.button' }}>
            <HelpIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button variant="contained" startIcon={<FolderOpenIcon />} onClick={handleBrowse}>
          {taliesinPath ? 'Change Path' : 'Set Path'}
        </Button>
        {taliesinPath && (
          <>
            <Button
              variant="outlined"
              startIcon={<RocketLaunchIcon />}
              onClick={handleLaunch}
            >
              Launch Taliesin
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<ClearIcon />}
              onClick={handleClear}
            >
              Clear
            </Button>
          </>
        )}
      </Box>

      <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography variant="body2" sx={{ flex: 1, wordBreak: 'break-all', color: 'text.button' }}>
          {taliesinPath || <span style={{ opacity: 0.6 }}>(not set)</span>}
        </Typography>
      </Paper>
    </Box>
  )
}

export default TaliesinPathSection
