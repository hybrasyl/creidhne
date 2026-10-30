import { createContext, useContext, useMemo } from 'react'
import { Box, ThemeProvider } from '@mui/material'
import { useAppStore, IndexViewContext } from '../../store/appStore'
import { STAGED_TYPES, mergeStagedIndex, stagedOnlyNameSet } from '@shared/staging.js'

/**
 * Where an editor's next save goes (HTOO-453, HTOO-628). Read by
 * `EditorHeader`, so the Staging box is in every editor without a prop through
 * each one. `onSaveStagedChange` is null outside a file-backed page, and the
 * header then shows no box.
 */
const StagingContext = createContext({ staged: false, onSaveStagedChange: null })

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
 * `saveStaged` is the page's Staging box: where the next save writes. It
 * starts as where the open file is, and for a new entity it starts checked when
 * the list shows only staged files. While it is checked, the editor sees the
 * live index with each type's staged names added (`IndexViewContext`), so its
 * pickers offer both and its duplicate check compares against both. While it
 * is clear, the editor sees the live index only: a live file that names a
 * staged entity cannot be resolved, so a live picker does not offer one.
 *
 * The tree has the same shape for both, so moving between a live file and a
 * staged one does not remount the editor for that reason alone.
 */
export default function StagingScope({ saveStaged = false, onSaveStagedChange = null, children }) {
  const libraryIndex = useAppStore((s) => s.libraryIndex)
  const stagedIndex = useAppStore((s) => s.stagedIndex)
  const staged = saveStaged === true

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
  const context = useMemo(() => ({ staged, onSaveStagedChange }), [staged, onSaveStagedChange])

  return (
    <StagingContext.Provider value={context}>
      <IndexViewContext.Provider value={view}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </IndexViewContext.Provider>
    </StagingContext.Provider>
  )
}
