import { createTheme, responsiveFontSizes } from '@mui/material/styles'

// Mundanes — the light "corporate/boring" theme. White and light-gray
// surfaces, dark text, a single restrained slate-blue accent, plain system
// sans-serif type, and flat 1px gray borders with no keyline shadows.
// Deliberately the plainest theme in the app. Ported from Taliesin's lean
// port and reshaped to Creidhne's override set (adds MuiPaginationItem and the
// text.button / text.dark keys Creidhne's chrome + page headers read).
const mundanesTheme = responsiveFontSizes(
  createTheme({
    palette: {
      mode: 'light',
      primary: {
        main: '#1976d2',
        light: '#4a97e0',
        dark: '#115293',
        contrastText: '#ffffff'
      },
      // secondary is the chrome color — MainToolbar paints its two bars from
      // secondary.main, so Mundanes uses the classic Windows active-title navy
      // and shares it with Dubhaimid so both corporate themes read as one family.
      // secondary.dark is consumed ONLY by MainToolbar's active nav icon (grep-
      // verified), so it's set *bright* to stay legible on the navy bar rather
      // than following main→dark shading.
      secondary: {
        main: '#0a246a',
        light: '#2f4f8f',
        dark: '#7fb3ee',
        contrastText: '#ffffff'
      },
      background: {
        // A cool light-gray canvas so white paper/cards read as raised surfaces.
        default: '#c9cdd4',
        paper: '#ffffff'
      },
      text: {
        primary: '#1a1a1a',
        secondary: '#5f6368',
        disabled: '#9aa0a6',
        // Page/section headers read text.button on body paper — keep it dark on
        // the light canvas. The navy chrome forces its own white in MainToolbar
        // (PLAIN_CHROME_THEMES) rather than relying on this token.
        button: '#1a1a1a',
        dark: '#1a1a1a'
      },
      divider: 'rgba(0,0,0,0.12)',
      error: { main: '#d32f2f' },
      warning: { main: '#ed6c02' },
      info: { main: '#0288d1' },
      success: { main: '#2e7d32' }
    },

    typography: {
      fontFamily: 'Roboto, "Segoe UI", system-ui, -apple-system, sans-serif',
      h1: { fontWeight: 500 },
      h2: { fontWeight: 500 },
      h3: { fontWeight: 500 },
      h4: { fontWeight: 500 },
      h5: { fontWeight: 500 },
      h6: { fontWeight: 500 },
      button: { textTransform: 'none', fontWeight: 500 },
      body1: { fontSize: '0.95rem' },
      body2: { fontSize: '0.85rem' },
      subtitle1: { fontSize: '0.9rem' },
      subtitle2: { fontSize: '0.8rem' }
    },

    shape: { borderRadius: 6 },

    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: '#ffffff',
            border: '1px solid rgba(0,0,0,0.12)',
            boxShadow: 'none'
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            border: '1px solid rgba(0,0,0,0.23)',
            color: '#1976d2',
            '&:hover': { backgroundColor: 'rgba(25,118,210,0.06)', borderColor: '#1976d2' }
          },
          contained: {
            backgroundColor: '#1976d2',
            color: '#ffffff',
            boxShadow: 'none',
            '&:hover': { backgroundColor: '#115293', boxShadow: 'none' }
          }
        }
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: '#0a246a',
            backgroundImage: 'none',
            color: '#ffffff',
            borderBottom: '1px solid rgba(255,255,255,0.12)',
            boxShadow: 'none'
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: '#ffffff',
            borderRight: '1px solid rgba(0,0,0,0.12)'
          }
        }
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            color: '#5f6368',
            '&.Mui-selected': {
              backgroundColor: 'rgba(25,118,210,0.08)',
              borderLeft: '2px solid #1976d2',
              color: '#1976d2'
            },
            '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' }
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: '#ffffff',
            border: '1px solid rgba(0,0,0,0.12)',
            backgroundImage: 'none',
            boxShadow: '0 1px 3px rgba(0,0,0,0.10)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            '&:hover': { borderColor: 'rgba(0,0,0,0.24)', boxShadow: '0 2px 6px rgba(0,0,0,0.14)' }
          }
        }
      },
      MuiDivider: { styleOverrides: { root: { borderColor: 'rgba(0,0,0,0.12)' } } },
      MuiChip: {
        styleOverrides: {
          root: {
            backgroundColor: '#eceff1',
            color: '#455a64',
            border: '1px solid rgba(0,0,0,0.12)'
          }
        }
      },
      MuiPaginationItem: {
        styleOverrides: {
          root: {
            border: '1px solid rgba(0,0,0,0.16)',
            color: '#5f6368',
            borderRadius: 6,
            '&.Mui-selected': {
              backgroundColor: 'rgba(25,118,210,0.12)',
              borderColor: '#1976d2',
              color: '#1976d2'
            }
          }
        }
      },
      MuiTab: {
        styleOverrides: {
          root: {
            color: '#5f6368',
            '&.Mui-selected': { color: '#1976d2' }
          }
        }
      },
      MuiTabs: { styleOverrides: { indicator: { backgroundColor: '#1976d2' } } },
      MuiInputLabel: {
        styleOverrides: { root: { '&.Mui-focused': { color: '#1976d2' } } }
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            color: 'rgba(0,0,0,0.4)',
            '&.Mui-checked': { color: '#1976d2' }
          }
        }
      },
      MuiSlider: {
        defaultProps: { color: 'secondary' },
        styleOverrides: {
          rail: { backgroundColor: 'rgba(0,0,0,0.2)', opacity: 1 }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.23)' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.5)' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2' }
          }
        }
      }
    }
  })
)

export default mundanesTheme
