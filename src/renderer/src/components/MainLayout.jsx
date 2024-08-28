import React from 'react'
import { AppBar, Toolbar, IconButton, Typography, Box, Tooltip } from '@mui/material'
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
import Brightness4Icon from '@mui/icons-material/Brightness4'

function MainLayout({ children, onToggleTheme }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Creidhne: XML Forge
          </Typography>
          <Tooltip title="Settings">
            <IconButton color="inherit" href="/dashboard">
              <DashboardIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Castables">
            <IconButton color="inherit" href="/castables">
              <AutoAwesomeIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Formulas">
            <IconButton color="inherit" href="/formulas">
              <CalculateIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Items">
            <IconButton color="inherit" href="/items">
              <InventoryIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Statuses">
            <IconButton color="inherit" href="/statuses">
              <PsychologyIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="NPCs">
            <IconButton color="inherit" href="/npcs">
              <AccessibilityNewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Creatures">
            <IconButton color="inherit" href="/creatures">
              <PetsIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Behavior Sets">
            <IconButton color="inherit" href="/behaviors">
              <CelebrationIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Spawngroups">
            <IconButton color="inherit" href="/spawngroups">
              <GroupsIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Loot Sets">
            <IconButton color="inherit" href="/loot">
              <RedeemIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Variants">
            <IconButton color="inherit" href="/variants">
              <BubbleChartIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Elements">
            <IconButton color="inherit" href="/elements">
              <ElectricBoltIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Recipes">
            <IconButton color="inherit" href="/recipes">
              <ScienceIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Strings">
            <IconButton color="inherit" href="/strings">
              <TextFieldsIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Lua Helpers">
            <IconButton color="inherit" href="/helpers">
              <IntegrationInstructionsIcon />
            </IconButton>
          </Tooltip>
          <IconButton color="inherit" href="/npcs">
            <AccessibilityNewIcon />
          </IconButton>
          <IconButton color="inherit" href="/settings">
            <SettingsIcon />
          </IconButton>
          <IconButton color="inherit" onClick={onToggleTheme}>
            <Brightness4Icon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {children}
      </Box>
    </Box>
  )
}

export default MainLayout
