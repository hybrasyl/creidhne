import { useEffect, useRef, useState, useCallback } from 'react'
import { ThemeProvider, CssBaseline, GlobalStyles } from '@mui/material'
import { alpha } from '@mui/material/styles'
import {
  useStoreState,
  useSetStoreValue,
  themeState,
  librariesState,
  currentPageState,
  activeLibraryState,
  dirtyEditorState,
  clientPathState,
  taliesinPathState,
  settingsSavedNonceState,
  brigidAssetsPathState,
  activePacksState,
  packCoverageState,
  iconPickerModeState,
  nationCrestPickerModeState,
  fileListViewModeState,
  npcPortraitPickerModeState,
  soundPickerModeState,
  creaturePickerModeState,
  reportIssueOpenState
} from './store/appStore'
import {
  hybrasylTheme,
  chadulTheme,
  danaanTheme,
  grinnealTheme,
  mundanesTheme,
  dubhaimidTheme
} from './themes'
import { useLibraryIndexHydration } from './hooks/useLibraryIndexHydration'
import { loadPackState } from './hooks/usePackRescan'

const themes = {
  hybrasyl: hybrasylTheme,
  chadul: chadulTheme,
  danaan: danaanTheme,
  grinneal: grinnealTheme,
  mundanes: mundanesTheme,
  dubhaimid: dubhaimidTheme
}
import MainLayout from './components/MainLayout'
import PageRenderer from './components/PageRenderer'
import UnsavedChangesDialog from './components/UnsavedChangesDialog'
import UpdateSnackbar from './components/UpdateSnackbar'
import ReportIssueDialog from './components/ReportIssueDialog'
import ReferencePanel from './components/reference/ReferencePanel'
import { stopSound } from './data/soundData'

// Theme-aware custom scrollbar, injected globally so it recolors with the
// active theme instead of the old hardcoded hybrasyl teal. The thumb uses the
// theme accent (secondary, falling back to primary); the track derives from
// text.primary so it reads as a faint gutter on both light and dark themes.
const scrollbarGlobalStyles = (theme) => {
  const accent = theme.palette.secondary?.main || theme.palette.primary.main
  return {
    '::-webkit-scrollbar': { width: 16, height: 12 },
    '::-webkit-scrollbar-track': {
      background: alpha(theme.palette.text.primary, 0.06),
      borderLeft: '8px solid transparent',
      backgroundClip: 'padding-box'
    },
    '::-webkit-scrollbar-thumb': {
      backgroundColor: alpha(accent, 0.5),
      borderRadius: 6,
      borderLeft: '8px solid transparent',
      backgroundClip: 'padding-box'
    },
    '::-webkit-scrollbar-thumb:hover': { backgroundColor: alpha(accent, 0.8) },
    '::-webkit-scrollbar-corner': { background: 'transparent' }
  }
}

