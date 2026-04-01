import { createTheme, responsiveFontSizes } from '@mui/material/styles';

const hybrasylTheme = responsiveFontSizes(createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main:        '#0d182f',
      light:       '#4d84d1',
      dark:        '#2a4a6e',
      contrastText:'#f0e6cc',
    },
    secondary: {
      main:        '#1e5e56',
      light:       '#3a9e90',
      dark:        '#5ecfbe',
      contrastText:'#f0e6cc',
    },
    background: {
      default: '#0d182f',
      paper:   'rgba(6,12,18,0.82)',
    },
    text: {
      primary:   '#f0e6cc',
      secondary: '#a8b8c4',
      disabled:  '#506070',
      button:    '#f0e6cc',
      dark:      '#0c1018',
    },
    divider: 'rgba(58,158,144,0.22)',
    error:   { main: '#ff0000' },
    warning: { main: '#FFFF00' },
    info:    { main: '#6de7f7' },
    success: { main: '#38ff4f' },
  },

  typography: {
    fontFamily: '"Crimson Pro", Georgia, serif',
    h1: { fontFamily: '"Cinzel Decorative", serif', letterSpacing: '0.22em', fontWeight: 400 },
    h2: { fontFamily: '"Cinzel", serif', letterSpacing: '0.08em', fontWeight: 400 },
    h3: { fontFamily: '"Cinzel", serif', letterSpacing: '0.06em', fontWeight: 400 },
    h4: { fontFamily: '"Cinzel", serif', letterSpacing: '0.06em', fontWeight: 400 },
    h5: { fontFamily: '"Cinzel", serif', letterSpacing: '0.06em', fontWeight: 400 },
    h6: { fontFamily: '"Cinzel", serif', letterSpacing: '0.06em', fontWeight: 400 },
    button: { fontFamily: '"Cinzel", serif', letterSpacing: '0.12em', textTransform: 'uppercase' },
    caption: { fontFamily: '"Cinzel", serif', letterSpacing: '0.18em', fontSize: '0.7rem' },
  },

  shape: { borderRadius: 2 },

  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(6,12,18,0.82)',
          border:          '1px solid rgba(58,158,144,0.32)',
          backdropFilter:  'blur(2px)',
          boxShadow: '-2px -2px 0 0 #1e5e56, 2px 2px 0 0 #1e5e56',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          border: '1px solid #3a9e90',
          color:  '#5ecfbe',
          '&:hover': { backgroundColor: 'rgba(58,158,144,0.15)', borderColor: '#5ecfbe' },
        },
        contained: {
          backgroundColor: 'rgba(58,158,144,0.2)',
          '&:hover': { backgroundColor: 'rgba(58,158,144,0.35)' },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(4,8,14,0.97)',
          backgroundImage: 'none',
          borderBottom:    '1px solid rgba(58,158,144,0.22)',
          boxShadow:       'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(6,12,18,0.92)',
          borderRight:     '1px solid rgba(58,158,144,0.32)',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif', fontSize: '0.7rem', letterSpacing: '0.1em',
          borderBottom: '1px solid rgba(58,158,144,0.08)',
          '&.Mui-selected': { backgroundColor: 'rgba(58,158,144,0.12)', borderLeft: '2px solid #3a9e90', color: '#5ecfbe' },
          '&:hover': { backgroundColor: 'rgba(58,158,144,0.08)', paddingLeft: '20px' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(10,18,26,0.92)', border: '1px solid rgba(58,158,144,0.16)',
          backgroundImage: 'none', transition: 'border-color 0.2s, transform 0.2s',
          '&:hover': { borderColor: '#3a9e90', transform: 'translateY(-2px)' },
        },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: 'rgba(58,158,144,0.15)' } } },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.1em',
          backgroundColor: 'rgba(58,158,144,0.14)', color: '#3a9e90', border: '1px solid rgba(58,158,144,0.3)',
        },
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif', fontSize: '0.7rem',
          border: '1px solid rgba(58,158,144,0.2)', color: '#506070', borderRadius: 2,
          '&.Mui-selected': { backgroundColor: 'rgba(58,158,144,0.18)', borderColor: '#3a9e90', color: '#5ecfbe' },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif', fontSize: '0.7rem', letterSpacing: '0.14em', color: '#506070',
          '&.Mui-selected': { color: '#5ecfbe' },
        },
      },
    },
    MuiTabs: { styleOverrides: { indicator: { backgroundColor: '#3a9e90' } } },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          '&.Mui-focused': { color: '#3a9e90' },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: 'rgba(58,158,144,0.5)',
          '&.Mui-checked': { color: '#3a9e90' },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(58,158,144,0.3)' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(58,158,144,0.6)' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3a9e90' },
        },
      },
    },
  },
}));

export default hybrasylTheme;
