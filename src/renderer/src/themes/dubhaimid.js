import { createTheme, responsiveFontSizes } from '@mui/material/styles'

// Dubhaimid — the dark "corporate/boring" theme. Neutral charcoal grays
// (VS Code-ish), light-gray text, a single muted blue accent, plain system
// sans-serif type, and flat subtle borders with no keyline shadows. The dark
// sibling of Mundanes. Ported from Taliesin's lean port and reshaped to
// Creidhne's override set (adds MuiPaginationItem + text.button / text.dark).
const dubhaimidTheme = responsiveFontSizes(
  createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: '#5c8bc4',
        light: '#82a9d6',
        dark: '#3f6a9e',
        contrastText: '#ffffff'
      },
      // secondary is the chrome color — MainToolbar paints its bars from
      // secondary.main. Dubhaimid shares Mundanes' navy so both corporate
      // themes read as one family (light vs dark bodies, same navy chrome).
      // secondary.dark feeds ONLY the active nav icon; kept bright so it reads
      // on the navy bar (Creidhne's chrome is a Toolbar painted secondary.main,
      // not a recolored AppBar, so both corporate themes get a navy bar here).
      secondary: {
        main: '#0a246a',
        light: '#2f4f8f',
        dark: '#82a9d6',
        contrastText: '#ffffff'
      },
      background: {
        default: '#1e1e1e',
        paper: '#252526'
      },
      text: {
        primary: '#e0e0e0',
        secondary: '#9aa0a6',
        disabled: '#6a6a6e',
        // Page/section headers read text.button on the charcoal body — keep it
        // light. The navy chrome forces its own white in MainToolbar.
        button: '#e0e0e0',
        dark: '#1a1a1b'
      },
      divider: 'rgba(255,255,255,0.12)',
      error: { main: '#f44336' },
      warning: { main: '#ffa726' },
      info: { main: '#29b6f6' },
      success: { main: '#66bb6a' }
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
            backgroundColor: '#252526',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: 'none'
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.23)',
            color: '#5c8bc4',
            '&:hover': { backgroundColor: 'rgba(92,139,196,0.12)', borderColor: '#5c8bc4' }
          },
          contained: {
            backgroundColor: '#5c8bc4',
            color: '#ffffff',
            boxShadow: 'none',
            '&:hover': { backgroundColor: '#3f6a9e', boxShadow: 'none' }
          }
        }
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: '#252526',
            backgroundImage: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.12)',
            boxShadow: 'none'
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: '#252526',
            borderRight: '1px solid rgba(255,255,255,0.12)'
          }
        }
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            color: '#9aa0a6',
            '&.Mui-selected': {
              backgroundColor: 'rgba(92,139,196,0.16)',
              borderLeft: '2px solid #5c8bc4',
              color: '#82a9d6'
            },
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' }
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: '#2d2d30',
            border: '1px solid rgba(255,255,255,0.12)',
            backgroundImage: 'none',
            transition: 'border-color 0.2s',
            '&:hover': { borderColor: 'rgba(255,255,255,0.24)' }
          }
        }
      },
      MuiDivider: { styleOverrides: { root: { borderColor: 'rgba(255,255,255,0.12)' } } },
      MuiChip: {
        styleOverrides: {
          root: {
            backgroundColor: '#3e3e42',
            color: '#c4c8cc',
            border: '1px solid rgba(255,255,255,0.12)'
          }
        }
      },
      MuiPaginationItem: {
        styleOverrides: {
          root: {
            border: '1px solid rgba(255,255,255,0.16)',
            color: '#9aa0a6',
            borderRadius: 6,
            '&.Mui-selected': {
              backgroundColor: 'rgba(92,139,196,0.18)',
              borderColor: '#5c8bc4',
              color: '#82a9d6'
            }
          }
        }
      },
      MuiTab: {
        styleOverrides: {
          root: {
            color: '#9aa0a6',
            '&.Mui-selected': { color: '#82a9d6' }
          }
        }
      },
      MuiTabs: { styleOverrides: { indicator: { backgroundColor: '#5c8bc4' } } },
      MuiInputLabel: {
        styleOverrides: { root: { '&.Mui-focused': { color: '#5c8bc4' } } }
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            color: 'rgba(255,255,255,0.4)',
            '&.Mui-checked': { color: '#5c8bc4' }
          }
        }
      },
      MuiSlider: {
        defaultProps: { color: 'secondary' },
        styleOverrides: {
          rail: { backgroundColor: 'rgba(255,255,255,0.2)', opacity: 1 }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.23)' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#5c8bc4' }
          }
        }
      }
    }
  })
)

export default dubhaimidTheme
