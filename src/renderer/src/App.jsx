import React, { useEffect, useRef, useState, useCallback } from 'react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { useRecoilState } from 'recoil'
import {
  themeState,
  librariesState,
  currentPageState,
  activeLibraryState,
  dirtyEditorState,
  clientPathState,
  taliesinPathState,
  brigidAssetsPathState,
  activePacksState,
  packCoverageState,
  iconPickerModeState,
  nationCrestPickerModeState,
  npcPortraitPickerModeState,
  soundPickerModeState,
  creaturePickerModeState
} from './recoil/atoms' // Import Recoil atoms
import { hybrasylTheme, chadulTheme, danaanTheme, grinnealTheme } from './themes'
import { useLibraryIndexHydration } from './hooks/useLibraryIndexHydration'

const themes = {
  hybrasyl: hybrasylTheme,
  chadul: chadulTheme,
  danaan: danaanTheme,
  grinneal: grinnealTheme
}
import MainLayout from './components/MainLayout'
import PageRenderer from './components/PageRenderer'
import UnsavedChangesDialog from './components/UnsavedChangesDialog'
import UpdateSnackbar from './components/UpdateSnackbar'
import ReferencePanel from './components/reference/ReferencePanel'
import { stopSound } from './data/soundData'

function App() {
  const hydrateLibraryIndex = useLibraryIndexHydration()
  const [theme, setTheme] = useRecoilState(themeState)
  const [libraries, setLibraries] = useRecoilState(librariesState)
  const [currentPage, setCurrentPage] = useRecoilState(currentPageState) // Manage current page with Recoil
  const [activeLibrary, setActiveLibrary] = useRecoilState(activeLibraryState)
  const [clientPath, setClientPath] = useRecoilState(clientPathState)
  const [taliesinPath, setTaliesinPath] = useRecoilState(taliesinPathState)
  const [brigidAssetsPath, setBrigidAssetsPath] = useRecoilState(brigidAssetsPathState)
  const [dirtyEditor, setDirtyEditor] = useRecoilState(dirtyEditorState)
  const [, setActivePacks] = useRecoilState(activePacksState)
  const [, setPackCoverage] = useRecoilState(packCoverageState)
  const [iconPickerMode, setIconPickerMode] = useRecoilState(iconPickerModeState)
  const [nationCrestPickerMode, setNationCrestPickerMode] = useRecoilState(
    nationCrestPickerModeState
  )
  const [npcPortraitPickerMode, setNpcPortraitPickerMode] = useRecoilState(
    npcPortraitPickerModeState
  )
  const [soundPickerMode, setSoundPickerMode] = useRecoilState(soundPickerModeState)
  const [creaturePickerMode, setCreaturePickerMode] = useRecoilState(creaturePickerModeState)
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
      setSettingsLoaded(true)
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
    setCreaturePickerMode
  ])

  // Refresh active asset packs whenever a .datf source path changes
  // (brigidAssetsPath or clientPath) — main reloads the .datf bundles on its
  // side; we sync the renderer's view of what's present. Also pre-fetches
  // per-subtype covered-id sets so the sprite canvases can do O(1) coverage
  // checks (self-deriving Vanilla vs Hybrasyl) without per-render IPC.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const packs = await window.electronAPI.listActivePacks()
        if (cancelled) return
        const packList = Array.isArray(packs) ? packs : []
        setActivePacks(packList)

        const subtypes = new Set()
        for (const p of packList) for (const s of p.coveredSubtypes || []) subtypes.add(s)
        const coverage = {}
        for (const s of subtypes) {
          const ids = await window.electronAPI.listPackCoveredIds(s)
          coverage[s] = Array.isArray(ids) ? ids : []
        }
        if (!cancelled) setPackCoverage(coverage)
      } catch {
        if (!cancelled) {
          setActivePacks([])
          setPackCoverage({})
        }
      }
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
      creaturePickerMode
    })
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
    creaturePickerMode
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
    </ThemeProvider>
  )
}

export default App
