import { BrowserWindow } from 'electron'
import { join } from 'path'

// A small branded window shown the instant the app boots, so the user sees
// something immediately while the main window's renderer bundle evaluates,
// React mounts, and loadSettings()/loadPacks() settle. Torn down by
// revealMainWindow() once the renderer signals it has hydrated ('app:ready').
export function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    resizable: false,
    movable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    // Solid background (no transparency) so it renders reliably across GPUs.
    backgroundColor: '#0c1524',
    webPreferences: { sandbox: true }
  })

  // Loaded from resources/ via the same '../../resources/...' convention the
  // main window's icon already uses (works in dev and packaged/asar builds).
  splash.loadFile(join(__dirname, '../../resources/splash.html'))
  splash.once('ready-to-show', () => splash.show())
  return splash
}
