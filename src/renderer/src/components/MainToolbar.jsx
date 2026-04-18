import React from 'react'
import creidhneLogo from '../assets/creidhne.svg'
import { Toolbar, IconButton, Tooltip, Divider, Box, Typography } from '@mui/material'
import {
  GiRadialBalance,
  GiMagicSwirl,
  GiDervishSwords,
  GiPoisonBottle,
  GiFaceToFace,
  GiSpiderFace,
  GiBrainTentacle,
  GiCastle,
  GiHiveMind,
  GiGoldStack,
  GiMirrorMirror,
  GiWindHole,
  GiWok,
  GiTalk,
  GiMagickTrick,
  GiPotionBall,
  GiCalculator,
  GiPull,
  GiBootKick,
  GiDoubleDiaphragm,
  GiSettingsKnobs,
  GiContract,
  GiExpand,
  GiDeathSkull
} from 'react-icons/gi'

const iconSx = {
  '& svg': {
    fontSize: '1.4em',
    stroke: 'rgba(0, 0, 0, 0.25)',
    strokeWidth: 44
  }
}

const btnSx = {
  WebkitAppRegion: 'no-drag',
  mx: -0.5,
  color: 'text.button',
  ...iconSx,
  '&:hover': {
    backgroundColor: 'info.main',
    color: 'text.dark'
  }
}

const dividerSx = { mx: 1, borderColor: 'rgba(255,255,255,0.2)' }

const winBtnSx = {
  WebkitAppRegion: 'no-drag',
  color: 'text.button',
  ...iconSx,
  '&:hover': {
    backgroundColor: 'info.main',
    color: 'text.dark'
  }
}

const MainToolbar = ({ navigate }) => {
  const handleMinimize = () => {
    window.electronAPI.minimizeWindow()
  }

  const handleMaximize = () => {
    window.electronAPI.maximizeWindow()
  }

  const handleClose = () => {
    window.electronAPI.closeWindow()
  }

  return (
    <>
      {/* Title Bar */}
      <Toolbar variant="dense" sx={{ bgcolor: 'secondary.main', minHeight: 36, px: 1.5 }}>
        <img src={creidhneLogo} alt="Creidhne" style={{ height: 36, marginRight: 8 }} />
        <Typography
          variant="h6"
          sx={{ fontWeight: 'bold', flexGrow: 0 }}
          style={{ fontSize: '1.5rem' }}
        >
          Creidhne: XML Forge
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Minimize">
          <IconButton size="small" sx={winBtnSx} onClick={handleMinimize}>
            <GiContract />
          </IconButton>
        </Tooltip>
        <Tooltip title="Maximize">
          <IconButton size="small" sx={winBtnSx} onClick={handleMaximize}>
            <GiExpand />
          </IconButton>
        </Tooltip>
        <Tooltip title="Close">
          <IconButton
            size="small"
            sx={{ ...winBtnSx, '&:hover': { backgroundColor: 'info.main', color: 'warning.main' } }}
            onClick={handleClose}
          >
            <GiDeathSkull />
          </IconButton>
        </Tooltip>
      </Toolbar>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />

      {/* Nav Toolbar */}
      <Toolbar variant="dense" sx={{ bgcolor: 'secondary.main', minHeight: 40, opacity: 0.85 }}>
        {/* Left spacer — centers the editor group */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Editor buttons */}
        <Tooltip title="Dashboard">
          <IconButton onClick={() => navigate('dashboard')} sx={btnSx}>
            <GiRadialBalance />
          </IconButton>
        </Tooltip>
        <Tooltip title="Castables">
          <IconButton onClick={() => navigate('castables')} sx={btnSx}>
            <GiMagicSwirl />
          </IconButton>
        </Tooltip>
        <Tooltip title="Items">
          <IconButton onClick={() => navigate('items')} sx={btnSx}>
            <GiDervishSwords />
          </IconButton>
        </Tooltip>
        <Tooltip title="Statuses">
          <IconButton onClick={() => navigate('statuses')} sx={btnSx}>
            <GiPoisonBottle />
          </IconButton>
        </Tooltip>
        <Tooltip title="NPCs">
          <IconButton onClick={() => navigate('npcs')} sx={btnSx}>
            <GiFaceToFace />
          </IconButton>
        </Tooltip>
        <Tooltip title="Creatures">
          <IconButton onClick={() => navigate('creatures')} sx={btnSx}>
            <GiSpiderFace />
          </IconButton>
        </Tooltip>
        <Tooltip title="Behavior Sets">
          <IconButton onClick={() => navigate('behaviors')} sx={btnSx}>
            <GiBrainTentacle />
          </IconButton>
        </Tooltip>
        <Tooltip title="Nations">
          <IconButton onClick={() => navigate('nations')} sx={btnSx}>
            <GiCastle />
          </IconButton>
        </Tooltip>
        <Tooltip title="Spawngroups">
          <IconButton onClick={() => navigate('spawngroups')} sx={btnSx}>
            <GiHiveMind />
          </IconButton>
        </Tooltip>
        <Tooltip title="Loot Sets">
          <IconButton onClick={() => navigate('loot')} sx={btnSx}>
            <GiGoldStack />
          </IconButton>
        </Tooltip>
        <Tooltip title="Variants">
          <IconButton onClick={() => navigate('variants')} sx={btnSx}>
            <GiMirrorMirror />
          </IconButton>
        </Tooltip>
        <Tooltip title="Elements">
          <IconButton onClick={() => navigate('elements')} sx={btnSx}>
            <GiWindHole />
          </IconButton>
        </Tooltip>
        <Tooltip title="Recipes">
          <IconButton onClick={() => navigate('recipes')} sx={btnSx}>
            <GiWok />
          </IconButton>
        </Tooltip>
        <Tooltip title="Strings">
          <IconButton onClick={() => navigate('strings')} sx={btnSx}>
            <GiTalk />
          </IconButton>
        </Tooltip>
        <Tooltip title="Server Config">
          <IconButton onClick={() => navigate('serverconfig')} sx={btnSx}>
            <GiMagickTrick />
          </IconButton>
        </Tooltip>

        {/* Right spacer — mirrors left spacer to keep editors centered */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Right-aligned tools */}
        <Divider orientation="vertical" flexItem sx={dividerSx} />
        <Tooltip title="Formulas">
          <IconButton onClick={() => navigate('formulas')} sx={btnSx}>
            <GiPotionBall />
          </IconButton>
        </Tooltip>
        <Tooltip title="Damage Calculator">
          <IconButton onClick={() => navigate('damage-calculator')} sx={btnSx}>
            <GiCalculator />
          </IconButton>
        </Tooltip>
        <Tooltip title="Lua Helpers">
          <IconButton onClick={() => navigate('helpers')} sx={btnSx}>
            <GiPull />
          </IconButton>
        </Tooltip>
        <Tooltip title="Exports">
          <IconButton onClick={() => navigate('exports')} sx={btnSx}>
            <GiBootKick />
          </IconButton>
        </Tooltip>
        <Tooltip title="Constants">
          <IconButton onClick={() => navigate('constants')} sx={btnSx}>
            <GiDoubleDiaphragm />
          </IconButton>
        </Tooltip>
        <Tooltip title="Settings">
          <IconButton onClick={() => navigate('settings')} sx={btnSx}>
            <GiSettingsKnobs />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </>
  )
}

export default MainToolbar
