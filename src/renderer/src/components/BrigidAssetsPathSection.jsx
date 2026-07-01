import { Box, Typography, Button, Tooltip, IconButton, Paper } from '@mui/material'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import ClearIcon from '@mui/icons-material/Clear'
import HelpIcon from '@mui/icons-material/Help'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { useRecoilState } from 'recoil'
import { brigidAssetsPathState } from '../recoil/atoms'

const BrigidAssetsPathSection = () => {
  const [brigidAssetsPath, setBrigidAssetsPath] = useRecoilState(brigidAssetsPathState)

  const handleBrowse = async () => {
    const dir = await window.electronAPI.openDirectory()
    if (!dir) return
    setBrigidAssetsPath(dir)
  }

  const handleUseDefault = async () => {
    const suggested = await window.electronAPI.getSuggestedBrigidAssetsPath()
    if (suggested) setBrigidAssetsPath(suggested)
  }

  const handleClear = () => setBrigidAssetsPath(null)

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: 'text.button', fontWeight: 'bold' }}>
          Brigid Asset Packs
        </Typography>
        <Tooltip
          title="Folder where Brigid stores its modern .datf asset packs (default: %LOCALAPPDATA%\erisco\Brigid\assets). Sprite pickers scan this folder — in addition to the Dark Ages client folder — for Hybrasyl overrides."
          placement="top"
        >
          <IconButton sx={{ ml: 1, color: 'text.button' }}>
            <HelpIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button variant="contained" startIcon={<FolderOpenIcon />} onClick={handleBrowse}>
          {brigidAssetsPath ? 'Change Path' : 'Set Path'}
        </Button>
        <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={handleUseDefault}>
          Use Default
        </Button>
        {brigidAssetsPath && (
          <Button variant="outlined" color="error" startIcon={<ClearIcon />} onClick={handleClear}>
            Clear
          </Button>
        )}
      </Box>

      <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography variant="body2" sx={{ flex: 1, wordBreak: 'break-all', color: 'text.button' }}>
          {brigidAssetsPath || <span style={{ opacity: 0.6 }}>(not set)</span>}
        </Typography>
      </Paper>
    </Box>
  )
}

export default BrigidAssetsPathSection
