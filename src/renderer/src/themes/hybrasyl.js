import { createTheme, responsiveFontSizes } from '@mui/material/styles'

const hybrasylTheme = responsiveFontSizes(
  createTheme({
    palette: {
      mode: 'dark',
      // `main` MUST NOT equal `background.default`. It did — both were '#0d182f'
      // — so anything signalling state through `primary` painted itself the
      // colour of the page behind it, at a measured contrast of 1.00:1. The
      // affordance inverted rather than merely dimming: a filled Chip takes
      // `main` as its background while an unselected one keeps MUI's default
      // grey, so the SELECTED chip was the one that vanished.
      //
      // '#4d84d1' was sitting right there as `light`, unused for this, which is
      // the tell that `main` was filled in from the background rather than
      // chosen. Re-measured here rather than taken from taliesin: 4.66:1 against
      // the page.
      //
      // `contrastText` is deep navy, NOT the theme's cream. Measured: cream
      // (#f0e6cc) on this blue is 3.05:1, which fails WCAG AA for normal text,
      // and chip and button labels are normal text. Navy gives 4.66:1.
      // Legibility over palette sentiment; see HTOO-341.
      primary: {
        main: '#4d84d1',
        light: '#7fa9e0',
        dark: '#2a4a6e',
        contrastText: '#0d182f'
      },
      secondary: {
        main: '#1e5e56',
        light: '#3a9e90',
        dark: '#5ecfbe',
        contrastText: '#f0e6cc'
      },
      background: {
        default: '#0d182f',
        paper: 'rgba(6,12,18,0.82)'
      },
      text: {
        primary: '#f0e6cc',
        secondary: '#a8b8c4',
        disabled: '#506070',
        button: '#f0e6cc',
        dark: '#0c1018'
      },
      divider: 'rgba(58,158,144,0.22)',
      error: { main: '#ff0000' },
      warning: { main: '#FFFF00' },
      info: { main: '#6de7f7' },
      success: { main: '#38ff4f' }
    },

    typography: {
      fontFamily: '"Crimson Pro", Georgia, serif',
      h1: { fontFamily: '"Cinzel Decorative", serif', letterSpacing: '0.22em', fontWeight: 400 },
      h2: { fontFamily: '"Cinzel", serif', letterSpacing: '0.08em', fontWeight: 400 },
      h3: { fontFamily: '"Cinzel", serif', letterSpacing: '0.06em', fontWeight: 400 },
      h4: { fontFamily: '"Cinzel", serif', letterSpacing: '0.06em', fontWeight: 400 },
      h5: { fontFamily: '"Cinzel", serif', letterSpacing: '0.06em', fontWeight: 400 },
      h6: { fontFamily: '"Cinzel", serif', letterSpacing: '0.06em', fontWeight: 400 },
      button: {
        fontFamily: '"Cinzel", serif',
        letterSpacing: '0.12em',
        textTransform: 'uppercase'
      },
      caption: { fontFamily: '"Cinzel", serif', letterSpacing: '0.18em', fontSize: '0.7rem' }
    },

    shape: { borderRadius: 2 },

    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: 'rgba(6,12,18,0.82)',
            border: '1px solid rgba(58,158,144,0.32)',
            backdropFilter: 'blur(2px)',
            boxShadow: '-2px -2px 0 0 #1e5e56, 2px 2px 0 0 #1e5e56'
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 2,
            border: '1px solid #3a9e90',
            color: '#5ecfbe',
            '&:hover': { backgroundColor: 'rgba(58,158,144,0.15)', borderColor: '#5ecfbe' }
          },
          contained: {
            backgroundColor: 'rgba(58,158,144,0.2)',
            '&:hover': { backgroundColor: 'rgba(58,158,144,0.35)' }
          }
        }
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: 'rgba(4,8,14,0.97)',
            backgroundImage: 'none',
            borderBottom: '1px solid rgba(58,158,144,0.22)',
            boxShadow: 'none'
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: 'rgba(6,12,18,0.92)',
            borderRight: '1px solid rgba(58,158,144,0.32)'
          }
        }
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            fontFamily: '"Cinzel", serif',
            fontSize: '0.7rem',
            letterSpacing: '0.1em',
            borderBottom: '1px solid rgba(58,158,144,0.08)',
            '&.Mui-selected': {
              backgroundColor: 'rgba(58,158,144,0.12)',
              borderLeft: '2px solid #3a9e90',
              color: '#5ecfbe'
            },
            '&:hover': { backgroundColor: 'rgba(58,158,144,0.08)', paddingLeft: '20px' }
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: 'rgba(10,18,26,0.92)',
            border: '1px solid rgba(58,158,144,0.16)',
            backgroundImage: 'none',
            transition: 'border-color 0.2s, transform 0.2s',
            '&:hover': { borderColor: '#3a9e90', transform: 'translateY(-2px)' }
          }
        }
      },
      MuiDivider: { styleOverrides: { root: { borderColor: 'rgba(58,158,144,0.15)' } } },
      // Links use the info accent (#6de7f7) rather than the low-contrast primary
      // blue; explicit color props on a Link still win over this default.
      MuiLink: { styleOverrides: { root: { color: '#6de7f7' } } },
      MuiChip: {
        styleOverrides: {
          root: {
            fontFamily: '"Cinzel", serif',
            fontSize: '0.65rem',
            letterSpacing: '0.1em',
            backgroundColor: 'rgba(58,158,144,0.14)',
            color: '#3a9e90',
            border: '1px solid rgba(58,158,144,0.3)'
          }
        }
      },
      MuiPaginationItem: {
        styleOverrides: {
          root: {
            fontFamily: '"Cinzel", serif',
            fontSize: '0.7rem',
            border: '1px solid rgba(58,158,144,0.2)',
            color: '#506070',
            borderRadius: 2,
            '&.Mui-selected': {
              backgroundColor: 'rgba(58,158,144,0.18)',
              borderColor: '#3a9e90',
              color: '#5ecfbe'
            }
          }
        }
      },
      MuiTab: {
        styleOverrides: {
          root: {
            fontFamily: '"Cinzel", serif',
            fontSize: '0.7rem',
            letterSpacing: '0.14em',
            color: '#506070',
            '&.Mui-selected': { color: '#5ecfbe' }
          }
        }
      },
      MuiTabs: { styleOverrides: { indicator: { backgroundColor: '#3a9e90' } } },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            '&.Mui-focused': { color: '#3a9e90' }
          }
        }
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            color: 'rgba(58,158,144,0.5)',
            '&.Mui-checked': { color: '#3a9e90' }
          }
        }
      },
      MuiSlider: {
        defaultProps: { color: 'secondary' },
        styleOverrides: {
          rail: { backgroundColor: 'rgba(240,230,204,0.25)', opacity: 1 }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(58,158,144,0.3)' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(58,158,144,0.6)' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3a9e90' }
          }
        }
      }
    }
  })
)

export default hybrasylTheme