function App() {
  const hydrateLibraryIndex = useLibraryIndexHydration()
  const [theme, setTheme] = useStoreState(themeState)
  const [libraries, setLibraries] = useStoreState(librariesState)
  const [currentPage, setCurrentPage] = useStoreState(currentPageState)
  const [activeLibrary, setActiveLibrary] = useStoreState(activeLibraryState)
  const [clientPath, setClientPath] = useStoreState(clientPathState)
  const [taliesinPath, setTaliesinPath] = useStoreState(taliesinPathState)
  const setSettingsSavedNonce = useSetStoreValue(settingsSavedNonceState)
  const [brigidAssetsPath, setBrigidAssetsPath] = useStoreState(brigidAssetsPathState)
  const [dirtyEditor, setDirtyEditor] = useStoreState(dirtyEditorState)
  const [, setActivePacks] = useStoreState(activePacksState)
  const [, setPackCoverage] = useStoreState(packCoverageState)
  const [iconPickerMode, setIconPickerMode] = useStoreState(iconPickerModeState)
  const [nationCrestPickerMode, setNationCrestPickerMode] = useStoreState(
    nationCrestPickerModeState
  )
  const [npcPortraitPickerMode, setNpcPortraitPickerMode] = useStoreState(
    npcPortraitPickerModeState
  )
  const [soundPickerMode, setSoundPickerMode] = useStoreState(soundPickerModeState)
  const [creaturePickerMode, setCreaturePickerMode] = useStoreState(creaturePickerModeState)
  const [fileListViewMode, setFileListViewMode] = useStoreState(fileListViewModeState)
  const [reportIssueOpen, setReportIssueOpen] = useStoreState(reportIssueOpenState)
  const [pendingNav, setPendingNav] = useState(null)
  const [navDialogOpen, setNavDialogOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const dirtyEditorRef = useRef(dirtyEditor)

  const [settingsLoaded, setSettingsLoaded] = useState(false)

  // Load settings on mount. Gates the save effect below — we don't want the
  // save effect to fire with default atom values (clientPath=null, libraries=[])
  // before fetchSettings has populated real state, because that clobbers the
  // settings file and, post-pack-loader, triggers a main-side pack wipe.
  useEffect(() => {
    async function fetchSettings() {
      const settings = await window.electronAPI.loadSettings() // Use IPC call to load settings
      setTheme(themes[settings.theme] ? settings.theme : 'hybrasyl')
      setLibraries(settings.libraries || [])
      setActiveLibrary(settings.activeLibrary || null)
      setClientPath(settings.clientPath || null)
      setTaliesinPath(settings.taliesinPath || null)
      setBrigidAssetsPath(settings.brigidAssetsPath || null)
      setIconPickerMode(settings.iconPickerMode || 'vanilla')
      setNationCrestPickerMode(settings.nationCrestPickerMode || 'vanilla')
      setNpcPortraitPickerMode(settings.npcPortraitPickerMode || 'vanilla')
      setSoundPickerMode(settings.soundPickerMode || 'vanilla')
      setCreaturePickerMode(settings.creaturePickerMode || 'vanilla')
      setFileListViewMode(settings.fileListViewMode || 'flat')
      setSettingsLoaded(true)
      // Tell main the first frame is populated so it can reveal the window and
      // dismiss the splash (no-op if the API predates this build).
      window.electronAPI.appReady?.()
    }

    fetchSettings()
  }, [
    setTheme,
    setLibraries,
    setActiveLibrary,
    setClientPath,
    setTaliesinPath,
    setBrigidAssetsPath,
    setIconPickerMode,
    setNationCrestPickerMode,
    setNpcPortraitPickerMode,
    setSoundPickerMode,
    setCreaturePickerMode,
    setFileListViewMode
  ])

  // Refresh active asset packs whenever a .datf source path changes
  // (brigidAssetsPath or clientPath) — main reloads the .datf bundles on its
  // side; we sync the renderer's view of what's present. Also pre-fetches
  // per-subtype covered-id sets so the sprite canvases can do O(1) coverage
  // checks (self-deriving Vanilla vs Hybrasyl) without per-render IPC.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { packs, coverage } = await loadPackState()
      if (cancelled) return
      setActivePacks(packs)
      setPackCoverage(coverage)
    })()
    return () => {
      cancelled = true
    }
  }, [clientPath, brigidAssetsPath, setActivePacks, setPackCoverage])

  // Load persisted index from disk whenever active library changes. The index
  // is a rebuildable cache that now lives outside the (git) world folder, so a
  // fresh clone — or a world edited externally — may have no cache or a stale
  // one. Auto-build in that case (progress shows via the build pill), then
  // hydrate. buildIndex is incremental, so an up-to-date cache makes this cheap.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (activeLibrary) {
        try {
          const status = await window.electronAPI.getIndexStatus(activeLibrary)
          if (!status?.exists || status?.stale) {
            await window.electronAPI.buildIndex(activeLibrary)
          }
        } catch {
          // Status/build failure shouldn't block hydration of whatever exists.
        }
      }
      if (!cancelled) await hydrateLibraryIndex(activeLibrary)
    })()
    return () => {
      cancelled = true
    }
  }, [activeLibrary, hydrateLibraryIndex])

  // Save settings whenever theme or libraries change. Skip until fetchSettings
  // has populated state, otherwise we'd overwrite the on-disk settings with
  // the default atom values on every mount.
  useEffect(() => {
    if (!settingsLoaded) return
    // Awaited, then acknowledged. Main answers questions like companionStatus
    // from the settings on DISK, and this effect is the only thing that puts
    // them there -- so anything asking main about a setting has to wait for the
    // write, not for the state change. Child effects run before this one, which
    // is exactly how a freshly-picked Taliesin path got read back as the old one.
    void Promise.resolve(
      window.electronAPI.saveSettings({
        libraries,
        activeLibrary,
        theme,
        clientPath,
        taliesinPath,
        brigidAssetsPath,
        iconPickerMode,
        nationCrestPickerMode,
        npcPortraitPickerMode,
        soundPickerMode,
        creaturePickerMode,
        fileListViewMode
      })
    )
      .catch((err) => console.error('[settings] save failed:', err))
      .finally(() => setSettingsSavedNonce((n) => n + 1))
  }, [
    settingsLoaded,
    theme,
    libraries,
    activeLibrary,
    clientPath,
    taliesinPath,
    brigidAssetsPath,
    iconPickerMode,
    nationCrestPickerMode,
    npcPortraitPickerMode,
    soundPickerMode,
    creaturePickerMode,
    fileListViewMode,
    // Stable across renders (a zustand setter), so listing it costs nothing and
    // keeps the rule honest rather than disabled.
    setSettingsSavedNonce
  ])

  // Stop any sound preview on page navigation — keeps playback from bleeding
  // across editors.
  useEffect(() => {
    stopSound()
  }, [currentPage])

  const handleNavigate = useCallback(
    (page) => {
      if (dirtyEditor) {
        setPendingNav(page)
        setNavDialogOpen(true)
      } else {
        setCurrentPage(page)
      }
    },
    [dirtyEditor, setCurrentPage]
  )

  const handleNavSave = useCallback(async () => {
    const page = pendingNav
    setNavDialogOpen(false)
    setPendingNav(null)
    try {
      await dirtyEditor?.onSave()
      // markClean is called inside the editor's save handler; navigate after
      setCurrentPage(page)
    } catch {
      // save failed — stay on current page
    }
  }, [pendingNav, dirtyEditor, setCurrentPage])

  const handleNavDiscard = useCallback(() => {
    const page = pendingNav
    setNavDialogOpen(false)
    setPendingNav(null)
    setDirtyEditor(null)
    setCurrentPage(page)
  }, [pendingNav, setCurrentPage, setDirtyEditor])

  const handleNavCancel = useCallback(() => {
    setNavDialogOpen(false)
    setPendingNav(null)
  }, [])

  // Keep ref in sync so the close listener always sees current dirty state
  useEffect(() => {
    dirtyEditorRef.current = dirtyEditor
  }, [dirtyEditor])

  // Register the close listener once — reads state via ref to avoid stacking
  useEffect(() => {
    window.electronAPI.onCheckClose(() => {
      if (dirtyEditorRef.current) {
        setCloseDialogOpen(true)
      } else {
        window.electronAPI.confirmClose()
      }
    })
  }, [])

  const handleCloseSave = useCallback(async () => {
    setCloseDialogOpen(false)
    try {
      await dirtyEditor?.onSave()
    } catch {
      /* save failed — still close */
    }
    window.electronAPI.confirmClose()
  }, [dirtyEditor])

  const handleCloseDiscard = useCallback(() => {
    setCloseDialogOpen(false)
    window.electronAPI.confirmClose()
  }, [])

  const handleCloseCancel = useCallback(() => {
    setCloseDialogOpen(false)
  }, [])

  const handleAddLibrary = async () => {
    const directoryPath = await window.electronAPI.openDirectory() // Use IPC call to open directory
    if (directoryPath && !libraries.includes(directoryPath)) {
      setLibraries((prevLibraries) => [...prevLibraries, directoryPath])
    }
  }

  const handleRemoveLibrary = (library) => {
    setLibraries((prevLibraries) => prevLibraries.filter((lib) => lib !== library))
  }

  return (
    <ThemeProvider theme={themes[theme] ?? hybrasylTheme}>
      <CssBaseline />
      <GlobalStyles styles={scrollbarGlobalStyles} />
      <MainLayout navigate={handleNavigate} rightPanel={<ReferencePanel />}>
        <PageRenderer
          libraries={libraries}
          onAddLibrary={handleAddLibrary}
          onRemoveLibrary={handleRemoveLibrary}
        />
      </MainLayout>
      <UnsavedChangesDialog
        open={navDialogOpen}
        label={dirtyEditor?.label}
        onSave={handleNavSave}
        onDiscard={handleNavDiscard}
        onCancel={handleNavCancel}
      />
      <UnsavedChangesDialog
        open={closeDialogOpen}
        label={dirtyEditor?.label}
        onSave={handleCloseSave}
        onDiscard={handleCloseDiscard}
        onCancel={handleCloseCancel}
      />
      <UpdateSnackbar />
      <ReportIssueDialog open={reportIssueOpen} onClose={() => setReportIssueOpen(false)} />
    </ThemeProvider>
  )
}

export default App
