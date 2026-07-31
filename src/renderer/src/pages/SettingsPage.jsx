import { useEffect, useState } from 'react'
import { Box, Paper, Stack, Typography, Button, Link } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined'
import NewReleasesOutlinedIcon from '@mui/icons-material/NewReleasesOutlined'
import {
  useStoreState,
  useSetStoreValue,
  themeState,
  reportIssueOpenState
} from '../store/appStore'
import ManageLibraries from '../components/ManageLibraries'
import DAClientPathSection from '../components/DAClientPathSection'
import TaliesinPathSection from '../components/TaliesinPathSection'
import BrigidAssetsPathSection from '../components/BrigidAssetsPathSection'
import AboutDialog from '../components/AboutDialog'
import WhatsNewDialog from '../components/WhatsNewDialog'
import ThemePicker from '../components/ThemePicker'

// Right-sized WebP, hashed into the bundle by Vite (shared with the toolbar).
import creidhneLogo from '@renderer/assets/creidhne.webp'
// Soft depth shadow lifting the logo off the card (matches the title-bar DEPTH).
const DEPTH = '0 2px 3px rgba(0,0,0,0.55)'

// Full-height flex column so cards sharing a grid row match height (oghma pattern).
const cardSx = { p: 3, display: 'flex', flexDirection: 'column', height: '100%' }
const cardHeadingSx = { color: 'text.button', fontWeight: 'bold' }
const cardDescSx = { color: 'text.secondary', mb: 2 }

const SettingsPage = ({ libraries, onAddLibrary, onRemoveLibrary }) => {
  const [theme, setTheme] = useStoreState(themeState)
  const setReportIssueOpen = useSetStoreValue(reportIssueOpenState)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.electronAPI.getAppVersion().then(setVersion)
  }, [])

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ ...cardHeadingSx, mb: 3 }}>
        Settings
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(680px, 1fr))',
          gap: 3,
          alignItems: 'stretch'
        }}
      >
        {/* Appearance */}
        <Paper sx={cardSx}>
          <Typography variant="h6" gutterBottom sx={cardHeadingSx}>
            Appearance
          </Typography>
          <Typography variant="body2" sx={cardDescSx}>
            Pick a theme. The four stylized themes get gamified window chrome; Mundanes and
            Dubhaimid are flat/corporate.
          </Typography>
          <ThemePicker value={theme} onChange={setTheme} />
        </Paper>

        {/* Content Libraries — component provides its own heading + help tooltip */}
        <Paper sx={cardSx}>
          <ManageLibraries
            libraries={libraries}
            onAddLibrary={onAddLibrary}
            onRemoveLibrary={onRemoveLibrary}
          />
        </Paper>

        {/* Dark Ages Client */}
        <Paper sx={cardSx}>
          <DAClientPathSection />
        </Paper>

        {/* Brigid Assets */}
        <Paper sx={cardSx}>
          <BrigidAssetsPathSection />
        </Paper>

        {/* Companion App */}
        <Paper sx={cardSx}>
          <TaliesinPathSection />
        </Paper>

        {/* About */}
        <Paper sx={cardSx}>
          <Typography variant="h6" gutterBottom sx={cardHeadingSx}>
            About
          </Typography>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2 }}>
            <Box
              component="img"
              src={creidhneLogo}
              alt=""
              aria-hidden
              sx={{ height: 48, width: 48, filter: `drop-shadow(${DEPTH})` }}
            />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Creidhne
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Version {version || '…'} — a bespoke editor for Hybrasyl world data.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                <Link
                  href="https://www.hybrasyl.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="body2"
                >
                  hybrasyl.com
                </Link>
                <Link
                  href="https://github.com/hybrasyl"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="body2"
                >
                  GitHub
                </Link>
              </Box>
            </Box>
          </Stack>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<InfoOutlinedIcon />}
              onClick={() => setAboutOpen(true)}
            >
              About Creidhne…
            </Button>
            <Button
              variant="text"
              size="small"
              startIcon={<FolderOpenIcon />}
              onClick={() => window.electronAPI.revealSettings()}
            >
              Reveal settings folder
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<BugReportOutlinedIcon />}
              onClick={() => setReportIssueOpen(true)}
            >
              Report an issue…
            </Button>
            <Button
              variant="text"
              size="small"
              startIcon={<NewReleasesOutlinedIcon />}
              onClick={() => setWhatsNewOpen(true)}
            >
              What&apos;s new…
            </Button>
          </Box>
        </Paper>
      </Box>
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <WhatsNewDialog open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
    </Box>
  )
}

export default SettingsPage
