import { useState } from 'react'
import { Box, Paper, Typography, Button, Alert, Link, CircularProgress } from '@mui/material'
import { useStoreState, themeState } from '../store/appStore'
import ManageLibraries from '../components/ManageLibraries'
import DAClientPathSection from '../components/DAClientPathSection'
import TaliesinPathSection from '../components/TaliesinPathSection'
import BrigidAssetsPathSection from '../components/BrigidAssetsPathSection'
import AboutDialog from '../components/AboutDialog'
import ThemePicker from '../components/ThemePicker'

// Full-height flex column so cards sharing a grid row match height (oghma pattern).
const cardSx = { p: 3, display: 'flex', flexDirection: 'column', height: '100%' }
const cardHeadingSx = { color: 'text.button', fontWeight: 'bold' }
const cardDescSx = { color: 'text.secondary', mb: 2 }

const SettingsPage = ({ libraries, onAddLibrary, onRemoveLibrary }) => {
  const [theme, setTheme] = useStoreState(themeState)
  const [updateChecking, setUpdateChecking] = useState(false)
  const [updateResult, setUpdateResult] = useState(null)
  const [aboutOpen, setAboutOpen] = useState(false)

  const handleCheckForUpdates = async () => {
    setUpdateChecking(true)
    setUpdateResult(null)
    try {
      const result = await window.electronAPI.checkForUpdates()
      setUpdateResult(result)
    } catch (err) {
      setUpdateResult({ ok: false, error: err?.message || String(err) })
    } finally {
      setUpdateChecking(false)
    }
  }

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

        {/* About & Updates */}
        <Paper sx={cardSx}>
          <Typography variant="h6" gutterBottom sx={cardHeadingSx}>
            About & Updates
          </Typography>
          <Typography variant="body2" sx={cardDescSx}>
            Version info and project links, and check GitHub for a newer release.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="outlined" size="small" onClick={() => setAboutOpen(true)}>
              About Creidhne
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={handleCheckForUpdates}
              disabled={updateChecking}
              startIcon={updateChecking ? <CircularProgress size={14} /> : null}
            >
              {updateChecking ? 'Checking…' : 'Check for updates'}
            </Button>
          </Box>
          {updateResult && (
            <Box sx={{ mt: 2 }}>
              {!updateResult.ok && (
                <Alert severity="warning" onClose={() => setUpdateResult(null)}>
                  Update check failed: {updateResult.error}
                </Alert>
              )}
              {updateResult.ok && updateResult.updateAvailable && (
                <Alert severity="info" onClose={() => setUpdateResult(null)}>
                  Creidhne {updateResult.latestVersion} is available (you have{' '}
                  {updateResult.currentVersion}).{' '}
                  <Link href={updateResult.releaseUrl} target="_blank" rel="noopener noreferrer">
                    View release
                  </Link>
                </Alert>
              )}
              {updateResult.ok && !updateResult.updateAvailable && (
                <Alert severity="success" onClose={() => setUpdateResult(null)}>
                  {updateResult.reason === 'no-releases'
                    ? 'No published releases yet.'
                    : `You're on the latest version (${updateResult.currentVersion}).`}
                </Alert>
              )}
            </Box>
          )}
        </Paper>
      </Box>
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </Box>
  )
}

export default SettingsPage
