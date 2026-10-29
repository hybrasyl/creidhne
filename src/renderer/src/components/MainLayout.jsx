import { AppBar, Box, Divider } from '@mui/material'
import AppTitleBar from './AppTitleBar'
import MainToolbar from './MainToolbar'
import IndexBuildProgress from './IndexBuildProgress'
import { useStoreValue, themeState } from '../store/appStore'

function MainLayout({ children, navigate, rightPanel }) {
  const theme = useStoreValue(themeState)
  return (
    <Box
      data-testid="app-root"
      // The active theme, for the e2e specs (theme-gallery.spec.js waits on it).
      data-theme={theme}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh'
      }}
    >
      <AppBar
        position="static"
        sx={{
          WebkitAppRegion: 'drag', // Makes the component draggable
          userSelect: 'none' // Forbids text selection
        }}
      >
        {/* The house title bar, then Creidhne's nav bar under it. */}
        <AppTitleBar />
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <MainToolbar navigate={navigate} />
      </AppBar>
      <Box
        sx={{
          flexGrow: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'row',
          minHeight: 0,
          position: 'relative'
        }}
      >
        <IndexBuildProgress />
        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            p: 3,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {children}
        </Box>
        {rightPanel}
      </Box>
    </Box>
  )
}

export default MainLayout
