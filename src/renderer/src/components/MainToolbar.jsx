import React from 'react';
import creidhneLogo from '../assets/creidhne.svg';
import { Toolbar, IconButton, Typography, Tooltip, Divider, Box } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CalculateIcon from '@mui/icons-material/Calculate'
import InventoryIcon from '@mui/icons-material/Inventory'
import PsychologyIcon from '@mui/icons-material/Psychology'
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew'
import PetsIcon from '@mui/icons-material/Pets'
import CelebrationIcon from '@mui/icons-material/Celebration'
import GroupsIcon from '@mui/icons-material/Groups'
import PublicIcon from '@mui/icons-material/Public'
import RedeemIcon from '@mui/icons-material/Redeem'
import BubbleChartIcon from '@mui/icons-material/BubbleChart'
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt'
import ArticleIcon from '@mui/icons-material/Article'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions'
import SettingsIcon from '@mui/icons-material/Settings'
import StorageIcon from '@mui/icons-material/Storage'
import TuneIcon from '@mui/icons-material/Tune'
import MapIcon from '@mui/icons-material/Map'
import LayersIcon from '@mui/icons-material/Layers'
import MinimizeIcon from '@mui/icons-material/Minimize'
import CloseIcon from '@mui/icons-material/Close'
import MaximizeIcon from '@mui/icons-material/CheckBoxOutlineBlank'

const btnSx = {
  WebkitAppRegion: 'no-drag',
  mx: -0.5,
  color: 'text.button',
  '&:hover': {
    backgroundColor: 'info.main',
    color: 'text.dark'
  }
};

const dividerSx = { mx: 1, borderColor: 'rgba(255,255,255,0.2)' };

const MainToolbar = ({ navigate }) => {
  const handleMinimize = () => {
    window.electronAPI.minimizeWindow();
  };

  const handleMaximize = () => {
    window.electronAPI.maximizeWindow();
  };

  const handleClose = () => {
    window.electronAPI.closeWindow();
  };

  return (
    <Toolbar sx={{ bgcolor: 'secondary.main' }}>
      <img src={creidhneLogo} alt="Creidhne" style={{ height: 36, marginRight: 8 }} />
      <Typography variant="h5" sx={{ flexGrow: 0, ml: -.5, mr: 1, fontWeight: 'bold' }}>
        Creidhne: XML Forge
      </Typography>

      <Box sx={{ flexGrow: 1 }} />

      {/* Editor Icons */}
      <Tooltip title="Dashboard">
        <IconButton onClick={() => navigate('dashboard')} sx={btnSx}>
          <DashboardIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Castables">
        <IconButton onClick={() => navigate('castables')} sx={btnSx}>
          <AutoAwesomeIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Items">
        <IconButton onClick={() => navigate('items')} sx={btnSx}>
          <InventoryIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Statuses">
        <IconButton onClick={() => navigate('statuses')} sx={btnSx}>
          <PsychologyIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="NPCs">
        <IconButton onClick={() => navigate('npcs')} sx={btnSx}>
          <AccessibilityNewIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Creatures">
        <IconButton onClick={() => navigate('creatures')} sx={btnSx}>
          <PetsIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Behavior Sets">
        <IconButton onClick={() => navigate('behaviors')} sx={btnSx}>
          <CelebrationIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Nations">
        <IconButton onClick={() => navigate('nations')} sx={btnSx}>
          <PublicIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Spawngroups">
        <IconButton onClick={() => navigate('spawngroups')} sx={btnSx}>
          <GroupsIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Loot Sets">
        <IconButton onClick={() => navigate('loot')} sx={btnSx}>
          <RedeemIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Variants">
        <IconButton onClick={() => navigate('variants')} sx={btnSx}>
          <BubbleChartIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Elements">
        <IconButton onClick={() => navigate('elements')} sx={btnSx}>
          <ElectricBoltIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Recipes">
        <IconButton onClick={() => navigate('recipes')} sx={btnSx}>
          <ArticleIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Strings">
        <IconButton onClick={() => navigate('strings')} sx={btnSx}>
          <TextFieldsIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="World Map">
        <IconButton onClick={() => navigate('worldmap')} sx={btnSx}>
          <MapIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Maps">
        <IconButton onClick={() => navigate('maps')} sx={btnSx}>
          <LayersIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Server Config">
        <IconButton onClick={() => navigate('serverconfig')} sx={btnSx}>
          <StorageIcon />
        </IconButton>
      </Tooltip>

      {/* Formulas & Lua Helpers */}
      <Divider orientation="vertical" flexItem sx={dividerSx} />
      <Tooltip title="Formulas">
        <IconButton onClick={() => navigate('formulas')} sx={btnSx}>
          <CalculateIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Lua Helpers">
        <IconButton onClick={() => navigate('helpers')} sx={btnSx}>
          <IntegrationInstructionsIcon />
        </IconButton>
      </Tooltip>

      {/* Settings */}
      <Divider orientation="vertical" flexItem sx={dividerSx} />
      <Tooltip title="Constants">
        <IconButton onClick={() => navigate('constants')} sx={btnSx}>
          <TuneIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Settings">
        <IconButton onClick={() => navigate('settings')} sx={btnSx}>
          <SettingsIcon />
        </IconButton>
      </Tooltip>

      {/* Window Controls */}
      <Divider orientation="vertical" flexItem sx={dividerSx} />
      <Tooltip title="Minimize">
        <IconButton
          size="small"
          sx={{
            WebkitAppRegion: 'no-drag',
            mb: 3,
            color: 'text.button',
            backgroundColor: 'rgba(255,255,255,0.08)',
            '&:hover': {
              backgroundColor: 'info.main',
              color: 'text.dark'
            }
          }}
          onClick={handleMinimize}
        >
          <MinimizeIcon sx={{ fontSize: 'large' }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Maximize">
        <IconButton
          size="small"
          sx={{
            WebkitAppRegion: 'no-drag',
            mx: 0.5,
            mb: 3,
            color: 'text.button',
            backgroundColor: 'rgba(255,255,255,0.08)',
            '&:hover': {
              backgroundColor: 'info.main',
              color: 'text.dark'
            }
          }}
          onClick={handleMaximize}
        >
          <MaximizeIcon sx={{ fontSize: 'large' }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Close">
        <IconButton
          size="small"
          sx={{
            WebkitAppRegion: 'no-drag',
            mr: -3,
            mb: 3,
            color: 'text.button',
            backgroundColor: 'rgba(255,255,255,0.08)',
            '&:hover': {
              backgroundColor: 'info.main',
              color: 'warning.main'
            }
          }}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </Tooltip>
    </Toolbar>
  );
};

export default MainToolbar;
