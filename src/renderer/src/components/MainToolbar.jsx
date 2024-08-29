import React from 'react';
import { Toolbar, IconButton, Typography, Tooltip } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CalculateIcon from '@mui/icons-material/Calculate'
import InventoryIcon from '@mui/icons-material/Inventory'
import PsychologyIcon from '@mui/icons-material/Psychology'
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew'
import PetsIcon from '@mui/icons-material/Pets'
import CelebrationIcon from '@mui/icons-material/Celebration'
import GroupsIcon from '@mui/icons-material/Groups'
import RedeemIcon from '@mui/icons-material/Redeem'
import BubbleChartIcon from '@mui/icons-material/BubbleChart'
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt'
import ScienceIcon from '@mui/icons-material/Science'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions'
import SettingsIcon from '@mui/icons-material/Settings'
import MinimizeIcon from '@mui/icons-material/Minimize'
import CloseIcon from '@mui/icons-material/Close'
import MaximizeIcon from '@mui/icons-material/CheckBoxOutlineBlank'

const MainToolbar = ({ navigate }) => {
  const handleMinimize = () => {
    window.electronAPI.minimizeWindow(); // IPC call to minimize window
  };

  const handleMaximize = () => {
    window.electronAPI.maximizeWindow(); // IPC call to maximize/restore window
  };

  const handleClose = () => {
    window.electronAPI.closeWindow(); // IPC call to close window
  };

  return (
<Toolbar sx={{ bgcolor: 'secondary.main' }}>
<Typography variant="h5" sx={{ flexGrow: 1, ml: -2, fontWeight: 'bold' }}>
  Creidhne: XML Forge
</Typography>
<Tooltip title="Dashboard">
  <IconButton
    onClick={() => navigate('dashboard')}
    sx={{
      WebkitAppRegion: 'no-drag',
      mx: -0.5,
      color: 'text.button',
      '&:hover': {
        backgroundColor: 'info.main', // Background color on hover,
        color: 'text.dark'
      }
    }}
  >
    <DashboardIcon />
  </IconButton>
</Tooltip>
<Tooltip title="Castables">
  <IconButton
    color="inherit"
    onClick={() => navigate('castables')}
    sx={{
      WebkitAppRegion: 'no-drag',
      mx: -0.5,
      color: 'text.button',
      '&:hover': {
        backgroundColor: 'info.main', // Background color on hover,
        color: 'text.dark'
      }
    }}
  >
    <AutoAwesomeIcon />
  </IconButton>
</Tooltip>
<Tooltip title="Formulas">
  <IconButton
    color="inherit"
    onClick={() => navigate('formulas')}
    sx={{
      WebkitAppRegion: 'no-drag',
      mx: -0.5,
      color: 'text.button',
      '&:hover': {
        backgroundColor: 'info.main', // Background color on hover,
        color: 'text.dark'
      }
    }}
  >
    <CalculateIcon />
  </IconButton>
</Tooltip>
<Tooltip title="Items">
  <IconButton
    color="inherit"
    onClick={() => navigate('items')}
    sx={{
      WebkitAppRegion: 'no-drag',
      mx: -0.5,
      color: 'text.button',
      '&:hover': {
        backgroundColor: 'info.main', // Background color on hover,
        color: 'text.dark'
      }
    }}
  >
    <InventoryIcon />
  </IconButton>
</Tooltip>
<Tooltip title="Statuses">
  <IconButton
    color="inherit"
    onClick={() => navigate('statuses')}
    sx={{
      WebkitAppRegion: 'no-drag',
      mx: -0.5,
      color: 'text.button',
      '&:hover': {
        backgroundColor: 'info.main', // Background color on hover,
        color: 'text.dark'
      }
    }}
  >
    <PsychologyIcon />
  </IconButton>
</Tooltip>
<Tooltip title="NPCs">
  <IconButton
    color="inherit"
    onClick={() => navigate('npcs')}
    sx={{
      WebkitAppRegion: 'no-drag',
      mx: -0.5,
      color: 'text.button',
      '&:hover': {
        backgroundColor: 'info.main', // Background color on hover,
        color: 'text.dark'
      }
    }}
  >
    <AccessibilityNewIcon />
  </IconButton>
</Tooltip>
<Tooltip title="Creatures">
  <IconButton
    color="inherit"
    onClick={() => navigate('creatures')}
    sx={{
      WebkitAppRegion: 'no-drag',
      mx: -0.5,
      color: 'text.button',
      '&:hover': {
        backgroundColor: 'info.main', // Background color on hover,
        color: 'text.dark'
      }
    }}
  >
    <PetsIcon />
  </IconButton>
</Tooltip>
<Tooltip title="Behavior Sets">
  <IconButton
    color="inherit"
    onClick={() => navigate('behaviors')}
    sx={{
      WebkitAppRegion: 'no-drag',
      mx: -0.5,
      color: 'text.button',
      '&:hover': {
        backgroundColor: 'info.main', // Background color on hover,
        color: 'text.dark'
      }
    }}
  >
    <CelebrationIcon />
  </IconButton>
</Tooltip>
<Tooltip title="Spawngroups">
  <IconButton
    color="inherit"
    onClick={() => navigate('spawngroups')}
    sx={{
      WebkitAppRegion: 'no-drag',
      mx: -0.5,
      color: 'text.button',
      '&:hover': {
        backgroundColor: 'info.main', // Background color on hover,
        color: 'text.dark'
      }
    }}
  >
    <GroupsIcon />
  </IconButton>
</Tooltip>
<Tooltip title="Loot Sets">
  <IconButton
    color="inherit"
    onClick={() => navigate('loot')}
    sx={{
      WebkitAppRegion: 'no-drag',
      mx: -0.5,
      color: 'text.button',
      '&:hover': {
        backgroundColor: 'info.main', // Background color on hover,
        color: 'text.dark'
      }
    }}
  >
    <RedeemIcon />
  </IconButton>
</Tooltip>
<Tooltip title="Variants">
  <IconButton
    color="inherit"
    onClick={() => navigate('variants')}
    sx={{
      WebkitAppRegion: 'no-drag',
      mx: -0.5,
      color: 'text.button',
      '&:hover': {
        backgroundColor: 'info.main', // Background color on hover,
        color: 'text.dark'
      }
    }}
  >
    <BubbleChartIcon />
  </IconButton>
</Tooltip>
<Tooltip title="Elements">
  <IconButton
    color="inherit"
    onClick={() => navigate('elements')}
    sx={{
      WebkitAppRegion: 'no-drag',
      mx: -0.5,
      color: 'text.button',
      '&:hover': {
        backgroundColor: 'info.main', // Background color on hover,
        color: 'text.dark'
      }
    }}
  >
    <ElectricBoltIcon />
  </IconButton>
</Tooltip>
<Tooltip title="Recipes">
  <IconButton
    color="inherit"
    onClick={() => navigate('recipes')}
    sx={{
      WebkitAppRegion: 'no-drag',
      mx: -0.5,
      color: 'text.button',
      '&:hover': {
        backgroundColor: 'info.main', // Background color on hover,
        color: 'text.dark'
      }
    }}
  >
    <ScienceIcon />
  </IconButton>
</Tooltip>
<Tooltip title="Strings">
  <IconButton
    color="inherit"
    onClick={() => navigate('strings')}
    sx={{
      WebkitAppRegion: 'no-drag',
      mx: -0.5,
      color: 'text.button',
      '&:hover': {
        backgroundColor: 'info.main', // Background color on hover,
        color: 'text.dark'
      }
    }}
  >
    <TextFieldsIcon />
  </IconButton>
</Tooltip>
<Tooltip title="Lua Helpers">
  <IconButton
    color="inherit"
    onClick={() => navigate('helpers')}
    sx={{
      WebkitAppRegion: 'no-drag',
      mx: -0.5,
      color: 'text.button',
      '&:hover': {
        backgroundColor: 'info.main', // Background color on hover,
        color: 'text.dark'
      }
    }}
  >
    <IntegrationInstructionsIcon />
  </IconButton>
</Tooltip>
<Tooltip title="Settings">
  <IconButton
    color="inherit"
    onClick={() => navigate('settings')}
    sx={{
      WebkitAppRegion: 'no-drag',
      mx: -0.5,
      color: 'text.button',
      '&:hover': {
        backgroundColor: 'info.main', // Background color on hover,
        color: 'text.dark'
      }
    }}
  >
    <SettingsIcon />
  </IconButton>
</Tooltip>
<IconButton
  size="small"
  sx={{
    WebkitAppRegion: 'no-drag',
    ml: 2,
    mb: 3,
    color: 'text.button',
    '&:hover': {
      backgroundColor: 'info.main', // Background color on hover,
      color: 'text.dark'
    }
  }}
  onClick={handleMinimize}
>
  <MinimizeIcon />
</IconButton>
<IconButton
  size="small"
  sx={{ WebkitAppRegion: 'no-drag', mx: -1, mb: 3,
    color: 'text.button',
    '&:hover': {
      backgroundColor: 'info.main', // Background color on hover,
      color: 'text.dark'
    }}}
  onClick={handleMaximize}
>
  <MaximizeIcon />
</IconButton>
<IconButton
  size="small"
  sx={{ WebkitAppRegion: 'no-drag', mr: -3, mb: 3,
    color: 'text.button',
    '&:hover': {
      backgroundColor: 'info.main', // Background color on hover,
      color: 'warning.main'
    } }}
  onClick={handleClose}
>
  <CloseIcon />
</IconButton>
</Toolbar>
  );
};

export default MainToolbar;
