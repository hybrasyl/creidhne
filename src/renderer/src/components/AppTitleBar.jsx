import { appIdentity } from '@shared/appIdentity.js'
import { useStoreValue, themeState } from '../store/appStore'
import TitleBar from './TitleBar'
// Right-sized WebP imported so Vite hashes it into the renderer bundle. The
// splash screen uses its own resources/creidhne-splash.webp; the 1024px master
// lives in build/ (regen only, never packaged).
import creidhneLogo from '@renderer/assets/creidhne.webp'

/**
 * Creidhne's title bar: the house `TitleBar` (title-bar v1, HTOO-572), wired to
 * the theme in the store, the Creidhne icon and the window calls of the preload
 * bridge. The house module stays as the template has it. Change this file, not
 * `TitleBar.jsx` or `titleChrome.js`.
 *
 * The page navigation is not on this bar. It is the second bar under it
 * (`MainToolbar.jsx`).
 */
function AppTitleBar() {
  const theme = useStoreValue(themeState)
  return (
    <TitleBar
      name={appIdentity.productName}
      icon={creidhneLogo}
      theme={theme}
      platform={window.electronAPI?.platform}
      controls={{
        minimize: () => window.electronAPI.minimizeWindow(),
        maximize: () => window.electronAPI.maximizeWindow(),
        close: () => window.electronAPI.closeWindow()
      }}
    />
  )
}

export default AppTitleBar
