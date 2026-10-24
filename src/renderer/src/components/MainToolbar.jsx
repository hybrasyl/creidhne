import { Toolbar, IconButton, Tooltip, Divider, Box } from '@mui/material'
import {
  GiRadialBalance,
  GiMagicSwirl,
  GiDervishSwords,
  GiPoisonBottle,
  GiFaceToFace,
  GiSpiderFace,
  GiBrainTentacle,
  GiSpellBook,
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
  GiConversation,
  GiDoubleDiaphragm,
  GiSettingsKnobs,
  GiAnvil,
  GiBugNet
} from 'react-icons/gi'
import {
  useStoreValue,
  useSetStoreValue,
  currentPageState,
  themeState,
  reportIssueOpenState
} from '../store/appStore'
import { useCompanionStatus } from '../hooks/useCompanionStatus'
import { chromeKind, navButtonSx } from './titleChrome'

// The nav bar: the second bar, under the title bar (AppTitleBar). It paints
// secondary.main, as the title bar does, so its icons take the bar's text colour,
// secondary.contrastText (HTOO-572). They drew text.button, which is a page
// colour: on the Danaan and Mundanes bars it was below 2:1.
//
// Each button takes the house nav-bar style, `navButtonSx` from titleChrome.js:
// the title bar's colours and hover, and the one house current-page mark (a
// light wash and a ring in the bar's text colour). chromeContrast.test.jsx
// renders this bar in each theme and measures its icons.
//
// The bar is opaque. It had `opacity: 0.9`, which mixed the AppBar's colour
// (light in Danaan and Mundanes) into the bar and its icons.

const dividerSx = { mx: 1, borderColor: 'rgba(255,255,255,0.2)' }

// Nav-bar glyphs: a soft translucent stroke and no drop-shadow, on every theme.
// Copied from taliesin's NavToolbar so the two apps' page icons look the same
// side by side (the Settings knobs are the shared reference glyph).
const navIconSx = {
  '& svg': {
    fontSize: '1.4em',
    stroke: 'rgba(0,0,0,0.25)',
    strokeWidth: 44
  }
}

const MainToolbar = ({ navigate }) => {
  // Resolved by main, not read from settings: the button must work before anyone
  // visits Settings, because Taliesin is usually found beside Creidhne without
  // being configured at all (HTOO-292).
  const { found: taliesinFound, refresh: refreshCompanion } = useCompanionStatus()
  const currentPage = useStoreValue(currentPageState)
  const themeName = useStoreValue(themeState)
  const setReportIssueOpen = useSetStoreValue(reportIssueOpenState)
  const kind = chromeKind(themeName)

  // `mx` and the glyph stroke are Creidhne's layout, not colour. The current
  // page drew secondary.dark, a dark shade on the bar in most themes (1.2:1 to
  // 1.5:1); the house mark replaces it.
  const btnSx = { ...navButtonSx(kind), mx: -0.5, ...navIconSx }
  const pageSx = (page) => ({ ...navButtonSx(kind, currentPage === page), mx: -0.5, ...navIconSx })

  const handleLaunchTaliesin = async () => {
    await window.electronAPI.launchCompanion()
    // A launch is the moment a target can turn out to have gone missing, so
    // re-resolve rather than leaving the button enabled on a stale answer.
    refreshCompanion()
  }

  return (
    <Toolbar
      data-testid="nav-bar"
      variant="dense"
      sx={{ bgcolor: 'secondary.main', minHeight: 40 }}
    >
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
      <Tooltip title="Spellbooks">
        <IconButton onClick={() => navigate('spellbooks')} sx={pageSx('spellbooks')}>
          <GiSpellBook />
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
        <IconButton onClick={() => navigate('damage-calculator')} sx={pageSx('damage-calculator')}>
          <GiCalculator />
        </IconButton>
      </Tooltip>
      <Tooltip title="Lua Helpers">
        <IconButton onClick={() => navigate('helpers')} sx={pageSx('helpers')}>
          <GiPull />
        </IconButton>
      </Tooltip>
      <Tooltip title="Dialog Builder">
        <IconButton onClick={() => navigate('dialogs')} sx={pageSx('dialogs')}>
          <GiConversation />
        </IconButton>
      </Tooltip>
      <Tooltip title="Reports">
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
      <Tooltip title={taliesinFound ? 'Launch Taliesin' : 'Taliesin not found — see Settings'}>
        <span>
          <IconButton onClick={handleLaunchTaliesin} disabled={!taliesinFound} sx={btnSx}>
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
  )
}

export default MainToolbar
