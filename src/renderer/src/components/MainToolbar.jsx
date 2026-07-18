import { Toolbar, IconButton, Tooltip, Divider, Box, Typography } from '@mui/material'

// Branded logo lives in resources/ (Vite publicDir) and is shared with the
// splash screen; referenced as a public asset (base is './') rather than a
// bundled import so we don't ship a second copy of the artwork.
const creidhneLogo = './creidhne-logo.png'
// Flat window-control glyphs for the "corporate" (plain-chrome) themes, swapped
// in for the stylized Gi skull/contract/expand on Mundanes & Dubhaimid.
import RemoveIcon from '@mui/icons-material/Remove'
import CropSquareIcon from '@mui/icons-material/CropSquare'
import CloseIcon from '@mui/icons-material/Close'
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
  GiAnvil,
  GiBugNet,
  GiContract,
  GiExpand,
  GiDeathSkull
} from 'react-icons/gi'
import {
  useStoreValue,
  useSetStoreValue,
  taliesinPathState,
  currentPageState,
  themeState,
  reportIssueOpenState
} from '../store/appStore'

// The "corporate" themes paint the same navy chrome but want plain, flat window
// controls: white glyphs with no dark keyline stroke, translucent-white hover,
// and a red close hover — rather than the stylized skull + cream-on-navy look.
const PLAIN_CHROME_THEMES = ['mundanes', 'dubhaimid']

// Shared shadow vocabulary for the gamified chrome (ported from oghma's TitleBar).
// KEYLINE is the crisp four-way #000 outline; DEPTH is the soft layer that lifts
// the glyph/wordmark off the navy bar. The plain/corporate themes drop both.
const KEYLINE = ['1px 1px 0 #000', '-1px -1px 0 #000', '1px -1px 0 #000', '-1px 1px 0 #000']
const DEPTH = '0 2px 3px rgba(0,0,0,0.55)'
// The wordmark is real text: text-shadow paints each layer independently, so the
// keyline + depth both read at full strength.
const TITLE_TEXT_SHADOW = [...KEYLINE, DEPTH].join(', ')

const dividerSx = { mx: 1, borderColor: 'rgba(255,255,255,0.2)' }

