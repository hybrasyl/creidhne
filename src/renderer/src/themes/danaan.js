import { createTheme, responsiveFontSizes } from '@mui/material/styles';

const danaanTheme = responsiveFontSizes(createTheme({
  palette: {
    mode: 'light',
    primary: {
      main:        '#b8922a',
      light:       '#e8c060',
      dark:        '#7a5e18',
      contrastText:'#1a1008',
    },
    secondary: {
      main:        '#c8a030',
      light:       '#f0d070',
      dark:        '#8a6820',
      contrastText:'#1a1008',
    },
    background: {
      default: '#f5e8c0',
      paper:   'rgba(250,242,220,0.94)',
    },
    text: {
      primary:   '#2a1e08',
      secondary: '#4a3c20',
      disabled:  '#9a8860',
      button:    '#2a1e08',
      dark:      '#1a1008',
    },
    divider: 'rgba(184,146,42,0.3)',
    error:   { main: '#a83232' },
    warning: { main: '#b8922a' },
    info:    { main: '#b8922a' },
    success: { main: '#4a7a28' },
  },

  typography: {
    fontFamily: '"Crimson Pro", Georgia, serif',
    h1: { fontFamily: '"Cinzel Decorative", serif', letterSpacing: '0.22em', fontWeight: 400, color: '#2a1e08' },
    h2: { fontFamily: '"Cinzel", serif', letterSpacing: '0.08em', fontWeight: 400, color: '#2a1e08' },
    h3: { fontFamily: '"Cinzel", serif', letterSpacing: '0.06em', fontWeight: 400, color: '#2a1e08' },
    h4: { fontFamily: '"Cinzel", serif', letterSpacing: '0.06em', fontWeight: 400, color: '#2a1e08' },
    h5: { fontFamily: '"Cinzel", serif', letterSpacing: '0.06em', fontWeight: 400, color: '#2a1e08' },
    h6: { fontFamily: '"Cinzel", serif', letterSpacing: '0.06em', fontWeight: 400, color: '#2a1e08' },
    button: { fontFamily: '"Cinzel", serif', letterSpacing: '0.12em', textTransform: 'uppercase' },
    caption: { fontFamily: '"Cinzel", serif', letterSpacing: '0.18em', fontSize: '0.7rem' },
  },

  shape: { borderRadius: 2 },

  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(250,242,220,0.94)',
          border:          '1px solid rgba(184,146,42,0.45)',
          backdropFilter:  'blur(2px)',
          boxShadow: '-2px -2px 0 0 #b8922a, 2px 2px 0 0 #b8922a',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          border: '1px solid #b8922a',
          color:  '#7a5e18',
          '&:hover': { backgroundColor: 'rgba(184,146,42,0.12)', borderColor: '#e8c060' },
        },
        contained: {
          backgroundColor: '#b8922a',
          color: '#fff8e8',
          '&:hover': { backgroundColor: '#d4a843' },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,248,225,0.97)',
          backgroundImage: 'none',
          borderBottom:    '1px solid rgba(184,146,42,0.3)',
          boxShadow:       'none',
          color:           '#2a1e08',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(250,242,220,0.97)',
          borderRight:     '1px solid rgba(184,146,42,0.4)',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif', fontSize: '0.7rem', letterSpacing: '0.1em',
          color: '#4a3c20', borderBottom: '1px solid rgba(184,146,42,0.12)',
          '&.Mui-selected': { backgroundColor: 'rgba(184,146,42,0.15)', borderLeft: '2px solid #b8922a', color: '#7a5e18' },
          '&:hover': { backgroundColor: 'rgba(184,146,42,0.1)', paddingLeft: '20px' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,250,235,0.96)', border: '1px solid rgba(184,146,42,0.25)',
          backgroundImage: 'none', transition: 'border-color 0.2s, transform 0.2s',
          '&:hover': { borderColor: '#b8922a', transform: 'translateY(-2px)' },
        },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: 'rgba(184,146,42,0.2)' } } },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.1em',
          backgroundColor: 'rgba(184,146,42,0.15)', color: '#7a5e18', border: '1px solid rgba(184,146,42,0.35)',
        },
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif', fontSize: '0.7rem',
          border: '1px solid rgba(184,146,42,0.25)', color: '#9a8860', borderRadius: 2,
          '&.Mui-selected': { backgroundColor: 'rgba(184,146,42,0.18)', borderColor: '#b8922a', color: '#7a5e18' },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif', fontSize: '0.7rem', letterSpacing: '0.14em', color: '#9a8860',
          '&.Mui-selected': { color: '#7a5e18' },
        },
      },
    },
    MuiTabs: { styleOverrides: { indicator: { backgroundColor: '#b8922a' } } },
  },
}));

export default danaanTheme;
