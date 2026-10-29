import { Fragment, useState } from 'react'
import {
  Toolbar,
  IconButton,
  Tooltip,
  Divider,
  Box,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { GiAnvil, GiBugNet } from 'react-icons/gi'
import {
  useStoreValue,
  useSetStoreValue,
  currentPageState,
  themeState,
  reportIssueOpenState
} from '../store/appStore'
import { useCompanionStatus } from '../hooks/useCompanionStatus'
import { chromeKind, navButtonSx } from './titleChrome'
import { BAR_PAGES, MENU_GROUPS, MENU_PAGES, NAV_ICONS } from './navPages'

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
//
// The pages come from navPages.js: the XML pages are buttons, and the tools and
// Settings are one More button with a menu, so the bar fits a 1024px window.
// The More button takes the current-page mark when the open page is in its menu.

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
  const [menuAnchor, setMenuAnchor] = useState(null)

  // `mx` and the glyph stroke are Creidhne's layout, not colour. The current
  // page drew secondary.dark, a dark shade on the bar in most themes (1.2:1 to
  // 1.5:1); the house mark replaces it.
  const btnSx = { ...navButtonSx(kind), mx: -0.5, ...navIconSx }
  const pageSx = (current) => ({ ...navButtonSx(kind, current), mx: -0.5, ...navIconSx })
  const inMenu = MENU_PAGES.some((p) => p.page === currentPage)

  const handleLaunchTaliesin = async () => {
    await window.electronAPI.launchCompanion()
    // A launch is the moment a target can turn out to have gone missing, so
    // re-resolve rather than leaving the button enabled on a stale answer.
    refreshCompanion()
  }

  const openFromMenu = (page) => {
    setMenuAnchor(null)
    navigate(page)
  }

  return (
    <Toolbar
      data-testid="nav-bar"
      variant="dense"
      sx={{ bgcolor: 'secondary.main', minHeight: 40 }}
    >
      {/* Left spacer — centers the editors and the More button */}
      <Box sx={{ flexGrow: 1 }} />

      {BAR_PAGES.map(({ page, label }) => {
        const Icon = NAV_ICONS[page]
        return (
          <Tooltip key={page} title={label}>
            <IconButton onClick={() => navigate(page)} sx={pageSx(currentPage === page)}>
              <Icon />
            </IconButton>
          </Tooltip>
        )
      })}

      <Divider orientation="vertical" flexItem sx={dividerSx} />

      <Tooltip title="More pages">
        <IconButton
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={pageSx(inMenu)}
          aria-haspopup="menu"
          aria-expanded={menuAnchor ? 'true' : undefined}
        >
          <MoreHorizIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        {MENU_GROUPS.map((group, i) => (
          <Fragment key={i}>
            {i > 0 && <Divider />}
            {group.map(({ page, label }) => {
              const Icon = NAV_ICONS[page]
              return (
                <MenuItem
                  key={page}
                  selected={currentPage === page}
                  onClick={() => openFromMenu(page)}
                >
                  <ListItemIcon>
                    <Icon size="1.3em" />
                  </ListItemIcon>
                  <ListItemText>{label}</ListItemText>
                </MenuItem>
              )
            })}
          </Fragment>
        ))}
      </Menu>

      {/* Right spacer — mirrors left spacer to keep the group centered */}
      <Box sx={{ flexGrow: 1 }} />

      <Divider orientation="vertical" flexItem sx={dividerSx} />

      {/* Right-aligned: launch taliesin, report an issue */}
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