const MainToolbar = ({ navigate }) => {
  const taliesinPath = useStoreValue(taliesinPathState)
  const currentPage = useStoreValue(currentPageState)
  const themeName = useStoreValue(themeState)
  const setReportIssueOpen = useSetStoreValue(reportIssueOpenState)
  const isPlain = PLAIN_CHROME_THEMES.includes(themeName)

  // Gamified chrome (stylized themes): a crisp solid-black keyline stroke plus a
  // SINGLE depth drop-shadow to match the wordmark's lift. SVG glyphs can't take
  // text-shadow, so the outline comes from the stroke; chaining the four keyline
  // offsets as drop-shadows too would compound and wash out the depth (oghma's
  // lesson). On the plain navy chrome the stroke just greys the glyphs, so drop
  // both. strokeWidth is in the icon's own ~512 viewbox units (react-icons/gi).
  const iconSx = {
    '& svg': {
      fontSize: '1.4em',
      stroke: isPlain ? 'transparent' : '#000',
      strokeWidth: isPlain ? 0 : 11,
      filter: isPlain ? 'none' : `drop-shadow(${DEPTH})`
    }
  }
  const hoverSx = isPlain
    ? { backgroundColor: 'rgba(255,255,255,0.16)' }
    : { backgroundColor: 'info.main', color: 'text.dark' }
  // Chrome foreground: white on the navy corporate bar (text.button is dark/body
  // there), the theme's cream text.button on the stylized themes.
  const chromeColor = isPlain ? '#ffffff' : 'text.button'

  const btnSx = {
    WebkitAppRegion: 'no-drag',
    mx: -0.5,
    color: chromeColor,
    ...iconSx,
    '&:hover': hoverSx
  }

  // Highlight the IconButton for whichever page the user is currently viewing.
  // Mirrors taliesin's NavToolbar pattern. secondary.dark is bright on every
  // theme (the corporate palettes set it bright specifically for this).
  const activeBtnSx = {
    ...btnSx,
    color: 'secondary.dark',
    backgroundColor: 'rgba(255,255,255,0.08)'
  }

  const winBtnSx = {
    WebkitAppRegion: 'no-drag',
    color: chromeColor,
    ...iconSx,
    '&:hover': hoverSx
  }
  const closeBtnSx = {
    ...winBtnSx,
    '&:hover': isPlain
      ? { backgroundColor: 'error.main', color: '#ffffff' }
      : { backgroundColor: 'info.main', color: 'warning.main' }
  }

  const pageSx = (page) => (currentPage === page ? activeBtnSx : btnSx)

  const handleLaunchTaliesin = async () => {
    if (!taliesinPath) return
    await window.electronAPI.launchCompanion(taliesinPath)
  }

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
          sx={{
            fontWeight: 'bold',
            flexGrow: 0,
            textShadow: isPlain ? 'none' : TITLE_TEXT_SHADOW
          }}
          style={{ fontSize: '1.5rem' }}
        >
          Creidhne
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Minimize">
          <IconButton size="small" sx={winBtnSx} onClick={handleMinimize}>
            {isPlain ? <RemoveIcon /> : <GiContract />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Maximize">
          <IconButton size="small" sx={winBtnSx} onClick={handleMaximize}>
            {isPlain ? <CropSquareIcon /> : <GiExpand />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Close">
          <IconButton size="small" sx={closeBtnSx} onClick={handleClose}>
            {isPlain ? <CloseIcon /> : <GiDeathSkull />}
          </IconButton>
        </Tooltip>
      </Toolbar>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />

      {/* Nav Toolbar */}
      <Toolbar variant="dense" sx={{ bgcolor: 'secondary.main', minHeight: 40, opacity: 0.9 }}>
        {/* Left spacer — centers the editor + tools group */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Editor buttons */}
        <Tooltip title="Dashboard">
          <IconButton onClick={() => navigate('dashboard')} sx={pageSx('dashboard')}>
            <GiRadialBalance />
          </IconButton>
        </Tooltip>
        <Tooltip title="Castables">
          <IconButton onClick={() => navigate('castables')} sx={pageSx('castables')}>
            <GiMagicSwirl />
          </IconButton>
        </Tooltip>
        <Tooltip title="Items">
          <IconButton onClick={() => navigate('items')} sx={pageSx('items')}>
            <GiDervishSwords />
          </IconButton>
        </Tooltip>
        <Tooltip title="Statuses">
          <IconButton onClick={() => navigate('statuses')} sx={pageSx('statuses')}>
            <GiPoisonBottle />
          </IconButton>
        </Tooltip>
        <Tooltip title="NPCs">
          <IconButton onClick={() => navigate('npcs')} sx={pageSx('npcs')}>
            <GiFaceToFace />
          </IconButton>
        </Tooltip>
        <Tooltip title="Creatures">
          <IconButton onClick={() => navigate('creatures')} sx={pageSx('creatures')}>
            <GiSpiderFace />
          </IconButton>
        </Tooltip>
        <Tooltip title="Behavior Sets">
          <IconButton onClick={() => navigate('behaviors')} sx={pageSx('behaviors')}>
            <GiBrainTentacle />
          </IconButton>
        </Tooltip>
        <Tooltip title="Nations">
          <IconButton onClick={() => navigate('nations')} sx={pageSx('nations')}>
            <GiCastle />
          </IconButton>
        </Tooltip>
        <Tooltip title="Spawngroups">
          <IconButton onClick={() => navigate('spawngroups')} sx={pageSx('spawngroups')}>
            <GiHiveMind />
          </IconButton>
        </Tooltip>
        <Tooltip title="Loot Sets">
          <IconButton onClick={() => navigate('loot')} sx={pageSx('loot')}>
            <GiGoldStack />
          </IconButton>
        </Tooltip>
        <Tooltip title="Variants">
          <IconButton onClick={() => navigate('variants')} sx={pageSx('variants')}>
            <GiMirrorMirror />
          </IconButton>
        </Tooltip>
        <Tooltip title="Elements">
          <IconButton onClick={() => navigate('elements')} sx={pageSx('elements')}>
            <GiWindHole />
          </IconButton>
        </Tooltip>
        <Tooltip title="Recipes">
          <IconButton onClick={() => navigate('recipes')} sx={pageSx('recipes')}>
            <GiWok />
          </IconButton>
        </Tooltip>
        <Tooltip title="Strings">
          <IconButton onClick={() => navigate('strings')} sx={pageSx('strings')}>
            <GiTalk />
          </IconButton>
        </Tooltip>
        <Tooltip title="Server Config">
          <IconButton onClick={() => navigate('serverconfig')} sx={pageSx('serverconfig')}>
            <GiMagickTrick />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={dividerSx} />

        {/* Tools group — centered alongside the editors */}
        <Tooltip title="Formulas">
          <IconButton onClick={() => navigate('formulas')} sx={pageSx('formulas')}>
            <GiPotionBall />
          </IconButton>
        </Tooltip>
        <Tooltip title="Damage Calculator">
          <IconButton
            onClick={() => navigate('damage-calculator')}
            sx={pageSx('damage-calculator')}
          >
            <GiCalculator />
          </IconButton>
        </Tooltip>
        <Tooltip title="Lua Helpers">
          <IconButton onClick={() => navigate('helpers')} sx={pageSx('helpers')}>
            <GiPull />
          </IconButton>
        </Tooltip>
        <Tooltip title="Exports">
          <IconButton onClick={() => navigate('exports')} sx={pageSx('exports')}>
            <GiBootKick />
          </IconButton>
        </Tooltip>
        <Tooltip title="Constants">
          <IconButton onClick={() => navigate('constants')} sx={pageSx('constants')}>
            <GiDoubleDiaphragm />
          </IconButton>
        </Tooltip>

        {/* Right spacer — mirrors left spacer to keep editor+tools group centered */}
        <Box sx={{ flexGrow: 1 }} />

        <Divider orientation="vertical" flexItem sx={dividerSx} />

        {/* Right-aligned: settings, launch taliesin, about */}
        <Tooltip title="Settings">
          <IconButton onClick={() => navigate('settings')} sx={pageSx('settings')}>
            <GiSettingsKnobs />
          </IconButton>
        </Tooltip>
        <Tooltip title={taliesinPath ? 'Launch Taliesin' : 'Set Taliesin path in Settings'}>
          <span>
            <IconButton onClick={handleLaunchTaliesin} disabled={!taliesinPath} sx={btnSx}>
              <GiAnvil />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Report an issue">
          <IconButton onClick={() => setReportIssueOpen(true)} sx={btnSx}>
            <GiBugNet />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </>
  )
}

export default MainToolbar
