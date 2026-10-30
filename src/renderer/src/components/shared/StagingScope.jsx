import { createContext, useContext, useMemo } from 'react'
import { Box, ThemeProvider } from '@mui/material'
import { useAppStore, IndexViewContext } from '../../store/appStore'
import { STAGED_TYPES, mergeStagedIndex, stagedOnlyNameSet } from '@shared/staging.js'

/**
 * What an editor knows about where its file lives (HTOO-453). Read by
 * `EditorHeader`, so the header of every editor shows Stage or Release without
 * a prop through each one.
 */
const StagingContext = createContext({ staged: false, onStage: null, onRelease: null })

export function useStaging() {
  return useContext(StagingContext)
}

const identityTheme = (outer) => outer

/**
 * A theme that marks the staged-only names in every Autocomplete's list, for a
 * staged editor. It sets the default `renderOption`, so a picker that renders
 * its own options keeps them and shows no mark; every other picker shows one,
 * with no change to the picker.
 */
function markTheme(stagedOnly) {
  const renderOption = (props, option, _state, ownerState) => {
    const { key, ...rest } = props
    const label = ownerState.getOptionLabel(option)
    return (
      <li key={key} {...rest}>
        {label}
        {stagedOnly.has(label) && (
          <Box
            component="span"
            data-testid="staged-option-mark"
            sx={{ ml: 1, typography: 'caption', color: 'text.secondary' }}
          >
            staged
          </Box>
        )}
      </li>
    )
  }
  return (outer) => ({
    ...outer,
    components: {
      ...outer.components,
      MuiAutocomplete: {
        ...outer.components?.MuiAutocomplete,
        defaultProps: { ...outer.components?.MuiAutocomplete?.defaultProps, renderOption }
      }
    }
  })
}

/**
 * Wraps an editor. Each file-backed page renders its editor inside one, and
 * `stagingSites.test.js` counts them.
 *
 * For a staged file, the editor sees the live index with each type's staged
 * names added (`IndexViewContext`), so its pickers offer both and its duplicate
 * check compares against both. For a live file the editor sees the live index
 * only: a live file that names a staged entity cannot be resolved, so a live
 * picker does not offer one.
 *
 * `newStaged` marks a new entity, with no file yet, that the user started from
 * the Staged tab: it is staged from its first render, so its pickers offer
 * staged names before it is saved.
 *
 * The tree has the same shape for both, so moving between a live file and a
 * staged one does not remount the editor for that reason alone.
 */
export default function StagingScope({ file, newStaged = false, onStage, onRelease, children }) {
  const libraryIndex = useAppStore((s) => s.libraryIndex)
  const stagedIndex = useAppStore((s) => s.stagedIndex)
  const staged = file ? file.staged === true : newStaged === true

  const view = useMemo(
    () => (staged ? mergeStagedIndex(libraryIndex, stagedIndex) : null),
    [staged, libraryIndex, stagedIndex]
  )
  const theme = useMemo(() => {
    if (!staged) return identityTheme
    const stagedOnly = new Set()
    for (const type of STAGED_TYPES) {
      for (const name of stagedOnlyNameSet(libraryIndex, stagedIndex, type)) stagedOnly.add(name)
    }
    return markTheme(stagedOnly)
  }, [staged, libraryIndex, stagedIndex])
  const context = useMemo(() => ({ staged, onStage, onRelease }), [staged, onStage, onRelease])

  return (
    <StagingContext.Provider value={context}>
      <IndexViewContext.Provider value={view}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </IndexViewContext.Provider>
    </StagingContext.Provider>
  )
}
