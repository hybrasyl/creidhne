import React, { useEffect, useRef, useState, useCallback } from 'react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { useRecoilState } from 'recoil'
import {
  themeState,
  librariesState,
  currentPageState,
  activeLibraryState,
  libraryIndexState,
  dirtyEditorState,
  recentPagesState,
  clientPathState,
  taliesinPathState,
  activePacksState,
  packCoverageState,
  iconPickerModeState,
  nationCrestPickerModeState
} from './recoil/atoms' // Import Recoil atoms
import { hybrasylTheme, chadulTheme, danaanTheme, grinnealTheme } from './themes'

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
  const [theme, setTheme] = useRecoilState(themeState)
  const [libraries, setLibraries] = useRecoilState(librariesState)
  const [currentPage, setCurrentPage] = useRecoilState(currentPageState) // Manage current page with Recoil
  const [, setRecentPages] = useRecoilState(recentPagesState)
  const [activeLibrary, setActiveLibrary] = useRecoilState(activeLibraryState)
  const [clientPath, setClientPath] = useRecoilState(clientPathState)
  const [taliesinPath, setTaliesinPath] = useRecoilState(taliesinPathState)
  const [, setLibraryIndex] = useRecoilState(libraryIndexState)
  const [dirtyEditor, setDirtyEditor] = useRecoilState(dirtyEditorState)
  const [, setActivePacks] = useRecoilState(activePacksState)
  const [, setPackCoverage] = useRecoilState(packCoverageState)
  const [iconPickerMode, setIconPickerMode] = useRecoilState(iconPickerModeState)
  const [nationCrestPickerMode, setNationCrestPickerMode] = useRecoilState(
    nationCrestPickerModeState
  )
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
      setIconPickerMode(settings.iconPickerMode || 'vanilla')
      setNationCrestPickerMode(settings.nationCrestPickerMode || 'vanilla')
      setSettingsLoaded(true)
    }

    fetchSettings()
  }, [
    setTheme,
    setLibraries,
    setActiveLibrary,
    setClientPath,
    setTaliesinPath,
    setIconPickerMode,
    setNationCrestPickerMode
  ])

  // Refresh active asset packs whenever clientPath changes — main reloads the
  // .datf bundles on its side; we sync the renderer's view of what's present.
  // Also pre-fetches per-subtype covered-id sets so DualIconView can do O(1)
  // membership checks without per-render IPC.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const packs = await window.electronAPI.listActivePacks()
        if (cancelled) return
        const packList = Array.isArray(packs) ? packs : []
        setActivePacks(packList)

        const subtypes = new Set()
        for (const p of packList)
          for (const s of p.coveredSubtypes || []) subtypes.add(s)
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
  }, [clientPath, setActivePacks, setPackCoverage])

  // Load persisted index from disk whenever active library changes
  useEffect(() => {
    if (!activeLibrary) {
      setLibraryIndex({})
      return
    }
    Promise.all([
      window.electronAPI.loadIndex(activeLibrary),
      window.electronAPI.loadUserConstants(activeLibrary)
    ]).then(([index, constants]) => {
      const dedup = (a, b) => [...new Set([...(a || []), ...(b || [])])].sort()
      setLibraryIndex({
        ...(index || {}),
        vendorTabs: dedup(index?.vendorTabs, constants?.vendorTabs),
        npcJobs: dedup(index?.npcJobs, constants?.npcJobs),
        itemCategories: dedup(index?.itemCategories, constants?.itemCategories),
        castableCategories: dedup(index?.castableCategories, constants?.castableCategories),
        statusCategories: dedup(index?.statusCategories, constants?.statusCategories),
        cookieNames: dedup(
          index?.cookieNames,
          (constants?.cookies || []).map((c) => c.name)
        ),
        motions: constants?.motions || []
      })
    })
  }, [activeLibrary, setLibraryIndex])

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
      iconPickerMode,
      nationCrestPickerMode
    })
  }, [
    settingsLoaded,
    theme,
    libraries,
    activeLibrary,
    clientPath,
    taliesinPath,
    iconPickerMode,
    nationCrestPickerMode
  ])

  // Stop any sound preview on page navigation — keeps playback from bleeding
  // across editors.
  useEffect(() => {
    stopSound()
  }, [currentPage])

  const pushRecentPage = useCallback(
    (page) => {
      if (page === 'dashboard') return
      setRecentPages((prev) => {
        const updated = [page, ...prev.filter((p) => p !== page)].slice(0, 5)
        localStorage.setItem('recentPages', JSON.stringify(updated))
        return updated
      })
    },
    [setRecentPages]
  )

  const handleNavigate = useCallback(
    (page) => {
      if (dirtyEditor) {
        setPendingNav(page)
        setNavDialogOpen(true)
      } else {
        pushRecentPage(page)
        setCurrentPage(page)
      }
    },
    [dirtyEditor, setCurrentPage, pushRecentPage]
  )

  const handleNavSave = useCallback(async () => {
    const page = pendingNav
    setNavDialogOpen(false)
    setPendingNav(null)
    try {
      await dirtyEditor?.onSave()
      // markClean is called inside the editor's save handler; navigate after
      pushRecentPage(page)
      setCurrentPage(page)
    } catch {
      // save failed — stay on current page
    }
  }, [pendingNav, dirtyEditor, setCurrentPage, pushRecentPage])

  const handleNavDiscard = useCallback(() => {
    const page = pendingNav
    setNavDialogOpen(false)
    setPendingNav(null)
    setDirtyEditor(null)
    pushRecentPage(page)
    setCurrentPage(page)
  }, [pendingNav, setCurrentPage, setDirtyEditor, pushRecentPage])

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
